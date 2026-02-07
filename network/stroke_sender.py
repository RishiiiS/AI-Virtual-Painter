import json
import socket

class StrokeSender:
    def __init__(self, host='localhost', port=8080, room_id='default', player_name='Unknown'):
        self.address = (host, port)
        self.room_id = room_id
        self.player_name = player_name
        try:
            self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.client_socket.connect(self.address)
            print(f"Connected to {host}:{port}")
            self._send_handshake()
        except ConnectionRefusedError:
            print(f"Connection to {host}:{port} failed. Is the server running?")
            self.client_socket = None

    def _send_handshake(self):
        handshake = {"action": "join", "room_id": self.room_id, "player_name": self.player_name}
        try:
            msg = json.dumps(handshake) + "\n"
            self.client_socket.sendall(msg.encode('utf-8'))
        except Exception as e:
            print(f"Handshake failed: {e}")
            self.client_socket = None

    def send_stroke(self, stroke: dict):
        if self.client_socket:
            try:
                json_stroke = json.dumps(stroke) + "\n" # Add newline as delimiter
                self.client_socket.sendall(json_stroke.encode('utf-8'))
                return json_stroke
            except Exception as e:
                print(f"Error sending data: {e}")
                return None
        return None
