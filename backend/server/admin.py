from flask import Flask, render_template, jsonify, request
import threading
import json
import os
import sys

# Ensure we can import local modules
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from protocol import Protocol
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Allow all origins for dev simplicity
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
                        "is_ready": p_data.get('is_ready', False),
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
                if p_data.get('is_ready'):
                     players_dict[name]['is_ready'] = True

            # Convert to list
            players_list = []
            for p in players_dict.values():
                players_list.append({
                    "name": p['name'],
                    "score": p['score'],
                    "is_host": p['is_host'],
                    "is_ready": p['is_ready'],
                    "addr": ", ".join(p['conns']) # Show all addrs
                })
            
            state_dump[room_id] = {
                "round_active": room_data.get('round_active', False),
                "drawer": room_data.get('drawer'),
                "current_word": room_data.get('current_word'),
                "time_remaining": int(room_data.get('time_remaining', 0)),
                "player_count": len(players_list), # Unique count
                "players": players_list,
                "chat_history": room_data.get('chat_history', [])
            }
            
    return jsonify(state_dump)

@app.route('/api/video/<room_id>')
def get_video(room_id):
    if not game_state_ref:
        return jsonify({"error": "Game state not linked"}), 500
    
    frame_data = game_state_ref.get_video_frame(room_id)
    if not frame_data:
        return jsonify({"error": "No video"}), 404
        
    return jsonify({"frame": frame_data})

@app.route('/api/check_room/<room_id>')
def check_room(room_id):
    if not game_state_ref:
        return jsonify({"error": "Game state not linked"}), 500
    
    exists = False
    player_count = 0
    round_active = False
    all_ready = False
    
    with game_state_ref.lock:
        if room_id in game_state_ref.rooms:
            exists = True
            room = game_state_ref.rooms[room_id]
            player_count = len(room.get('players', {}))
            round_active = room.get('round_active', False)
            
            # Check if all non-host players are ready
            all_ready = True
            for p in room.get('players', {}).values():
                 if not p['is_host'] and not p.get('is_ready', False):
                     all_ready = False
                     break
            if player_count < 2:
                all_ready = False
            
    return jsonify({
        "exists": exists, 
        "player_count": player_count, 
        "round_active": round_active,
        "all_ready": all_ready
    })

@app.route('/api/action', methods=['POST'])
def perform_action():
    data = request.json
    action = data.get('action')
    room_id = data.get('room_id')
    
    if not game_state_ref or not stroke_server_module:
        return jsonify({"error": "Server modules not linked"}), 500

    print(f"ADMIN ACTION: {action} on {room_id}")

    if action == "start_game":
        # Validate readiness before starting (admin/HTTP path)
        if not game_state_ref.are_all_players_ready(room_id):
            return jsonify({"error": "Not all players are ready"}), 400
        stroke_server_module.handle_start_game(room_id, None)
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
        sender = data.get('sender', 'ADMIN') # Default to ADMIN if not sent
        if not message:
            return jsonify({"error": "No message"}), 400
            
        # Broadcast via stroke_server's broadcast method
        chat_msg = json.dumps({
            Protocol.ACTION: Protocol.CHAT,
            Protocol.PAYLOAD: f"[{sender}]: {message}" # Format: [Name]: Msg
        })
        stroke_server_module.broadcast(room_id, chat_msg)
        return jsonify({"status": "sent"})

    elif action == "ready_up":
        sender = data.get('sender')
        is_ready = data.get('is_ready', False)
        
        if not sender:
            return jsonify({"error": "No sender"}), 400
            
        found = False
        with game_state_ref.lock:
            if room_id in game_state_ref.rooms:
                room = game_state_ref.rooms[room_id]
                for conn, p in room['players'].items():
                    if p['name'] == sender:
                        p['is_ready'] = is_ready
                        found = True
                        # Don't break — update ALL connections for this name
        
        if found:
            return jsonify({"status": "updated"})
        return jsonify({"error": "Player not found"}), 404

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

