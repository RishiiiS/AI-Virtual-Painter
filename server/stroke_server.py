import socket
import json
import threading
import sys
import os

# Ensure we can import local modules regardless of how the script is run
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from game_state import GameState
from protocol import Protocol
import word_manager
import admin

HOST = 'localhost'
PORT = 8080

game_state = GameState()

def handle_client(conn, addr):
    print(f"Connected by {addr}")
    room_id = None
    
    try:
        # 1. Wait for Handshake
        buffer = ""
        handshake_done = False
        
        while not handshake_done:
            data = conn.recv(1024)
            if not data:
                return 
            
            chunk = data.decode('utf-8')
            buffer += chunk
            
            if "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                try:
                    handshake = json.loads(line)
                    if handshake.get(Protocol.ACTION) == Protocol.JOIN and Protocol.ROOM_ID in handshake:
                        room_id = str(handshake[Protocol.ROOM_ID])
                        player_name = str(handshake.get(Protocol.PLAYER_NAME, "Unknown"))
                        handshake_done = True
                        print(f"{addr} ({player_name}) joining room {room_id}")
                    else:
                        print(f"Invalid handshake from {addr}: {line}")
                        return
                except json.JSONDecodeError:
                    print(f"Invalid JSON handshake from {addr}")
                    return

        # 2. Join Room
        game_state.add_client(room_id, conn, player_name)
        
        # 3. Send History
        history = game_state.get_history(room_id)
        for old_stroke in history:
            try:
                conn.sendall((old_stroke + "\n").encode('utf-8'))
            except:
                break

        # 3.5 Sync Late Joiner
        if game_state.is_round_active(room_id):
            remaining_time = game_state.get_time_remaining(room_id)
            current_drawer = game_state.get_drawer_name(room_id)
            
            # Send GAME_START with remaining time
            start_msg = json.dumps({
                Protocol.ACTION: Protocol.GAME_START,
                Protocol.PAYLOAD: remaining_time
            })
            conn.sendall((start_msg + "\n").encode('utf-8'))
            
            # Send DRAWER_ASSIGN
            if current_drawer:
                drawer_msg = json.dumps({
                    Protocol.ACTION: Protocol.DRAWER_ASSIGN,
                    Protocol.PLAYER_NAME: current_drawer
                })
                conn.sendall((drawer_msg + "\n").encode('utf-8'))

        # 4. Main Loop (Broadcast)
        while True:
            while "\n" in buffer:
                message, buffer = buffer.split("\n", 1)
                if message.strip():
                    try:
                        data = json.loads(message)
                        if data.get(Protocol.ACTION) == Protocol.START_GAME:
                            handle_start_game(room_id, conn)
                        else:
                             process_message(room_id, message, conn)
                    except json.JSONDecodeError:
                        pass

            data = conn.recv(1024)
            if not data:
                break
            
            chunk = data.decode('utf-8')
            buffer += chunk

    except ConnectionResetError:
        pass
    except Exception as e:
        print(f"Error handling client {addr}: {e}")
    finally:
        print(f"Disconnected {addr}")
        if room_id:
            game_state.remove_client(room_id, conn)

def finish_round(room_id):
    print(f"DEBUG: finish_round called for {room_id}")
    # 1. End Round & Get Scores
    try:
        scores = game_state.end_round(room_id)
    except Exception as e:
        print(f"ERROR in end_round: {e}")
        scores = None
        
    if scores is None: 
        print("DEBUG: end_round returned None (Round not active?)")
        return # Round already ended or invalid

    # 2. Print Scores to Server Console
    print(f"\n=== ROUND OVER: {room_id} ===")
    print("SCORES:")
    msg_payload = "ROUND OVER! SCORES:\n"
    for name, score in scores:
        line = f"- {name}: {score}"
        print(line)
        msg_payload += line + "\n"
    
    if scores:
        winner = scores[0][0]
        print(f"WINNER: {winner}")
        msg_payload += f"WINNER: {winner}"
    print("==========================\n")
    
    # 3. Broadcast Scores
    score_msg = json.dumps({
        Protocol.ACTION: Protocol.CHAT,
        Protocol.PAYLOAD: msg_payload
    })
    broadcast(room_id, score_msg)
    
    # 4. Broadcast ROUND_OVER to reset clients
    print("DEBUG: Broadcasting ROUND_OVER")
    round_over_msg = json.dumps({
        Protocol.ACTION: Protocol.ROUND_OVER
    })
    broadcast(room_id, round_over_msg)
    
    # 5. Auto-Start Next Round in 5 seconds
    print(f"Scheduling next round for {room_id} in 5s...")
    t = threading.Timer(5.0, handle_start_game, args=[room_id, None]) 
    t.start()

def handle_time_expiry(room_id):
    print(f"Timer expired for {room_id}")
    # Broadcast "Time's Up!"
    msg = json.dumps({
        Protocol.ACTION: Protocol.CHAT,
        Protocol.PAYLOAD: "SYSTEM: Time's Up! No one guessed the word."
    })
    broadcast(room_id, msg)
    finish_round(room_id)

