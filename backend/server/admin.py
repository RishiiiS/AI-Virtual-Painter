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
import word_manager
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Allow all origins for dev simplicity
socketio = SocketIO(app, cors_allowed_origins="*")

# Global game state
game_state_ref = GameState()

# Track drawer Socket.IO SID per room
_drawer_sids = {}  # { room_id: sid }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/state')
def get_state():
    
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
                import time as _time
                start = room_data.get('round_start_time', 0)
                duration = room_data.get('round_duration', 60)
                elapsed = _time.time() - start
                time_remaining = max(0, int(duration - elapsed))

            # Intermission countdown (time until next round starts)
            intermission_remaining = 0
            intermission_end = room_data.get('intermission_end_time')
            if intermission_end and not room_data.get('round_active', False):
                import time as _time2
                intermission_remaining = max(0, int(intermission_end - _time2.time()))

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
    
    frame_data = game_state_ref.get_video_frame(room_id)
    if not frame_data:
        return jsonify({"error": "No video"}), 404
        
    return jsonify({"frame": frame_data})

@app.route('/api/check_room/<room_id>')
def check_room(room_id):
    
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

@socketio.on('start_game')
def handle_socket_start_game(data):
    """Start the game via Socket.IO"""
    room_id = data.get('room_id')
    duration = data.get('duration', 60)
    
    if not game_state_ref.are_all_players_ready(room_id):
        return  # Or emit an error
        
    duration = max(30, min(180, int(duration)))
    threading.Thread(target=handle_start_game, args=(room_id, None), kwargs={'duration': duration}, daemon=True).start()

@socketio.on('chat_message')
def handle_chat_message(data):
    """Process incoming chat messages via Socket.IO"""
    room_id = data.get('room_id')
    sender = data.get('sender', 'Unknown')
    message = data.get('message', '')
    
    if not message or not room_id:
        return
        
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
                
                # Block any message containing the guessing word (case-insensitive)
                if current_word.lower() in message.strip().lower():
                    word_in_message = True

                # Only check guesses from non-drawers who haven't guessed yet
                if not is_drawer:
                    # Already guessed? Block repeat scoring
                    if sender in room.get('guessed_players', set()):
                        guess_result = "already_guessed"
                    elif message.strip().lower() == current_word.lower():
                        # CORRECT GUESS
                        room['guessed_players'].add(sender)
                        
                        # Score the guesser
                        if web_key in room['players']:
                            room['players'][web_key]['score'] += 100
                            room['players'][web_key]['round_score'] = room['players'][web_key].get('round_score', 0) + 100
                        
                        # Score the drawer (+100 per correct guess)
                        for c, pdata in room['players'].items():
                            if pdata['name'] == drawer_name:
                                pdata['score'] += 100
                                pdata['round_score'] = pdata.get('round_score', 0) + 100
                                break
                        
                        # Check if ALL guessers have guessed
                        unique_names = set(pd['name'] for pd in room['players'].values())
                        total_guessers = len(unique_names) - 1
                        
                        if len(room['guessed_players']) >= total_guessers and total_guessers > 0:
                            guess_result = "round_over"
                        else:
                            guess_result = "correct"
    
    # --- Handle results ---
    if word_in_message:
        # If the message is an exact guess, award points and show system message
        if guess_result == "correct":
            sys_msg = json.dumps({
                Protocol.ACTION: Protocol.CHAT,
                Protocol.PAYLOAD: f"SYSTEM: {sender} guessed the word! (+100 pts)"
            })
            socketio.emit('chat_message', sys_msg, to=room_id)
            game_state_ref.append_chat(room_id, f"SYSTEM: {sender} guessed the word! (+100 pts)")
            return
        elif guess_result == "round_over":
            sys_msg = json.dumps({
                Protocol.ACTION: Protocol.CHAT,
                Protocol.PAYLOAD: f"SYSTEM: {sender} guessed it! Everyone found the word!"
            })
            socketio.emit('chat_message', sys_msg, to=room_id)
            game_state_ref.append_chat(room_id, f"SYSTEM: {sender} guessed it! Everyone found the word!")
            threading.Thread(target=finish_round, args=[room_id], daemon=True).start()
            return
        else:
            return # Block silently, do not show original message

    if guess_result == "already_guessed":
        chat_msg = json.dumps({
            Protocol.ACTION: Protocol.CHAT,
            Protocol.PAYLOAD: f"[{sender}]: {message}"
        })
        socketio.emit('chat_message', chat_msg, to=room_id)
        game_state_ref.append_chat(room_id, f"[{sender}]: {message}")
        return
        sys_msg = json.dumps({
            Protocol.ACTION: Protocol.CHAT,
            Protocol.PAYLOAD: f"SYSTEM: {sender} guessed the word! (+100 pts)"
        })
        socketio.emit('chat_message', sys_msg, to=room_id)
        game_state_ref.append_chat(room_id, f"SYSTEM: {sender} guessed the word! (+100 pts)")
        return
        
    if guess_result == "round_over":
        sys_msg = json.dumps({
            Protocol.ACTION: Protocol.CHAT,
            Protocol.PAYLOAD: f"SYSTEM: {sender} guessed it! Everyone found the word!"
        })
        socketio.emit('chat_message', sys_msg, to=room_id)
        game_state_ref.append_chat(room_id, f"SYSTEM: {sender} guessed it! Everyone found the word!")
        # End round early!
        threading.Thread(target=finish_round, args=[room_id], daemon=True).start()
        return

    # Normal chat fallback
    chat_msg = json.dumps({
        Protocol.ACTION: Protocol.CHAT,
        Protocol.PAYLOAD: f"[{sender}]: {message}"
    })
    socketio.emit('chat_message', chat_msg, to=room_id)
    
    game_state_ref.append_chat(room_id, f"[{sender}]: {message}")
