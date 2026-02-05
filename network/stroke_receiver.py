import socket
import json
import threading
from queue import Queue

class StrokeReceiver:
    def __init__(self, host='localhost', port=8080):
        self.address = (host, port)
        self.running = False
        self.stroke_queue = Queue()
        self.client_socket = None
        
    def connect(self):
        try:
            self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.client_socket.connect(self.address)
            self.running = True
            
            # Start listening thread
            receive_thread = threading.Thread(target=self._receive_loop)
            receive_thread.daemon = True
            receive_thread.start()
            print(f"Receiver connected to {self.address}")
            return True
        except ConnectionRefusedError:
            print(f"Receiver failed to connect to {self.address}")
            return False

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
                            stroke = json.loads(message)
                            self.stroke_queue.put(stroke)
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
