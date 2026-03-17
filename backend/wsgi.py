import eventlet
eventlet.monkey_patch()

import sys
import os
sys.path.append(os.path.dirname(__file__))

from server.admin import app, socketio

if __name__ == "__main__":
    socketio.run(app, debug=False, host='0.0.0.0', port=5001)