def process_message(room_id, message, sender_conn):
    try:
        data = json.loads(message)
        action = data.get(Protocol.ACTION)

        if action == Protocol.CHAT:
            payload = data.get(Protocol.PAYLOAD, "")
            result, points = game_state.process_guess(room_id, sender_conn, payload)
            
            player_name = game_state.get_player_name(room_id, sender_conn)
            
            if result == "correct":
                # System Message
                sys_msg = json.dumps({
                    Protocol.ACTION: Protocol.CHAT,
                    Protocol.PAYLOAD: f"SYSTEM: {player_name} guessed the word! (+10 pts)"
                })
                broadcast(room_id, sys_msg)
            elif result == "round_over":
                 # 1. Announce last guess
                sys_msg = json.dumps({
                    Protocol.ACTION: Protocol.CHAT,
                    Protocol.PAYLOAD: f"SYSTEM: {player_name} guessed the word! (+10 pts)"
                })
                broadcast(room_id, sys_msg)
                
                # 2. Call centralized finish_round
                finish_round(room_id)

            elif result == "chat":
                # Regular Chat
                chat_msg = json.dumps({
                    Protocol.ACTION: Protocol.CHAT,
                    Protocol.PAYLOAD: f"{player_name}: {payload}"
                })
                # Broadcast to EVERYONE (including sender) so they know it was sent/received
                broadcast(room_id, chat_msg, exclude_conn=None)
            return

        # VIDEO FRAME (Stateless, High Frequency)
        if action == Protocol.VIDEO_FRAME:
             # Strict Enforcement: Video ONLY during active rounds
             if not game_state.is_round_active(room_id):
                 return

             # Validate Drawer (Only drawer can stream)
             if not game_state.is_drawer(room_id, sender_conn):
                 return
             
             # Broadcast immediately (No history)
             broadcast(room_id, message, exclude_conn=sender_conn)
             return

        # STROKE or other (Implicitly STROKE for legacy/default)
        # Validate Drawer for Drawing
        if not game_state.is_drawer(room_id, sender_conn):
            return

        # Save to history
        game_state.add_stroke(room_id, message)
        
        # Broadcast Stroke
        broadcast(room_id, message, exclude_conn=sender_conn)

    except json.JSONDecodeError:
        pass

def broadcast(room_id, message, exclude_conn=None):
    clients = game_state.get_clients(room_id)
    # print(f"Broadcasting to {len(clients)} clients in {room_id}")
    for client in clients:
        if client != exclude_conn:
            try:
                client.sendall((message + "\n").encode('utf-8'))
            except Exception as e:
                print(f"Broadcast error: {e}")

def handle_start_game(room_id, sender_conn=None):
    # Validation: Sender must be host OR system (None)
    if sender_conn and not game_state.is_host(room_id, sender_conn):
        print(f"Ignored start_game from non-host in {room_id}")
        return

    if game_state.is_round_active(room_id):
        print(f"Ignored start_game in {room_id} (already active)")
        return
        
    print(f"Starting game in {room_id}")
    game_state.set_round_active(room_id, True)
    
    # 1. Select Drawer
    drawer_name = game_state.select_drawer(room_id)
    print(f"Drawer selected for {room_id}: {drawer_name}")

    # 2. Select Word
    word = word_manager.get_random_word("easy") # Default to easy for now
    game_state.set_word(room_id, word)
    print(f"Word selected for {room_id}: {word}")
    
    # 3. Start Timer (60s)
    game_state.start_timer(room_id, 60.0, handle_time_expiry)

    # 4. Broadcast GAME_START
    start_msg = json.dumps({
        Protocol.ACTION: Protocol.GAME_START,
        Protocol.PAYLOAD: 60
    })
    
    # 5. Broadcast DRAWER_ASSIGN
    drawer_msg = json.dumps({
        Protocol.ACTION: Protocol.DRAWER_ASSIGN,
        Protocol.PLAYER_NAME: drawer_name
    })

    # 6. Send YOUR_WORD (Private to Drawer)
    word_msg = json.dumps({
        Protocol.ACTION: Protocol.YOUR_WORD,
        Protocol.PAYLOAD: word
    })

    clients = game_state.get_clients(room_id)
    for client in clients:
         try:
            client.sendall((start_msg + "\n").encode('utf-8'))
            client.sendall((drawer_msg + "\n").encode('utf-8'))
            
            # Check if this client is the drawer
            if game_state.is_drawer(room_id, client):
                client.sendall((word_msg + "\n").encode('utf-8'))
         except:
            pass

def start_server():
    # Start Admin UI in background
    try:
        print("Starting Admin Admin UI on http://localhost:5001 ...")
        import sys
        # Pass current module so admin can call handle_start_game/finish_round
        admin.run_admin(game_state, sys.modules[__name__]) 
    except Exception as e:
        print(f"Failed to start Admin UI: {e}")

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((HOST, PORT))
        s.listen()
        print(f"Stroke Server listening on {HOST}:{PORT}")
        
        while True:
            conn, addr = s.accept()
            thread = threading.Thread(target=handle_client, args=(conn, addr))
            thread.daemon = True
            thread.start()
    
if __name__ == "__main__":
    start_server()
