from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit, join_room as sio_join_room, leave_room as sio_leave_room
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
socketio = SocketIO(app, cors_allowed_origins="*")

# Global reference to game_state, set by run_admin
game_state_ref = None
stroke_server_module = None # To access finish_round and handle_start_game

# Track drawer Socket.IO SID per room
_drawer_sids = {}  # { room_id: sid }

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

# ─── Socket.IO Signaling Events ───

_guesser_sids = {}  # room_id → set of guesser SIDs

@socketio.on('connect')
def handle_sio_connect():
    print(f"[Socket.IO] Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_sio_disconnect(reason=None):
    sid = request.sid
    # Clean up drawer SID if this was a drawer
    for room_id, dsid in list(_drawer_sids.items()):
        if dsid == sid:
            del _drawer_sids[room_id]
            print(f"[Socket.IO] Drawer disconnected from {room_id}")
    # Clean up guesser SID
    for room_id, sids in list(_guesser_sids.items()):
        sids.discard(sid)
    print(f"[Socket.IO] Client disconnected: {sid}")

@socketio.on('join_room')
def handle_sio_join_room(data):
    room_id = data.get('room_id')
    role = data.get('role', 'guesser')  # 'drawer' or 'guesser'
    if room_id:
        sio_join_room(room_id)
        if role == 'drawer':
            # Clean up: this SID may have been a guesser before role change
            if room_id in _guesser_sids:
                _guesser_sids[room_id].discard(request.sid)
            _drawer_sids[room_id] = request.sid
            print(f"[Socket.IO] Drawer joined room {room_id} (sid={request.sid})")
            # Notify drawer of ALL existing guessers already in the room
            existing_guessers = _guesser_sids.get(room_id, set())
            for gsid in existing_guessers:
                emit('new_guesser', {'guesser_sid': gsid}, to=request.sid)
                print(f"[Socket.IO] Notified new drawer of existing guesser {gsid}")
        else:
            # Clean up: this SID may have been a drawer before role change
            if _drawer_sids.get(room_id) == request.sid:
                del _drawer_sids[room_id]
            # Track this guesser
            if room_id not in _guesser_sids:
                _guesser_sids[room_id] = set()
            _guesser_sids[room_id].add(request.sid)
            # Notify drawer that a new guesser joined
            drawer_sid = _drawer_sids.get(room_id)
            if drawer_sid:
                emit('new_guesser', {'guesser_sid': request.sid}, to=drawer_sid)
                print(f"[Socket.IO] Notified drawer of new guesser {request.sid} in {room_id}")
            else:
                print(f"[Socket.IO] Guesser joined room {room_id} but no drawer yet (sid={request.sid})")

@socketio.on('webrtc_offer')
def handle_webrtc_offer(data):
    """Drawer sends offer targeted to a specific guesser."""
    room_id = data.get('room_id')
    offer = data.get('offer')
    target_sid = data.get('target_sid')  # Specific guesser SID
    if room_id and offer and target_sid:
        emit('webrtc_offer', {'offer': offer, 'from': request.sid}, to=target_sid)
        print(f"[WebRTC] Offer sent to guesser {target_sid} in {room_id}")

@socketio.on('webrtc_answer')
def handle_webrtc_answer(data):
    """Guesser sends answer → relay to drawer."""
    room_id = data.get('room_id')
    answer = data.get('answer')
    drawer_sid = _drawer_sids.get(room_id)
    if room_id and answer and drawer_sid:
        emit('webrtc_answer', {'answer': answer, 'from': request.sid}, to=drawer_sid)
        print(f"[WebRTC] Answer relayed to drawer in {room_id}")

@socketio.on('webrtc_ice_candidate')
def handle_webrtc_ice(data):
    """Relay ICE candidates between drawer and a specific guesser."""
    room_id = data.get('room_id')
    candidate = data.get('candidate')
    target_sid = data.get('target_sid')  # Specific target SID
    
    if not room_id or not candidate or not target_sid:
        return
    
    emit('webrtc_ice_candidate', {'candidate': candidate, 'from': request.sid}, to=target_sid)

# ─── Server Startup ───

def run_admin(game_state, stroke_server_mod):
    global game_state_ref, stroke_server_module
    game_state_ref = game_state
    stroke_server_module = stroke_server_mod
    
    # Run Flask-SocketIO in a separate thread
    kwargs = {'host': '0.0.0.0', 'port': 5001, 'debug': False, 'use_reloader': False, 'allow_unsafe_werkzeug': True}
    t = threading.Thread(target=socketio.run, args=(app,), kwargs=kwargs)
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
