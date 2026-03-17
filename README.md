# 🎨 DoodleDASH - AI-Powered Virtual Painter

**DoodleDASH** is a real-time, multiplayer "Pictionary-style" game where players draw using **hand gestures** via their webcam or a mouse, while others guess the word.

It features **AI-powered hand tracking**, **WebRTC video chat**, and a **live synchronized canvas**.

---

## 🚀 Features

- **✌️ AI Hand Gesture Drawing**: utilize your webcam to draw in mid-air!
  - **Index Finger (☝️)**: Draw
  - **Index + Middle (✌️)**: Hover / Move Cursor
  - **Open Palm (🖐️)**: Eraser
- **🎥 Live Video Chat**: See your friends while playing (powered by WebRTC Mesh network).
- **🎨 Real-time Canvas**: Strokes are synchronized instantly to all players via Socket.IO.
- **⏱️ Dynamic Game Loop**:
  - Lobby system with avatars and nicknames.
  - Host controls (Round Duration: 60s / 90s / 120s).
  - Turn-based drawing and guessing.
  - Automated scoring and winner announcement.
- **🔊 Immersive Audio**: Smart sound effects for clicks and ticking timer.

---

## 🛠️ Tech Stack

### **Frontend**
- **React 19** (Vite)
- **MediaPipe Hands** (Google's ML solution for hand tracking)
- **WebRTC** (Peer-to-peer video streaming)
- **Socket.IO Client** (Real-time signaling)

### **Backend**
- **Python 3.10+**
- **Flask** & **Flask-SocketIO** (Game server & Signaling)
- **OpenCV** & **MediaPipe Python** (Server-side validation/processing)
- **NumPy**

---

## 📦 Installation

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### 1. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install
```

---

## 🎮 How to Run (Local)

1. **Start the Backend Server**
   ```bash
   # From project root
   python -m gunicorn -k eventlet -w 1 --bind 0.0.0.0:5001 backend.wsgi:app
   ```
   *Runs on `localhost:5001` (API + Socket.IO).*
   *Optional raw TCP stroke server on port `8080`: set `ENABLE_STROKE_TCP=1`.*

2. **Start the Frontend**
   ```bash
   # From /frontend directory
   cp .env.example .env   # first time only (adjust if needed)
   npm run dev
   ```
   *Runs on `localhost:5173`.*

3. **Play!**
   - Open `http://localhost:5173` in your browser.
   - Create a room as Host.
   - Open a new tab (or send the Room ID to a friend) to join.
   - Host selects duration (e.g., 90s) and clicks **Start Game**.

---

## 🕹️ Controls

| Mode | Action | Input |
|------|--------|-------|
| **Mouse** | Draw | Left Click + Drag |
| | Stop Drawing | Release Click |
| **Gesture** | Draw | Raise **Index Finger** ☝️ |
| | Move Cursor | Raise **Index + Middle** ✌️ |
| | Erase | Open **Palm** 🖐️ |
| **Shortcuts** | Toggle Mode | Press **'G'** for Gesture, **'M'** for Mouse |

---

## 📂 Project Structure

```
AI-Virtual-Painter/
├── backend/
│   ├── server/
│   │   ├── stroke_server.py    # Main game server (Socket.IO)
│   │   ├── game_state.py       # Game logic & state management
│   │   ├── admin.py            # HTTP API endpoints
│   ├── AI_engine/              # Hand tracking (Python prototype)
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/         # React UI components (Canvas, Header, etc.)
    │   ├── hooks/
    │   │   └── useHandTracking.js # MediaPipe integration
    │   ├── utils/
    │   │   └── SoundManager.js # Audio controller
    │   ├── api.js              # Backend API calls
    │   ├── signaling.js        # WebRTC signaling logic
    │   ├── Game.jsx            # Main game loop
    │   └── App.jsx             # Routing & Global Layout
    └── package.json
```

---

## 🐛 Troubleshooting

- **Camera blocked?** Ensure you allow camera permissions in the browser.
- **Video lagging?** WebRTC creates a mesh network; performance depends on your network upload speed.
- **Port already in use?**
  ```bash
  lsof -ti :8080 | xargs kill -9
  ```

## 🌐 Deployment Notes

- Backend entrypoint is `backend.wsgi:app`.
- Frontend reads backend URL from `VITE_BACKEND_ORIGIN`.
  - Local default: `http://localhost:5001`
  - Production recommended: same domain as frontend API host.
- Use a single backend worker for in-memory game state consistency:
  ```bash
  gunicorn -k eventlet -w 1 --bind 0.0.0.0:${PORT:-5001} backend.wsgi:app
  ```
- Optional environment variables:
  - `BACKEND_HOST` / `BACKEND_PORT` (when running `python backend/wsgi.py`)
  - `ENABLE_STROKE_TCP=1` to enable raw TCP stroke server
  - `STROKE_HOST` / `STROKE_PORT` for raw TCP stroke server bind

---
