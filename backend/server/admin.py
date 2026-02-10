from flask import Flask, render_template, jsonify, request
import threading
import json
import os
import sys

# Ensure we can import local modules
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from protocol import Protocol

app = Flask(__name__)
# Global reference to game_state, set by run_admin
game_state_ref = None
stroke_server_module = None # To access finish_round and handle_start_game

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/state')
def get_state():
    if not game_state_ref:
        return jsonify({"error": "Game state not linked"}), 500
    
    # Build serialization-safe state
    state_dump = {}
    with game_state_ref.lock:
        for room_id, room_data in game_state_ref.rooms.items():
            # Aggregate players by name
            players_dict = {}
            for conn, p_data in room_data['players'].items():
                name = p_data['name']
                if name not in players_dict:
                    players_dict[name] = {
                        "name": name,
                        "score": p_data['score'],
                        "is_host": p_data['is_host'],
                        "conns": []
                    }
                # Track connections for kicking
                try:
                    addr = str(conn.getpeername())
                    players_dict[name]["conns"].append(addr)
                except:
                    pass
                
                # Sync score (in case of drift, though GameState should handle it)
                if p_data['score'] > players_dict[name]['score']:
                     players_dict[name]['score'] = p_data['score']
                if p_data['is_host']:
                     players_dict[name]['is_host'] = True

            # Convert to list
            players_list = []
            for p in players_dict.values():
                players_list.append({
                    "name": p['name'],
                    "score": p['score'],
                    "is_host": p['is_host'],
                    "addr": ", ".join(p['conns']) # Show all addrs
                })
            
            state_dump[room_id] = {
                "round_active": room_data.get('round_active', False),
                "drawer": room_data.get('drawer'),
                "current_word": room_data.get('current_word'),
                "player_count": len(players_list), # Unique count
                "players": players_list,
                "chat_history": room_data.get('chat_history', [])
            }
            
    return jsonify(state_dump)

@app.route('/api/action', methods=['POST'])
def perform_action():
    data = request.json
    action = data.get('action')
    room_id = data.get('room_id')
    
    if not game_state_ref or not stroke_server_module:
        return jsonify({"error": "Server modules not linked"}), 500

    print(f"ADMIN ACTION: {action} on {room_id}")

    if action == "start_game":
        # Call handle_start_game in stroke_server
        # We need a way to invoke it. 
        # Since we run in a thread, we can call the module function directly if imported.
        stroke_server_module.handle_start_game(room_id, None) # None = system/admin
        return jsonify({"status": "started"})
        
    elif action == "end_round":
        # Call finish_round
        stroke_server_module.finish_round(room_id)
        return jsonify({"status": "ended"})
        
    elif action == "kick":
        player_addrs_str = data.get('addr') # Comma separated list
        # Logic to kick player: find conn by addr, close it, remove from gamestate
        if not player_addrs_str:
             return jsonify({"error": "No address provided"}), 400
             
        target_addrs = [a.strip() for a in player_addrs_str.split(',')]
        
        kicked_count = 0
        with game_state_ref.lock:
            if room_id in game_state_ref.rooms:
                room = game_state_ref.rooms[room_id]
                # Find all connections to kick
                conns_to_kick = []
                for conn in room['players']:
                    try:
                        peer = str(conn.getpeername())
                        if peer in target_addrs:
                            conns_to_kick.append(conn)
                    except:
                        pass
                
                for conn in conns_to_kick:
                    try:
                        conn.close()
                    except:
                        pass
                    game_state_ref.remove_client(room_id, conn)
                    kicked_count += 1
                    
        return jsonify({"status": "kicked", "count": kicked_count})

    elif action == "send_chat":
        message = data.get('message')
        if not message:
            return jsonify({"error": "No message"}), 400
            
        # Broadcast via stroke_server's broadcast method
        # We need to access the broadcast function. 
        # Since stroke_server_module is imported, we can use it.
        chat_msg = json.dumps({
            Protocol.ACTION: Protocol.CHAT,
            Protocol.PAYLOAD: f"ADMIN: {message}"
        })
        stroke_server_module.broadcast(room_id, chat_msg)
        return jsonify({"status": "sent"})

    return jsonify({"error": "Invalid action"}), 400

def run_admin(game_state, stroke_server_mod):
    global game_state_ref, stroke_server_module
    game_state_ref = game_state
    stroke_server_module = stroke_server_mod
    
    # Run Flask in a separate thread
    # Disable reloader to prevent main thread issues
    kwargs = {'host': '0.0.0.0', 'port': 5001, 'debug': False, 'use_reloader': False}
    t = threading.Thread(target=app.run, kwargs=kwargs)
    t.daemon = True
    t.start()
