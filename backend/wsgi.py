import eventlet
eventlet.monkey_patch()

import sys
import os

# Add the backend directory to path so 'backend.server.admin' resolves
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.server.admin import app, socketio, game_state_ref
from backend.server import stroke_server

# 1. Unify the game states so stroke_server and admin use the exact same instance
stroke_server.game_state = game_state_ref

# 2. Tell stroke_server about the admin module so it doesn't try to circular import later
import sys
from backend.server import admin
sys.modules['admin'] = admin

# 3. Start the TCP stroke server in the background using eventlet
import eventlet
eventlet.spawn(stroke_server.start_tcp_server_only)

if __name__ == "__main__":
    socketio.run(app, debug=False, host='0.0.0.0', port=5001)
