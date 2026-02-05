import json
import socket

class StrokeSender:
    def __init__(self, host='localhost', port=8080):
        self.address = (host, port)
        try:
            self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.client_socket.connect(self.address)
            print(f"Connected to {host}:{port}")
        except ConnectionRefusedError:
            print(f"Connection to {host}:{port} failed. Is the server running?")
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
