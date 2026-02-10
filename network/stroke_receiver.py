import socket
import json
import threading
from queue import Queue
import base64
import numpy as np
import cv2

class StrokeReceiver:
    def __init__(self, host='localhost', port=8080, room_id='default', player_name='Unknown'):
        self.address = (host, port)
        self.room_id = room_id
        self.player_name = player_name
        self.running = False
        self.stroke_queue = Queue()
        self.video_queue = Queue(maxsize=2) # Keep it fresh
        self.client_socket = None
        self.current_drawer = None
        self.current_word = None
        self.round_end_time = None
        
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
                data = self.client_socket.recv(4096) # Increase buffer for video
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
                            if action == "video_frame":
                                try:
                                    payload = msg.get("payload")
                                    # Decode Base64 to Bytes
                                    img_bytes = base64.b64decode(payload)
                                    # Decode Image (Fast enough? If not, move to main thread. 
                                    # But main thread is busy drawing. 
                                    # Let's decode here. 320x180 JPEG is small.)
                                    # Convert bytes to numpy array
                                    nparr = np.frombuffer(img_bytes, np.uint8)
                                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                                    
                                    if frame is not None:
                                        # Push to queue (Drop old if full to keep low latency)
                                        if self.video_queue.full():
                                            try:
                                                self.video_queue.get_nowait()
                                            except:
                                                pass
                                        self.video_queue.put(frame)
                                except Exception as e:
                                    # print(f"Video decode error: {e}") 
                                    pass # drop frame
                                    
                            elif action == "drawer_assign":
                                self.current_drawer = msg.get("player_name")
                                print(f"New Drawer: {self.current_drawer}")
                            elif action == "game_start":
                                print("Game Started!")
                                duration = msg.get("payload", 60)
                                import time
                                self.round_end_time = time.time() + float(duration)
                            elif action == "your_word":
                                self.current_word = msg.get("payload")
                                print(f"YOUR WORD: {self.current_word}")
                            elif action == "round_over":
                                self.current_drawer = None
                                self.current_word = None
                                self.round_end_time = None
                                print("\n=== ROUND OVER ===")
                                # Inject Clear Canvas command
                                self.stroke_queue.put({"action": "clear_canvas"})
                            elif action == "chat":
                                payload = msg.get("payload")
                                print(f"\n[CHAT] {payload}\n")
                            else:
                                # Assume it's a stroke or other data
                                self.stroke_queue.put(msg)
                                
                        except json.JSONDecodeError:
                            # Might happen if video packet gets split awkwardly? 
                            # But we split by \n, so strictly one line.
                            # Large payloads might exceed recv buffer?
                            # We increased recv to 4096. 
                            # TCP stream ensures we get full bytes eventually, 
                            # but `recv` might return partial chunk.
                            # `buffer += chunk` handles reconstruction.
                            print(f"Receiver JSON error: {message[:50]}...")
                            
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
        
    def get_video_frame(self):
        if not self.video_queue.empty():
            return self.video_queue.get()
        return None

    def close(self):
        self.running = False
        if self.client_socket:
            try:
                self.client_socket.shutdown(socket.SHUT_RDWR)
            except:
                pass
            self.client_socket.close()