@socketio.on('ready_up')
def handle_ready_up(data):
    """Toggle ready status via Socket.IO"""
    room_id = data.get('room_id')
    sender = data.get('sender')
    is_ready = data.get('is_ready', False)
    
    if not sender or not room_id:
        return
        
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
        # Client will fetch the new state via their 1s polling interval!
        pass


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

# ─── Core Game Logic ───

def finish_round(room_id):
    print(f"DEBUG: finish_round called for {room_id}", flush=True)
    try:
        try:
            scores = game_state_ref.end_round(room_id)
        except Exception as e:
            print(f"ERROR in end_round: {e}", flush=True)
            scores = None
            
        if scores is None: return

        print(f"\n=== ROUND OVER: {room_id} ===", flush=True)
        msg_payload = "ROUND OVER! SCORES:\n"
        for entry in scores:
            msg_payload += f"- {entry[0]}: {entry[1]}\n"
        if scores: msg_payload += f"WINNER: {scores[0][0]}"

        # Broadcast Scores
        score_msg = json.dumps({ Protocol.ACTION: Protocol.CHAT, Protocol.PAYLOAD: msg_payload })
        socketio.emit('chat_message', score_msg, to=room_id)
        
        # Broadcast ROUND_OVER
        round_over_msg = json.dumps({ Protocol.ACTION: Protocol.ROUND_OVER })
        socketio.emit('round_over', round_over_msg, to=room_id)
        
        # Auto-Start Next Round in 10 seconds
        room_duration = 60
        with game_state_ref.lock:
            if room_id in game_state_ref.rooms:
                room_duration = game_state_ref.rooms[room_id].get('room_duration', 60)
                game_state_ref.rooms[room_id]['intermission_end_time'] = time.time() + 10.0
        
        t = threading.Timer(10.0, handle_start_game, args=[room_id, None], kwargs={'duration': room_duration}) 
        t.daemon = True
        t.start()
    except Exception as e:
        print(f"CRITICAL ERROR in finish_round: {e}", flush=True)

def handle_time_expiry(room_id):
    print(f"Timer expired for {room_id}")
    msg = json.dumps({ Protocol.ACTION: Protocol.CHAT, Protocol.PAYLOAD: "SYSTEM: Time's Up! No one guessed the word." })
    socketio.emit('chat_message', msg, to=room_id)
    finish_round(room_id)

