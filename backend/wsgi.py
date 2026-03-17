import os
import threading

import eventlet

eventlet.monkey_patch()

from backend.server.admin import app
from backend.server import admin
from backend.server import stroke_server
from backend.server.game_state import GameState

# Ensure admin and stroke server use the same in-memory GameState instance.
if admin.game_state_ref is None:
    admin.game_state_ref = GameState()
stroke_server.game_state = admin.game_state_ref
admin.stroke_server_module = stroke_server

_tcp_started = False
_tcp_lock = threading.Lock()


def _start_tcp_server_once():
    global _tcp_started
    with _tcp_lock:
        if _tcp_started:
            return
        _tcp_started = True
    eventlet.spawn(stroke_server.start_tcp_server_only)


# Start the TCP server sidecar when this WSGI app is imported.
if os.getenv("ENABLE_STROKE_TCP", "0") == "1":
    _start_tcp_server_once()


if __name__ == "__main__":
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    port = int(os.getenv("BACKEND_PORT", "5001"))
    from backend.server.admin import socketio

    socketio.run(app, host=host, port=port, debug=False)