@app.route('/api/create_room', methods=['POST'])
def create_room():
    if not game_state_ref:
        return jsonify({"error": "Game state not linked"}), 500
        
    import random
    import string
    
    # Try to generate a unique room ID
    new_room_id = ""
    with game_state_ref.lock:
        for _ in range(10): # Try 10 times
            candidate = ''.join(random.choices(string.ascii_uppercase, k=4))
            if candidate not in game_state_ref.rooms:
                new_room_id = candidate
                # We don't necessarily need to "create" it here if GameState creates on join,
                # but reserving it prevents race conditions if we had a reservation system.
                # Currently GameState creates on join. 
                # But frontend needs an ID to join.
                # So we just return a free ID.
                break
    
    if new_room_id:
        return jsonify({"room_id": new_room_id})
    else:
        return jsonify({"error": "Failed to generate unique room ID"}), 500

@app.route('/api/join_room', methods=['POST'])
def join_room():
    """Register a web player in the game state (no TCP socket needed)."""
    if not game_state_ref:
        return jsonify({"error": "Game state not linked"}), 500
    
    data = request.json
    room_id = data.get('room_id')
    player_name = data.get('player_name', 'WebPlayer')
    
    if not room_id:
        return jsonify({"error": "No room_id"}), 400
    
    web_key = game_state_ref.add_web_client(room_id, player_name)
    
    # Check if this player is host
    is_host = False
    with game_state_ref.lock:
        if room_id in game_state_ref.rooms:
            p = game_state_ref.rooms[room_id]['players'].get(web_key)
            if p:
                is_host = p['is_host']
    
    return jsonify({"status": "joined", "web_key": web_key, "is_host": is_host})

@app.route('/api/send_stroke', methods=['POST'])
def send_stroke():
    """Accept a stroke from a web drawer and broadcast to TCP clients."""
    if not game_state_ref or not stroke_server_module:
        return jsonify({"error": "Server not linked"}), 500
    
    data = request.json
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    stroke = data.get('stroke')  # The stroke data dict
    
    if not room_id or not stroke:
        return jsonify({"error": "Missing room_id or stroke"}), 400
    
    # Validate drawer
    if not game_state_ref.is_web_drawer(room_id, player_name):
        return jsonify({"error": "Not the drawer"}), 403
    
    # Serialize and store
    stroke_json = json.dumps(stroke)
    game_state_ref.add_stroke(room_id, stroke_json)
    
    # Broadcast to TCP clients (no exclude since web client isn't a TCP conn)
    stroke_server_module.broadcast(room_id, stroke_json)
    
    return jsonify({"status": "ok"})

@app.route('/api/strokes/<room_id>')
def get_strokes(room_id):
    """Return stroke history, with optional incremental polling via ?since=N."""
    if not game_state_ref:
        return jsonify({"error": "Game state not linked"}), 500
    
    since = request.args.get('since', 0, type=int)
    history = game_state_ref.get_history(room_id)
    
    # Return strokes from index 'since' onwards
    new_strokes = history[since:]
    
    # Parse JSON strings back to objects for the frontend
    parsed = []
    for s in new_strokes:
        try:
            parsed.append(json.loads(s))
        except:
            pass
    
    return jsonify({"strokes": parsed, "total": len(history)})

@app.route('/api/clear_canvas', methods=['POST'])
def clear_canvas():
    """Clear stroke history and broadcast clear to TCP clients."""
    if not game_state_ref or not stroke_server_module:
        return jsonify({"error": "Server not linked"}), 500
    
    data = request.json
    room_id = data.get('room_id')
    
    if not room_id:
        return jsonify({"error": "Missing room_id"}), 400
    
    # Clear history
    with game_state_ref.lock:
        if room_id in game_state_ref.rooms:
            game_state_ref.rooms[room_id]['history'] = []
    
    # Broadcast clear command to TCP clients
    clear_msg = json.dumps({"action": "clear"})
    stroke_server_module.broadcast(room_id, clear_msg)
    
    return jsonify({"status": "cleared"})
