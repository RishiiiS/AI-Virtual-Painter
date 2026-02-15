import threading
import random
import json
import time

class GameState:
    def __init__(self):
        # Structure: { room_id: { 'clients': [conn], 'history': [json_stroke_str], 'score': {} } }
        self.rooms = {}
        self.lock = threading.RLock()

    def create_room_if_missing(self, room_id):
        with self.lock:
            if room_id not in self.rooms:
                self.rooms[room_id] = {
                    'clients': [], 
                    'history': [], 
                    'score': {},
                    'current_word': None,
                    'guessed_players': set(),
                    'round_active': False,
                    'drawer': None,
                    'drawer_queue': [], # List of names
                    'round_start_time': 0,
                    'round_duration': 60,
                    'chat_history': [],
                    'latest_video_frame': None
                }
                print(f"Created new room: {room_id}")

    # ... (add_client, remove_client, etc. remain same, skipping to select_drawer) ...

    def select_drawer(self, room_id):
        with self.lock:
            if room_id in self.rooms and 'players' in self.rooms[room_id]:
                room = self.rooms[room_id]
                
                # Check Queue
                if not room['drawer_queue']:
                    # Refill Queue (Round Robin)
                    # We use insertion order from players dict values
                    # Or sort by name for consistency? User said "repeat same queue".
                    # Let's verify existing players.
                    current_player_names = [p['name'] for p in room['players'].values()]
                    
                    if not current_player_names:
                        return None
                        
                    # Sort to ensure consistent order across resets? 
                    # Or just shuffle once? 
                    # "one by one then repeat".
                    # Let's just take current players.
                    room['drawer_queue'] = list(current_player_names)
                    # Optional: Shuffle if it's a fresh queue? 
                    # User didn't explicitly ask for random, but usually games are random order then repeat.
                    # Let's keep it simple: Sorted or Insertion. 
                    # Python dict preserves insertion order since 3.7.
                    
                # Pop next
                # Validate player is still here
                while room['drawer_queue']:
                    next_drawer = room['drawer_queue'].pop(0)
                    # Check if this player is still in room
                    player_exists = False
                    for p in room['players'].values():
                        if p['name'] == next_drawer:
                            player_exists = True
                            break
                    
                    if player_exists:
                         room['drawer'] = next_drawer
                         return next_drawer
                
                # If we ran out (everyone in queue left), try to refill immediately
                # (Recursive call one level deep effectively)
                # But let's just fail safe
                return None
                
        return None

    def start_timer(self, room_id, duration, callback):
        # Cancel existing if any
        self.cancel_timer(room_id)
        
        with self.lock:
            if room_id in self.rooms:
                print(f"Starting {duration}s timer for {room_id}")
                timer = threading.Timer(duration, callback, args=[room_id])
                self.rooms[room_id]['timer'] = timer
                self.rooms[room_id]['round_start_time'] = time.time()
                self.rooms[room_id]['round_duration'] = duration
                timer.start()

    def get_time_remaining(self, room_id):
        with self.lock:
            if room_id in self.rooms and self.rooms[room_id].get('round_active'):
                start = self.rooms[room_id].get('round_start_time', 0)
                duration = self.rooms[room_id].get('round_duration', 60)
                elapsed = time.time() - start
                remaining = max(0, duration - elapsed)
                return int(remaining)
        return 0


    def add_client(self, room_id, conn, player_name="Unknown"):
        self.create_room_if_missing(room_id)
        with self.lock:
            # Check if player is already in (by connection)
            # Actually, we might have multiple players with same name? Let's allow for now.
            
            # Use connection as key for metadata
            # Structure: players = { conn: {'name': '...', 'score': 0, 'is_host': ...} }
            
            if 'players' not in self.rooms[room_id]:
                self.rooms[room_id]['players'] = {}
            
            if conn not in self.rooms[room_id]['clients']:
                self.rooms[room_id]['clients'].append(conn)
            
            # Determine if host (first player is host)
            is_host = len(self.rooms[room_id]['players']) == 0
            
            self.rooms[room_id]['players'][conn] = {
                'name': player_name,
                'score': 0,
                'is_host': is_host,
                'is_ready': is_host # Host is implicitly ready (or doesn't matter)
            }
            
            print(f"Added player {player_name} to {room_id} (Host: {is_host})")

    def set_player_ready(self, room_id, conn, is_ready):
        """Set ready status for ALL connections with the same player name."""
        with self.lock:
            if room_id in self.rooms and 'players' in self.rooms[room_id]:
                if conn in self.rooms[room_id]['players']:
                    player_name = self.rooms[room_id]['players'][conn]['name']
                    # Update ALL connections for this player name
                    for c, p in self.rooms[room_id]['players'].items():
                        if p['name'] == player_name:
                            p['is_ready'] = is_ready
                    print(f"Player {player_name} ready: {is_ready}")

    def are_all_players_ready(self, room_id):
        """Check readiness by unique player name, not per-connection."""
        with self.lock:
            if room_id not in self.rooms:
                return False
            
            players = self.rooms[room_id].get('players', {})
            
            # Build unique player map: name -> {is_host, is_ready}
            unique_players = {}
            for p in players.values():
                name = p['name']
                if name not in unique_players:
                    unique_players[name] = {'is_host': p['is_host'], 'is_ready': p.get('is_ready', False)}
                else:
                    # If ANY connection is host, player is host
                    if p['is_host']:
                        unique_players[name]['is_host'] = True
                    # If ANY connection is ready, player is ready
                    if p.get('is_ready', False):
                        unique_players[name]['is_ready'] = True
            
            if len(unique_players) < 2:
                return False
            
            for info in unique_players.values():
                if not info['is_host'] and not info['is_ready']:
                    return False
            
            return True

    def remove_client(self, room_id, conn):
        with self.lock:
            if room_id in self.rooms:
                if conn in self.rooms[room_id]['clients']:
                    self.rooms[room_id]['clients'].remove(conn)
                if 'players' in self.rooms[room_id] and conn in self.rooms[room_id]['players']:
                    del self.rooms[room_id]['players'][conn]
                    
                # If host left, assign new host? For now, keep it simple.

    def add_web_client(self, room_id, player_name):
        """Register a web player using a string key (no TCP socket)."""
        self.create_room_if_missing(room_id)
        with self.lock:
            if 'players' not in self.rooms[room_id]:
                self.rooms[room_id]['players'] = {}
            
            web_key = f"web_{player_name}"
            
            # Check if already registered
            if web_key in self.rooms[room_id]['players']:
                return web_key  # Already registered
            
            # Determine if host (first player is host)
            is_host = len(self.rooms[room_id]['players']) == 0
            
            self.rooms[room_id]['players'][web_key] = {
                'name': player_name,
                'score': 0,
                'is_host': is_host,
                'is_ready': is_host
            }
            
            print(f"Added web player {player_name} to {room_id} (Host: {is_host})")
            return web_key

    def is_web_drawer(self, room_id, player_name):
        """Check if a web player (by name) is the current drawer."""
        with self.lock:
            if room_id in self.rooms:
                room = self.rooms[room_id]
                if not room.get('round_active', False):
                    return True  # Allow drawing in lobby
                return room.get('drawer') == player_name
        return False

    def get_player_name_by_key(self, room_id, key):
        """Get player name from any key (socket or string)."""
        with self.lock:
            if room_id in self.rooms and 'players' in self.rooms[room_id]:
                if key in self.rooms[room_id]['players']:
                    return self.rooms[room_id]['players'][key]['name']
        return None

    def add_stroke(self, room_id, stroke_data):
        with self.lock:
            if room_id in self.rooms:
                self.rooms[room_id]['history'].append(stroke_data)

    def append_chat(self, room_id, message):
        with self.lock:
            if room_id in self.rooms:
                # Store tuple: (timestamp, message) or just message?
                # Just message for now, simple string or dict
                self.rooms[room_id]['chat_history'].append(message)
                # Cap history? 
                if len(self.rooms[room_id]['chat_history']) > 100:
                    self.rooms[room_id]['chat_history'].pop(0)

    def update_video_frame(self, room_id, frame_data):
        # frame_data is base64 string
        # No lock needed for simple assignment? safer with lock
        with self.lock:
            if room_id in self.rooms:
                 self.rooms[room_id]['latest_video_frame'] = frame_data

    def get_video_frame(self, room_id):
        with self.lock:
            if room_id in self.rooms:
                return self.rooms[room_id].get('latest_video_frame')
        return None

    def get_clients(self, room_id):
        with self.lock:
            if room_id in self.rooms:
                # Return a copy to avoid race conditions during iteration
                return list(self.rooms[room_id]['clients'])
            return []

    def get_history(self, room_id):
        with self.lock:
            if room_id in self.rooms:
                return list(self.rooms[room_id]['history'])
            return []
            
    def is_host(self, room_id, conn):
        with self.lock:
            if room_id in self.rooms and 'players' in self.rooms[room_id]:
                 if conn in self.rooms[room_id]['players']:
                     return self.rooms[room_id]['players'][conn]['is_host']
        return False
        
    def set_round_active(self, room_id, active):
        with self.lock:
             if room_id in self.rooms:
                 self.rooms[room_id]['round_active'] = active
                 if active:
                     self.rooms[room_id]['guessed_players'] = set()
                 
    def is_round_active(self, room_id):
        with self.lock:
            return self.rooms.get(room_id, {}).get('round_active', False)

    def set_word(self, room_id, word):
        with self.lock:
            if room_id in self.rooms:
                self.rooms[room_id]['current_word'] = word

    def get_word(self, room_id):
        with self.lock:
            return self.rooms.get(room_id, {}).get('current_word')

    def select_drawer(self, room_id):
        with self.lock:
            if room_id in self.rooms and 'players' in self.rooms[room_id]:
                room = self.rooms[room_id]
                
                # Check Queue
                if not room.get('drawer_queue'):
                    # Refill Queue (Round Robin)
                    # We use insertion order from players dict values
                    current_player_names = []
                    seen = set()
                    for p in room['players'].values():
                        name = p['name']
                        if name not in seen:
                            current_player_names.append(name)
                            seen.add(name)
                            
                    if not current_player_names:
                        return None
                        
                    room['drawer_queue'] = list(current_player_names)
                    print(f"Refilled drawer queue for {room_id}: {room['drawer_queue']}")
                    
                # Pop next
                # Validate player is still here
                while room['drawer_queue']:
                    next_drawer = room['drawer_queue'].pop(0)
                    # Check if this player is still in room
                    player_exists = False
                    for p in room['players'].values():
                        if p['name'] == next_drawer:
                            player_exists = True
                            break
                    
                    if player_exists:
                         room['drawer'] = next_drawer
                         return next_drawer
                
                # If list exhausted (all left), fallback
                return None
        return None
        
    def is_drawer(self, room_id, conn):
        with self.lock:
            if room_id in self.rooms:
                room = self.rooms[room_id]
                
                # Allow everyone to draw in lobby (when round is not active)
                if not room.get('round_active', False):
                    return True

                drawer_name = room.get('drawer')
                if not drawer_name:
                    return True # Should not happen if round is active, but fallback
                
                if 'players' in room and conn in room['players']:
                    return room['players'][conn]['name'] == drawer_name
        return False

    def cleanup_empty_rooms(self):
        # Optional: remove rooms with no clients
        pass

    def end_round(self, room_id):
        with self.lock:
            if room_id not in self.rooms:
                return None
            
            room = self.rooms[room_id]
            if not room.get('round_active'):
                return None

            # 1. Drawer Bonus
            # Bonus ONLY if they used "gesture" mode at least once
            drawer_name = room.get('drawer')
            if drawer_name:
                used_gesture = False
                for s_str in room.get('history', []):
                    # Check if stroke belongs to current round? 
                    try:
                        s = json.loads(s_str)
                        if s.get('mode') == 'gesture':
                            used_gesture = True
                            break
                    except:
                        pass
                
                # Bonus Amount
                bonus = 50 if used_gesture else 0
                
                if bonus > 0:
                    # Update ALL connections for this drawer name
                    for data in room['players'].values():
                        if data['name'] == drawer_name:
                            data['score'] += bonus
                         
            # 2. Prepare Score Summary (Unique Players)
            unique_scores = {} # name -> score
            for data in room['players'].values():
                name = data['name']
                score = data['score']
                # Keep the max score if there's a discrepancy (though sync should prevent it)
                if name not in unique_scores or score > unique_scores[name]:
                    unique_scores[name] = score
            
            scores = [(name, score) for name, score in unique_scores.items()]
            
            # Sort by score desc
            scores.sort(key=lambda x: x[1], reverse=True)
            
            # Reset Round State
            room['round_active'] = False
            room['guessed_players'] = set()
            
            room['drawer'] = None  # Clear drawer so video stops broadcasting in lobby
            self.cancel_timer(room_id) # Ensure timer is cancelled if round ends manually
            
            return scores

    def start_timer(self, room_id, duration, callback):
        # Cancel existing if any
        self.cancel_timer(room_id)
        
        with self.lock:
            if room_id in self.rooms:
                print(f"Starting {duration}s timer for {room_id}")
                timer = threading.Timer(duration, callback, args=[room_id])
                self.rooms[room_id]['timer'] = timer
                self.rooms[room_id]['round_start_time'] = time.time()
                self.rooms[room_id]['round_duration'] = duration
                timer.start()

    def get_time_remaining(self, room_id):
        with self.lock:
            if room_id in self.rooms and self.rooms[room_id].get('round_active'):
                start = self.rooms[room_id].get('round_start_time', 0)
                duration = self.rooms[room_id].get('round_duration', 60)
                elapsed = time.time() - start
                remaining = max(0, duration - elapsed)
                return int(remaining)
        return 0

    def cancel_timer(self, room_id):
        with self.lock:
            if room_id in self.rooms:
                timer = self.rooms[room_id].get('timer')
                if timer:
                    timer.cancel()
                    self.rooms[room_id]['timer'] = None
                    print(f"Cancelled timer for {room_id}")

    def get_player_name(self, room_id, conn):
        with self.lock:
             if room_id in self.rooms and 'players' in self.rooms[room_id]:
                if conn in self.rooms[room_id]['players']:
                    return self.rooms[room_id]['players'][conn]['name']
        return "Unknown"

    def get_drawer_name(self, room_id):
        with self.lock:
            if room_id in self.rooms:
                return self.rooms[room_id].get('drawer')
        return None

    def process_guess(self, room_id, conn, guess):
        with self.lock:
            if room_id not in self.rooms:
                return "error", None
            
            room = self.rooms[room_id]
            if not room.get('round_active'):
                return "chat", None # Just chat if no game
                
            current_word = room.get('current_word')
            if not current_word:
                return "chat", None
                
            # Check if sender is drawer
            drawer_name = room.get('drawer')
            player_name = self.get_player_name(room_id, conn) # Verify we can call this inside lock? 
            # Wait, get_player_name takes lock. recursive lock? 
            # RLock is needed if we call internal methods that take lock.
            # `self.lock = threading.Lock()` is standard lock. 
            # So I should copy logic or use RLock. 
            # For simplicity, I will access dict directly since I already hold lock here.
            
            if 'players' in room and conn in room['players']:
                player_data = room['players'][conn]
                player_name = player_data['name']
            else:
                return "error", None

            if player_name == drawer_name:
                return "chat", None # Drawer can't guess
                
            # Check if already guessed
            if conn in room['guessed_players']:
                return "chat", None # Already guessed, just chat (or block?)

            # Check matching
            if guess.strip().lower() == current_word.lower():
                # CORRECT GUESS
                # Use Name for tracking uniqueness
                if player_name not in room['guessed_players']:
                    room['guessed_players'].add(player_name)
                    # Score Guesser
                    player_data['score'] += 10
                    
                    # Score Drawer
                    drawer_conn = None
                    for c, data in room['players'].items():
                        if data['name'] == drawer_name:
                            data['score'] += 10 # +10 for drawer per correct guess
                            drawer_conn = c
                            # break # Don't break, in case drawer has multiple connections (score all? No just once)
                            # Actually, score is stored in data dict. If multiple connections share same score object?
                            # No, currently new dict per connection.
                            # We should find ALL connections for drawer and update score? 
                            # Or just update one and assume sync? 
                            # Step 1: Just update the current iteration. 
                            # Better: Score is associated with player name in a robust system. 
                            # Here, simplistic: Update ALL matching names?
                            break 
                    
                    # Update score for ALL connections with same name (to keep sync)
                    for c, data in room['players'].items():
                        if data['name'] == player_name:
                             data['score'] = player_data['score']
                        if data['name'] == drawer_name:
                             # We already added +10 to one instance. 
                             # Let's just ensure drawer score is consistent if we had central score.
                             # For now, simplistic approach: 
                             pass

                # Check if ALL guessers have guessed
                # Total UNIQUE players
                unique_player_names = set()
                for data in room['players'].values():
                    unique_player_names.add(data['name'])
                
                total_players = len(unique_player_names)
                # Drawer is one unique name
                total_guessers = total_players - 1 if total_players > 0 else 0
                
                if len(room['guessed_players']) >= total_guessers and total_guessers > 0:
                    return "round_over", 10
                
                return "correct", 10
            
            return "chat", None