def handle_start_game(room_id, sender_name=None, duration=60):
    if game_state_ref.is_round_active(room_id): return
    if len(game_state_ref.rooms.get(room_id, {}).get('players', {})) < 1: return

    game_state_ref.set_round_active(room_id, True)
    
    with game_state_ref.lock:
        if room_id in game_state_ref.rooms:
            game_state_ref.rooms[room_id]['history'] = []
            game_state_ref.rooms[room_id]['last_round_results'] = []
            game_state_ref.rooms[room_id]['last_word'] = None
            for player in game_state_ref.rooms[room_id].get('players', {}).values():
                player['round_score'] = 0
    
    drawer_name = game_state_ref.select_drawer(room_id)
    word = word_manager.get_random_word("easy")
    game_state_ref.set_word(room_id, word)
    
    with game_state_ref.lock:
        if room_id in game_state_ref.rooms:
            game_state_ref.rooms[room_id]['room_duration'] = duration
    game_state_ref.start_timer(room_id, float(duration), handle_time_expiry)

    # Broadcast GAME_START and DRAWER_ASSIGN
    start_msg = json.dumps({ Protocol.ACTION: Protocol.GAME_START, Protocol.PAYLOAD: duration })
    drawer_msg = json.dumps({ Protocol.ACTION: Protocol.DRAWER_ASSIGN, Protocol.PLAYER_NAME: drawer_name })
    word_msg = json.dumps({ Protocol.ACTION: Protocol.YOUR_WORD, Protocol.PAYLOAD: word })

    socketio.emit('game_start', start_msg, to=room_id)
    socketio.emit('drawer_assign', drawer_msg, to=room_id)
    
    # We would theoretically only send YOUR_WORD to the drawer, but since players fetch /api/state 
    # and they check their name against the Drawer, sending the word globally is okay as long as
    # they don't see it (actually, we need to be careful with cheat sniffing). We can store it 
    # internally and fetch if needed, or emit specifically.
    
    # For now, emitting globally as an event, but the frontend only shows it if Drawer.
    # We can refine this securely later using the drawer_sid mapping we built!
    drawer_sid = _drawer_sids.get(room_id)
    if drawer_sid:
         socketio.emit('your_word', word_msg, to=drawer_sid)

# ─── API Routes ───

@app.route('/api/create_room', methods=['POST'])
def create_room():
        
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
    
    data = request.json
    room_id = data.get('room_id')
    player_name = data.get('player_name', 'WebPlayer')
    avatar = data.get('avatar', 'ghost')
    
    if not room_id:
        return jsonify({"error": "No room_id"}), 400
    
    web_key = game_state_ref.add_client(room_id, player_name, avatar)
    
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
    
    data = request.json
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    
    if not room_id or not player_name:
        return jsonify({"error": "Missing room_id or player_name"}), 400
    
    result = game_state_ref.schedule_remove_client(room_id, player_name)
    
    # If the drawer left mid-round, immediately start a new round with remaining players
    if result.get('was_drawer'):
        # Check there are still players in the room
        has_players = False
        with game_state_ref.lock:
            if room_id in game_state_ref.rooms:
                has_players = len(game_state_ref.rooms[room_id].get('players', {})) > 0
        
        if has_players:
            sys_msg = json.dumps({
                Protocol.ACTION: Protocol.CHAT,
                Protocol.PAYLOAD: f"SYSTEM: The drawer ({player_name}) left! Starting a new round..."
            })
            socketio.emit('chat_message', sys_msg, to=room_id)
            
            # Get room duration and start new round immediately
            room_duration = 60
            with game_state_ref.lock:
                if room_id in game_state_ref.rooms:
                    room_duration = game_state_ref.rooms[room_id].get('room_duration', 60)
            
            t = threading.Timer(2.0, handle_start_game, args=[room_id, None], kwargs={'duration': room_duration})
            t.start()
    
    return jsonify({"status": "left" if result.get('removed') else "not_found"})

@socketio.on('draw_stroke')
def handle_draw_stroke(data):
    """Accept a stroke via Socket.IO and broadcast to other clients in room."""
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    stroke = data.get('stroke')  # The stroke data dict
    
    if not room_id or not stroke:
        return
    
    # Validate drawer
    if not game_state_ref.is_drawer(room_id, player_name):
        return
    
    # Serialize and store
    stroke_json = json.dumps(stroke)
    game_state_ref.add_stroke(room_id, stroke_json)
    
    # Broadcast to other clients (sender doesn't need it back)
    socketio.emit('draw_stroke', stroke_json, to=room_id, include_self=False)

@socketio.on('clear_canvas')
def handle_clear_canvas(data):
    """Clear stroke history via Socket.IO and broadcast clear to clients."""
    room_id = data.get('room_id')
    
    if not room_id:
        return
        
    # Clear history
    with game_state_ref.lock:
        if room_id in game_state_ref.rooms:
            game_state_ref.rooms[room_id]['history'] = []
    
    # Broadcast clear command to Socket.IO clients
    clear_msg = json.dumps({"action": "clear"})
    socketio.emit('clear_canvas', clear_msg, to=room_id, include_self=False)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, allow_unsafe_werkzeug=True)
