import socket
import json
import threading

HOST = 'localhost'
PORT = 8080

clients = []

def handle_client(conn, addr):
    print(f"Connected by {addr}")
    clients.append(conn)
    with conn:
        buffer = ""
        while True:
            try:
                data = conn.recv(1024)
                if not data:
                    break
                
                chunk = data.decode('utf-8')
                buffer += chunk
                
                while "\n" in buffer:
                    message, buffer = buffer.split("\n", 1)
                    if message.strip():
                        # Broadcast to all other clients
                        print(f"Broadcasting: {message[:50]}...")
                        broadcast(message, conn)
                        
            except ConnectionResetError:
                break
            except Exception as e:
                print(f"Error handling client {addr}: {e}")
                break
    
    print(f"Disconnected {addr}")
    if conn in clients:
        clients.remove(conn)

def broadcast(message, sender_conn):
    for client in clients:
        if client != sender_conn:
            try:
                client.sendall((message + "\n").encode('utf-8'))
            except Exception as e:
                print(f"Error broadcasting: {e}")
                if client in clients:
                    clients.remove(client)

def start_server():
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
