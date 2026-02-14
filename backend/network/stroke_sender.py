import json
import socket
import threading
import queue

class StrokeSender:
    def __init__(self, host='localhost', port=8080, room_id='default', player_name='Unknown'):
        self.address = (host, port)
        self.room_id = room_id
        self.player_name = player_name
        self.client_socket = None
        
        # Unified Output Queue
        # We don't limit size here to avoid blocking 'send_stroke', 
        # but we will manual check size for video frames.
        self.send_queue = queue.Queue()
        self.running = True
        
        try:
            self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.client_socket.connect(self.address)
            print(f"Connected to {host}:{port}")
            
            # Start Network Thread
            # This thread is the ONLY one allowed to write to client_socket
            self.sender_thread = threading.Thread(target=self._network_sender_loop, daemon=True)
            self.sender_thread.start()
            
            # Start Drain Thread
            # We must read from the socket to prevent the server from blocking 
            # when it broadcasts back to us (TCP flow control).
            self.drain_thread = threading.Thread(target=self._socket_drain_loop, daemon=True)
            self.drain_thread.start()
            
            self._send_handshake()
            
        except ConnectionRefusedError:
            print(f"Connection to {host}:{port} failed. Is the server running?")
            self.client_socket = None

    def _send_handshake(self):
        handshake = {"action": "join", "room_id": self.room_id, "player_name": self.player_name}
        self.send_data(handshake)

    def send_data(self, data_dict: dict):
        """
        Non-blocking send. Puts data into queue.
        Returns immediately so UI doesn't freeze.
        """
        if self.client_socket:
            self.send_queue.put(data_dict)

    def send_stroke(self, stroke: dict):
        self.send_data(stroke)
        
    def send_video(self, video_packet: dict):
        """
        Send video frame with Backpressure Logic.
        If the network queue is backing up (e.g., > 5 items), 
        drop this video frame to keep latency low.
        """
        if self.client_socket:
            # Check queue size approx
            if self.send_queue.qsize() < 5:
                self.send_queue.put(video_packet)
            else:
                # Drop frame - Network is too slow
                pass

    def send_ready(self, is_ready: bool):
        """Send READY status update"""
        packet = {
            "action": "ready", # Protocol.READY string value
            "room_id": self.room_id,
            "player_name": self.player_name,
            "payload": is_ready
        }
        self.send_data(packet)

    def _network_sender_loop(self):
        while self.running:
            try:
                # Blocking get - waits effectively for data
                data_dict = self.send_queue.get()
                
                if self.client_socket:
                    try:
                        msg = json.dumps(data_dict) + "\n"
                        self.client_socket.sendall(msg.encode('utf-8'))
                    except Exception as e:
                         print(f"Socket send error: {e}")
                
                self.send_queue.task_done()
            except Exception as e:
                print(f"Sender thread error: {e}")
                
    def _socket_drain_loop(self):
        """Read and discard data to keep TCP window open"""
        while self.running and self.client_socket:
            try:
                data = self.client_socket.recv(4096)
                if not data:
                    break
            except:
                break
                
    def close(self):
        self.running = False
        if self.client_socket:
            try:
                self.client_socket.shutdown(socket.SHUT_RDWR)
                self.client_socket.close()
            except:
                pass
