import socket
import json
import threading
from queue import Queue

class StrokeReceiver:
    def __init__(self, host='localhost', port=8080, room_id='default', player_name='Unknown'):
        self.address = (host, port)
        self.room_id = room_id
        self.player_name = player_name
        self.running = False
        self.stroke_queue = Queue()
        self.client_socket = None
        self.current_drawer = None
        self.current_word = None
        
    def connect(self):
        try:
            self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.client_socket.connect(self.address)
            self.running = True
            
            self._send_handshake()
            
            # Start listening thread
            receive_thread = threading.Thread(target=self._receive_loop)
            receive_thread.daemon = True
            receive_thread.start()
            print(f"Receiver connected to {self.address}")
            return True
        except ConnectionRefusedError:
            print(f"Receiver failed to connect to {self.address}")
            return False

    def _send_handshake(self):
        handshake = {"action": "join", "room_id": self.room_id, "player_name": self.player_name}
        try:
            msg = json.dumps(handshake) + "\n"
            self.client_socket.sendall(msg.encode('utf-8'))
        except Exception as e:
            print(f"Receiver handshake failed: {e}")
            self.running = False

    def _receive_loop(self):
        buffer = ""
        while self.running and self.client_socket:
            try:
                data = self.client_socket.recv(1024)
                if not data:
                    break
                    
                chunk = data.decode('utf-8')
                buffer += chunk
                
                while "\n" in buffer:
                    message, buffer = buffer.split("\n", 1)
                    if message.strip():
                        try:
                            msg = json.loads(message)
                            
                            # Check for Protocol Actions
                            action = msg.get("action")
                            if action == "drawer_assign":
                                self.current_drawer = msg.get("player_name")
                                print(f"New Drawer: {self.current_drawer}")
                            elif action == "game_start":
                                print("Game Started!")
                            elif action == "your_word":
                                self.current_word = msg.get("payload")
                                print(f"YOUR WORD: {self.current_word}")
                            elif action == "round_over":
                                self.current_drawer = None
                                self.current_word = None
                                print("\n=== ROUND OVER ===")
                            elif action == "chat":
                                payload = msg.get("payload")
                                print(f"\n[CHAT] {payload}\n")
                            else:
                                # Assume it's a stroke or other data
                                self.stroke_queue.put(msg)
                                
                        except json.JSONDecodeError:
                            print(f"Receiver JSON error: {message}")
                            
            except Exception as e:
                if self.running: # Only print error if we weren't trying to close
                    print(f"Receiver loop error: {e}")
                break
        
        print("Receiver loop ended")
        self.running = False
        if self.client_socket:
            self.client_socket.close()

    def get_stroke(self):
        if not self.stroke_queue.empty():
            return self.stroke_queue.get()
        return None

    def close(self):
        self.running = False
        if self.client_socket:
            try:
                self.client_socket.shutdown(socket.SHUT_RDWR)
            except:
                pass
            self.client_socket.close()
