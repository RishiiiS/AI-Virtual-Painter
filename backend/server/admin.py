from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit, join_room as sio_join_room, leave_room as sio_leave_room
import threading
import json
import os
import sys
import time

# Ensure we can import local modules
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from protocol import Protocol
from game_state import GameState
from flask_cors import CORS
import word_manager

app = Flask(__name__)
CORS(app)  # Allow all origins for dev simplicity
socketio = SocketIO(app, cors_allowed_origins="*")

# Global game state
game_state_ref = GameState()
stroke_server_module = None

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
                        "avatar": p_data.get('avatar', 'ghost'),
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
                    "avatar": p.get('avatar', 'ghost'),
                    "addr": ", ".join(p['conns']) # Show all addrs
                })
            
            # Compute time remaining dynamically
            time_remaining = 0
            if room_data.get('round_active'):
                start = room_data.get('round_start_time', 0)
                duration = room_data.get('round_duration', 60)
                elapsed = time.time() - start
                time_remaining = max(0, int(duration - elapsed))

            # Intermission countdown (time until next round starts)
            intermission_remaining = 0
            intermission_end = room_data.get('intermission_end_time')
            if intermission_end and not room_data.get('round_active', False):
                intermission_remaining = max(0, int(intermission_end - time.time()))


            state_dump[room_id] = {
                "round_active": room_data.get('round_active', False),
                "drawer": room_data.get('drawer'),
                "current_word": room_data.get('current_word'),
                "last_word": room_data.get('last_word'),
                "time_remaining": time_remaining,
                "intermission_remaining": intermission_remaining,
                "player_count": len(players_list),
                "players": players_list,
                "chat_history": room_data.get('chat_history', []),
                "last_round_results": room_data.get('last_round_results', [])
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

def _broadcast_web_chat(room_id, payload_text):
    """Mirror chat updates to Socket.IO clients in the room."""
    try:
        socketio.emit('chat_message', {'payload': payload_text}, to=room_id)
    except Exception as e:
        print(f"[Socket.IO] chat_message emit error: {e}", flush=True)

def _ensure_stroke_server_module():
    """Resolve stroke_server module in both direct and package import modes."""
    global stroke_server_module
    if stroke_server_module is not None:
        return stroke_server_module
    try:
        from backend.server import stroke_server as stroke_server_mod
        stroke_server_module = stroke_server_mod
    except Exception:
        try:
            import stroke_server as stroke_server_mod
            stroke_server_module = stroke_server_mod
        except Exception:
            stroke_server_module = None
    return stroke_server_module

def _process_chat_message(room_id, sender, message):
    """Shared chat/guess logic used by both HTTP and Socket.IO chat paths."""
    stroke_mod = _ensure_stroke_server_module()
    if stroke_mod is None:
        return {"error": "Server modules not linked"}, 500

    if not message:
        return {"error": "No message"}, 400

    web_key = f"web_{sender}"
    guess_result = None
    is_drawer = False
    word_in_message = False
    
    with game_state_ref.lock:
        if room_id in game_state_ref.rooms:
            room = game_state_ref.rooms[room_id]
            
            if room.get('round_active') and room.get('current_word'):
                current_word = room['current_word']
                drawer_name = room.get('drawer')
                is_drawer = (sender == drawer_name)
                
                # Block drawer from revealing the word
                if is_drawer and current_word.lower() in message.strip().lower():
                    word_in_message = True
                
                # Only check guesses from non-drawers who haven't guessed yet
                if not is_drawer:
                    # Already guessed? Block repeat scoring
                    if sender in room.get('guessed_players', set()):
                        guess_result = "already_guessed"
                    elif message.strip().lower() == current_word.lower():
                        # CORRECT GUESS — first time only
                        room['guessed_players'].add(sender)
                        
                        # Score the guesser
                        if web_key in room['players']:
                            room['players'][web_key]['score'] += 100
                            room['players'][web_key]['round_score'] = room['players'][web_key].get('round_score', 0) + 100
                        
                        # Score the drawer (+100 per correct guess)
                        for _, pdata in room['players'].items():
                            if pdata['name'] == drawer_name:
                                pdata['score'] += 100
                                pdata['round_score'] = pdata.get('round_score', 0) + 100
                                break
                        
                        # Check if ALL guessers have guessed
                        unique_names = set(pd['name'] for pd in room['players'].values())
                        total_guessers = len([n for n in unique_names if n != drawer_name])
                        
                        if len(room['guessed_players']) >= total_guessers and total_guessers > 0:
                            guess_result = "round_over"
                        else:
                            guess_result = "correct"
    
    # --- Handle results outside the lock ---
    if word_in_message:
        # Drawer tried to type the word — block it silently
        return {"status": "blocked", "reason": "Cannot reveal the word!"}, 200
    
    if guess_result == "already_guessed":
        # Player already guessed correctly — just show their message as normal chat, no points
        payload = f"[{sender}]: {message}"
        chat_msg = json.dumps({
            Protocol.ACTION: Protocol.CHAT,
            Protocol.PAYLOAD: payload
        })
        stroke_mod.broadcast(room_id, chat_msg)
        _broadcast_web_chat(room_id, payload)
        return {"status": "already_guessed"}, 200
    
    if guess_result == "correct":
        payload = f"SYSTEM: {sender} guessed the word! (+100 pts)"
        sys_msg = json.dumps({
            Protocol.ACTION: Protocol.CHAT,
            Protocol.PAYLOAD: payload
        })
        stroke_mod.broadcast(room_id, sys_msg)
        _broadcast_web_chat(room_id, payload)
        return {"status": "correct"}, 200
    
    if guess_result == "round_over":
        payload = f"SYSTEM: {sender} guessed the word! (+100 pts)"
        sys_msg = json.dumps({
            Protocol.ACTION: Protocol.CHAT,
            Protocol.PAYLOAD: payload
        })
        stroke_mod.broadcast(room_id, sys_msg)
        _broadcast_web_chat(room_id, payload)
        stroke_mod.finish_round(room_id)
        return {"status": "round_over"}, 200
    
    # Normal chat (wrong guess, no round, or drawer chatting without the word)
    payload = f"[{sender}]: {message}"
    chat_msg = json.dumps({
        Protocol.ACTION: Protocol.CHAT,
        Protocol.PAYLOAD: payload
    })
    stroke_mod.broadcast(room_id, chat_msg)
    _broadcast_web_chat(room_id, payload)
    return {"status": "sent"}, 200

@app.route('/api/action', methods=['POST'])
def perform_action():
    data = request.json
    action = data.get('action')
    room_id = data.get('room_id')
    
    stroke_mod = _ensure_stroke_server_module()
    if not game_state_ref or not stroke_mod:
        return jsonify({"error": "Server modules not linked"}), 500

    print(f"ADMIN ACTION: {action} on {room_id}")

    if action == "start_game":
        # Validate readiness before starting (admin/HTTP path)
        if not game_state_ref.are_all_players_ready(room_id):
            return jsonify({"error": "Not all players are ready"}), 400
        duration = data.get('duration', 60)
        # Clamp to valid range (30s - 180s)
        duration = max(30, min(180, int(duration)))
        stroke_mod.handle_start_game(room_id, None, duration=duration)
        return jsonify({"status": "started", "duration": duration})
        
    elif action == "end_round":
        # Call finish_round
        stroke_mod.finish_round(room_id)
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
        sender = data.get('sender', 'ADMIN')
        response_body, status_code = _process_chat_message(room_id, sender, message)
        return jsonify(response_body), status_code

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

@socketio.on('start_game')
def handle_socket_start_game(data):
    """Host triggers game start via Socket.IO"""
    from backend.server import stroke_server as stroke_server_mod
    room_id = data.get('room_id')
    duration = data.get('duration', 60)
    duration = max(30, min(180, int(duration)))

    if not room_id:
        return

    if not game_state_ref.are_all_players_ready(room_id):
        emit('error', {'message': 'Not all players are ready!'})
        return

    print(f"[StartGame] Host starting room {room_id} with duration={duration}", flush=True)
    threading.Thread(
        target=stroke_server_mod.handle_start_game,
        args=[room_id, None],
        kwargs={'duration': duration},
        daemon=True
    ).start()

@socketio.on('ready_up')
def handle_ready_up(data):

    """Toggle ready status via Socket.IO"""
    room_id = data.get('room_id')
    sender = data.get('sender')
    is_ready = data.get('is_ready', False)

    if not sender or not room_id:
        return

    with game_state_ref.lock:
        if room_id in game_state_ref.rooms:
            room = game_state_ref.rooms[room_id]
            for conn, p in room['players'].items():
                if p['name'] == sender:
                    p['is_ready'] = is_ready
                    # Don't break — update ALL connections for this player name

    print(f"[Ready] {sender} in {room_id}: ready={is_ready}", flush=True)

@socketio.on('chat_message')
def handle_chat_message(data):
    """Web chat event used by lobby and gameplay UIs."""
    room_id = data.get('room_id')
    sender = data.get('sender', 'WebPlayer')
    message = data.get('message')

    if not room_id:
        emit('error', {'message': 'Missing room_id'})
        return

    body, status_code = _process_chat_message(room_id, sender, message)
    if status_code >= 400:
        emit('error', {'message': body.get('error', 'Chat failed')})
        return
    if body.get('status') == 'blocked':
        emit('error', {'message': body.get('reason', 'Cannot reveal the word!')})

@socketio.on('draw_stroke')
def handle_draw_stroke(data):
    """Receive drawer strokes from web client and persist/broadcast them."""
    stroke_mod = _ensure_stroke_server_module()
    if stroke_mod is None:
        emit('error', {'message': 'Server modules not linked'})
        return

    room_id = data.get('room_id')
    player_name = data.get('player_name')
    stroke = data.get('stroke')

    if not room_id or stroke is None:
        emit('error', {'message': 'Missing room_id or stroke'})
        return

    if not game_state_ref.is_web_drawer(room_id, player_name):
        return

    try:
        stroke_json = json.dumps(stroke)
        game_state_ref.add_stroke(room_id, stroke_json)
        stroke_mod.broadcast(room_id, stroke_json)
    except Exception as e:
        print(f"[Socket.IO] draw_stroke error: {e}", flush=True)
        emit('error', {'message': 'Failed to process stroke'})

@socketio.on('clear_canvas')
def handle_clear_canvas(data):
    """Clear room canvas history and broadcast clear signal."""
    stroke_mod = _ensure_stroke_server_module()
    if stroke_mod is None:
        emit('error', {'message': 'Server modules not linked'})
        return

    room_id = data.get('room_id')
    if not room_id:
        emit('error', {'message': 'Missing room_id'})
        return

    with game_state_ref.lock:
        if room_id in game_state_ref.rooms:
            game_state_ref.rooms[room_id]['history'] = []

    clear_msg = json.dumps({"action": "clear"})
    stroke_mod.broadcast(room_id, clear_msg)

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
    avatar = data.get('avatar', 'ghost')
    
    if not room_id:
        return jsonify({"error": "No room_id"}), 400
    
    web_key = game_state_ref.add_web_client(room_id, player_name, avatar)
    
    # Check if this player is host
    is_host = False
    with game_state_ref.lock:
        if room_id in game_state_ref.rooms:
            p = game_state_ref.rooms[room_id]['players'].get(web_key)
            if p:
                is_host = p['is_host']
    
    return jsonify({"status": "joined", "web_key": web_key, "is_host": is_host})
@app.route('/api/end_room', methods=['POST'])
def end_room():
    """Host manually ends the game for everyone."""
    if not game_state_ref:
        return jsonify({"error": "Game state not linked"}), 500
    
    data = request.json
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    
    if not room_id or not player_name:
        return jsonify({"error": "Missing room_id or player_name"}), 400
        
    with game_state_ref.lock:
        if room_id in game_state_ref.rooms:
            room = game_state_ref.rooms[room_id]
            # Verify host
            is_host = False
            for pdata in room['players'].values():
                if pdata['name'] == player_name and pdata['is_host']:
                    is_host = True
                    break
                    
            if is_host:
                # Cancel any running timers
                game_state_ref.cancel_timer(room_id)

                # Notify all Socket.IO clients in this room before deletion.
                try:
                    socketio.emit('room_ended', {
                        'room_id': room_id,
                        'reason': 'host_ended'
                    }, to=room_id)
                except Exception as e:
                    print(f"[Socket.IO] room_ended emit error: {e}", flush=True)
                
                # Close all connections gracefully
                conns_to_close = list(room['players'].keys())
                for conn in conns_to_close:
                    try:
                        conn.close()
                    except:
                        pass
                
                # Delete the room
                del game_state_ref.rooms[room_id]
                return jsonify({"status": "success"})
            else:
                return jsonify({"error": "Only the host can end the game"}), 403
        else:
            return jsonify({"error": "Room not found"}), 404
            

@app.route('/api/leave_room', methods=['POST'])
def leave_room():
    """Remove a web player from the game state, reassign host if needed."""
    if not game_state_ref:
        return jsonify({"error": "Game state not linked"}), 500
    
    data = request.json
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    
    if not room_id or not player_name:
        return jsonify({"error": "Missing room_id or player_name"}), 400
    
    stroke_mod = _ensure_stroke_server_module()
    result = game_state_ref.schedule_remove_web_client(room_id, player_name)
    
    # If the active drawer left, wait out the reconnect grace period (3s) and then
    # start a fresh round with the remaining players if they did not return.
    if result.get('was_drawer') and stroke_mod:
        def restart_if_drawer_gone():
            should_restart = False
            room_duration = 60
            with game_state_ref.lock:
                if room_id in game_state_ref.rooms:
                    room = game_state_ref.rooms[room_id]
                    players = room.get('players', {})
                    has_players = len(players) > 0
                    # After delayed removal, drawer is None only if they actually left.
                    drawer_missing = room.get('drawer') is None
                    round_inactive = not room.get('round_active', False)
                    room_duration = room.get('room_duration', 60)
                    should_restart = has_players and drawer_missing and round_inactive

            if should_restart:
                import json as _json
                from protocol import Protocol as _Proto
                sys_msg = _json.dumps({
                    _Proto.ACTION: _Proto.CHAT,
                    _Proto.PAYLOAD: f"SYSTEM: The drawer ({player_name}) left! Starting next round..."
                })
                stroke_mod.broadcast(room_id, sys_msg)
                stroke_mod.handle_start_game(room_id, None, duration=room_duration)
        
        import threading
        # Must be greater than GameState's 3.0s disconnect grace timer.
        t = threading.Timer(3.2, restart_if_drawer_gone)
        t.daemon = True
        t.start()
    
    return jsonify({"status": "left" if result.get('removed') else "not_found"})

@app.route('/api/send_stroke', methods=['POST'])
def send_stroke():
    """Accept a stroke from a web drawer and broadcast to TCP clients."""
    stroke_mod = _ensure_stroke_server_module()
    if not game_state_ref or not stroke_mod:
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
    stroke_mod.broadcast(room_id, stroke_json)
    
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
    stroke_mod = _ensure_stroke_server_module()
    if not game_state_ref or not stroke_mod:
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
    stroke_mod.broadcast(room_id, clear_msg)
    
    return jsonify({"status": "cleared"})
