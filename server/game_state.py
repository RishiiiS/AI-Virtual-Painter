import threading
import random

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
                    'drawer': None
                }
                print(f"Created new room: {room_id}")

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
                'is_host': is_host
            }
            
            print(f"Added player {player_name} to {room_id} (Host: {is_host})")

    def remove_client(self, room_id, conn):
        with self.lock:
            if room_id in self.rooms:
                if conn in self.rooms[room_id]['clients']:
                    self.rooms[room_id]['clients'].remove(conn)
                if 'players' in self.rooms[room_id] and conn in self.rooms[room_id]['players']:
                    del self.rooms[room_id]['players'][conn]
                    
                # If host left, assign new host? For now, keep it simple.


    def add_stroke(self, room_id, stroke_data):
        with self.lock:
            if room_id in self.rooms:
                self.rooms[room_id]['history'].append(stroke_data)

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
                # Get unique player names preserving insertion (join) order
                ordered_names = []
                seen = set()
                for p in self.rooms[room_id]['players'].values():
                    name = p['name']
                    if name not in seen:
                        ordered_names.append(name)
                        seen.add(name)
                
                if not ordered_names:
                    return None
                    
                current_drawer = self.rooms[room_id].get('drawer')
                next_drawer = None
                
                if current_drawer and current_drawer in ordered_names:
                    current_idx = ordered_names.index(current_drawer)
                    next_idx = (current_idx + 1) % len(ordered_names)
                    next_drawer = ordered_names[next_idx]
                else:
                    # First round or current drawer left
                    # User requested: "first person who creates the room is the first drawer"
                    # ordered_names[0] is the first person who joined (and is still connected)
                    next_drawer = ordered_names[0]

                self.rooms[room_id]['drawer'] = next_drawer
                return next_drawer
        return None
        
    def is_drawer(self, room_id, conn):
        with self.lock:
            if room_id in self.rooms:
                room = self.rooms[room_id]
                # If round is not active, maybe anyone can draw? Or no one?
                # User req says: "When server receives a stroke: Check if sender == current drawer"
                # If round is NOT active (lobby), maybe allow all?
                # Let's strictly follow "Enforce drawer-only drawing" for now.
                # If NO drawer assigned, maybe return True (lobby)?
                
                drawer_name = room.get('drawer')
                if not drawer_name:
                    return True # Lobby mode / No game active
                
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

            # 1. Drawer Bonus (+50)
            drawer_name = room.get('drawer')
            if drawer_name:
                # Update ALL connections for this drawer name
                for data in room['players'].values():
                    if data['name'] == drawer_name:
                         data['score'] += 50
                         
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
            
            room['drawer'] = None 
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
                timer.start()

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
