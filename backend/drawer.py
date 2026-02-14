import cv2
import mediapipe as mp
import numpy as np 
import threading 
import os
import time
import sys
import json
import base64

# Add server directory to path to import Protocol
sys.path.append(os.path.join(os.path.dirname(__file__), 'server'))
try:
    from protocol import Protocol
except ImportError:
    pass

import AI_engine.handTracking as htm
from AI_engine.stroke_manager import StrokeManager
from network.stroke_sender import StrokeSender
from network.stroke_receiver import StrokeReceiver
folderPath = "assets/header"
myList = os.listdir(folderPath)
print(myList)

overlayList = []
for imPath in myList:
    if imPath.lower().endswith(('.png', '.jpg', '.jpeg')):
        img = cv2.imread(os.path.join(folderPath, imPath))
        if img is not None:
            overlayList.append(img)

header = overlayList[0]

# -------- WEBCAM STREAM CLASS --------
class WebcamStream:
    def __init__(self, src=0):
        self.stream = None
        self.src = src
        self.stopped = True
        self.thread = None
        self.lock = threading.Lock()

    def start(self):
        if not self.stopped:
            return self
            
        self.stream = cv2.VideoCapture(self.src)
        self.stream.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.stream.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        
        (self.grabbed, self.frame) = self.stream.read()
        if not self.grabbed:
             print("Failed to open camera")
             self.stream.release()
             return self

        self.stopped = False
        self.thread = threading.Thread(target=self.update, args=())
        self.thread.start()
        return self

    def update(self):
        while True:
            if self.stopped:
                return

            (grabbed, frame) = self.stream.read()
            with self.lock:
                self.grabbed = grabbed
                self.frame = frame

    def read(self):
        with self.lock:
            if self.frame is None:
                return False, None
            return self.grabbed, self.frame.copy()

    def stop(self):
        self.stopped = True
        if self.thread is not None and self.thread.is_alive():
            self.thread.join()
        
        if self.stream:
             self.stream.release()

# -------- CAMERA --------
# -------- CAMERA --------
# Initialize Webcam Stream (but don't start yet)
# Initialize Webcam Stream (but don't start yet)
webcam_stream = WebcamStream(src=0)
image_canvas = np.ones((720, 1280, 3), dtype=np.uint8) * 255

# Video Constants
VIDEO_WIDTH = 320
VIDEO_HEIGHT = 180
VIDEO_FPS = 10
VIDEO_INTERVAL = 1.0 / VIDEO_FPS
last_video_time = 0
small_frame_to_send = None 
last_remote_frame = None 
last_remote_frame_time = 0 

# -------- RESIZE HEADER ONCE --------
HEADER_HEIGHT = 100
FRAME_WIDTH = 1280
header = cv2.resize(header, (FRAME_WIDTH, HEADER_HEIGHT))
 
detector = htm.handDetect(min_dect_confidence = 0.85)
strokeManager = StrokeManager()

# Ask for Room ID
import urllib.request
import urllib.error

try:
    player_name = input("Enter Player Name (default: Guest): ").strip()
    if not player_name:
        player_name = "Guest"
    
    print("\n[C] Create Room  |  [J] Join Room")
    choice = input("Choice (c/j): ").strip().lower()
    
    if choice == 'c':
        # Create room via API (same as frontend)
        try:
            req = urllib.request.Request("http://localhost:5001/api/create_room", method='POST')
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            if 'room_id' in data:
                room_id = data['room_id']
                print(f"Room created: {room_id}")
            else:
                print(f"Error: {data.get('error', 'Unknown')}")
                room_id = "room1"
        except Exception as e:
            print(f"API Error (is server running?): {e}")
            room_id = input("Enter Room ID manually: ").strip() or "room1"
    else:
        room_id = input("Enter Room Code: ").strip().upper()
        if not room_id:
            room_id = "room1"
except:
    room_id = "room1"
    player_name = "Guest"

strokeSender = StrokeSender(room_id=room_id, player_name=player_name)
strokeReceiver = StrokeReceiver(room_id=room_id, player_name=player_name)
strokeReceiver.connect()

print("\n" + "="*40)
print(f"       JOINED ROOM: {room_id}")
print(f"       PLAYER: {player_name}")
print("="*40)
print("INSTRUCTIONS:")
print("1. To READY UP: Press 'r'.")
print("2. To START GAME: Press 's' (Host only).")
print("3. To CHAT/GUESS: Type here in the terminal.")
print("="*40 + "\n")


def chat_input_thread():
    print("Chat enabled! Type in console to guess/chat.")
    while True:
        try:
            msg = input()
            if msg.strip():
                chat_packet = {
                    "action": Protocol.CHAT,
                    "room_id": room_id,
                    "player_name": player_name,
                    "payload": msg
                }
                # Use strokeSender to send (Thread Safe)
                strokeSender.send_data(chat_packet)
        except EOFError:
            break
        except Exception as e:
            print(f"Chat Error: {e}")

# Start Chat Thread
chat_thread = threading.Thread(target=chat_input_thread)
chat_thread.daemon = True
chat_thread.start()
selectionColor = (0,0,255)
drawColor = (0, 0, 0) # Default draw color
lineThickNess = 15
Xprev,Yprev = 0,0

# drawing Stroke Locally funtion.
def drawLocally(stroke,img,image_canvas):
    x1,y1 = stroke["x1"],stroke["y1"]
    x2,y2 = stroke["x2"],stroke["y2"]
    color = stroke["color"]
    thickness = stroke["thickness"]
    cv2.line(image_canvas, (x1, y1), (x2, y2), color, thickness)

# -------- MOUSE DRAWING STATE --------
DRAW_MODE = "gesture" # "gesture" or "mouse"
mouse_drawing = False
mouse_x, mouse_y = 0, 0
is_ready = False # Track readiness
mouse_x, mouse_y = 0, 0

def draw_mouse(event, x, y, flags, param):
    global xp, yp, mouse_drawing, DRAW_MODE, is_drawer, drawColor, mouse_x, mouse_y
    
    if DRAW_MODE != "mouse":
        return
        
    if not is_drawer:
        return

    # Event-based drawing for immediate responsiveness
    if event == cv2.EVENT_LBUTTONDOWN:
        mouse_drawing = True
        xp, yp = x, y # Set start point for clean line
        mouse_x, mouse_y = x, y
        print(f"Mouse down at ({x}, {y})")

    elif event == cv2.EVENT_MOUSEMOVE:
        if mouse_drawing:
            # Calculate distance and time
            dist = ((x - xp)**2 + (y - yp)**2)**0.5
            # Throttle: Only draw if moved > 2 pixels
            # We removed time-based throttling to ensure raw event-based smoothness
            if dist > 2:
                # Create Stroke
                stroke = {
                    "x1": xp, "y1": yp, "x2": x, "y2": y,
                    "color": drawColor, "thickness": lineThickNess,
                    "room_id": room_id,
                    "mode": "mouse"
                }
                
                # Draw Locally (Reuse same function as gestures)
                drawLocally(stroke, img, image_canvas)
                
                # Send Stroke
                if strokeSender:
                     strokeSender.send_stroke(stroke)
                
                xp, yp = x, y
                xp, yp = x, y
            mouse_x, mouse_y = x, y

    elif event == cv2.EVENT_LBUTTONUP:
        mouse_drawing = False
        print("Mouse up")

cv2.namedWindow("Image")
cv2.setMouseCallback("Image", draw_mouse)

# -------- MAIN LOOP --------
while True:
    # 0. Determine Role First
    if strokeReceiver.current_drawer:
        is_drawer = (player_name == strokeReceiver.current_drawer)
    else:
        # If no drawer assigned (Lobby/Intermission), default to GUESSER mode (Safety first)
        # This prevents everyone's camera turning on during breaks.
        is_drawer = False 

    # 1. Camera & Video Logic (STRICT SEPARATION)
    if is_drawer:
        # --- DRAWER PATH ---
        # 1. Ensure Camera Running
        if webcam_stream.stopped:
            webcam_stream.start()
        
        # 2. Capture Frame
        success, img = webcam_stream.read()
        if not success or img is None:
            img = np.zeros((720, 1280, 3), dtype=np.uint8)
        else:
            img = cv2.flip(img, 1)
            if img.shape[1] != 1280 or img.shape[0] != 720:
                img = cv2.resize(img, (1280, 720))

        # 3. Send Video (Throttled)
        current_time = time.time()
        if current_time - last_video_time > VIDEO_INTERVAL:
            # Resize
            small_frame_to_send = cv2.resize(img, (VIDEO_WIDTH, VIDEO_HEIGHT))
            
            # Encode
            _, buffer = cv2.imencode('.jpg', small_frame_to_send, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
            jpg_as_text = base64.b64encode(buffer).decode('utf-8')
            
            # Send
            video_packet = {
                "action": Protocol.VIDEO_FRAME,
                "room_id": room_id,
                "player_name": player_name,
                "payload": jpg_as_text
            }
            if strokeSender:
                strokeSender.send_video(video_packet)
            
            last_video_time = current_time

    else:
        # --- GUESSER PATH ---
        # 1. Ensure Camera STOPPED
        if not webcam_stream.stopped:
            webcam_stream.stop()
            
        # 2. Receive Video (Check for new frames)
        new_frame = strokeReceiver.get_video_frame()
        if new_frame is not None:
             last_remote_frame = new_frame
             last_remote_frame_time = time.time()
        
        # 3. Timeout Cleanup (3s)
        if time.time() - last_remote_frame_time > 3.0:
            last_remote_frame = None

        # 4. Dummy Img (Guesser doesn't process own camera)
        img = np.zeros((720, 1280, 3), dtype=np.uint8)
        success = True
    
    # Check for remote strokes
    while True:
        remote_stroke = strokeReceiver.get_stroke()
        if not remote_stroke:
            break
            
        if remote_stroke.get("action") == "clear_canvas":
            # Clear Canvas to White
            image_canvas[:] = 255
            print("Canvas Cleared!")
            continue
            
        drawLocally(remote_stroke, img, image_canvas)
        
    if not success and is_drawer:
         pass # Don't break loop if camera flickers, just keep trying or show black
         # print("Camera failed")
         # break

    # find landmark---2
    lmList = []
    if DRAW_MODE == "gesture":
        img = detector.findHands(img)
        lmList = detector.findPosition(img,draw = False)
    
    if len(lmList) != 0: # Already checked DRAW_MODE via lmList being empty if not gesture
        x1,y1 = lmList[8][1:]
        x2,y2 = lmList[12][1:]
        xthumb,ythumb = lmList[4][1:]
        xlittle,ylittle = lmList[20][1:]

        # check which fingers are up---3
        fingers = detector.fingersUp()

        if is_drawer:
            # if selection mode ---->> two finger are up.
            if fingers[1] and fingers[2]:
                Xprev,Yprev = 0,0
                if abs(x1-x2)<=50:
                    cv2.rectangle(img,(x1,y1-25),(x2,y2+25),selectionColor,cv2.FILLED)
                    if y1<=130:
                        # overlay images here.
                        if 10<x1<200:
                            selectionColor = (0,0,255)
                        elif 350<x1<550:
                            selectionColor = (0,255,0)
                        elif 730<x1<880:
                            selectionColor = (230,216,173)
                        elif 1030<x1<1280:
                            selectionColor = (255,255,255)
                            
            # drawing mode----index finger is up.
            drawColor = selectionColor
                
            if fingers[1] == 1 and fingers[2] == 0 and fingers[3] == 0 and fingers[4] == 0 and fingers[0] == 0 :
                cv2.circle(img,(x1,y1),15,drawColor,cv2.FILLED)
                
                stroke = strokeManager.getStroke(x1,y1,drawColor,lineThickNess)
                if stroke:
                    drawLocally(stroke, img, image_canvas)
                    stroke_data = stroke # Already a dict
                    stroke_data['room_id'] = room_id
                    stroke_data['mode'] = "gesture"
                    strokeSender.send_stroke(stroke_data)

            if fingers[1] and fingers[2] == 1 and fingers[3] == 1 and fingers[4] == 1 and fingers[0] == 1:
                # Local Drawing
                cv2.line(image_canvas,(xthumb,ythumb),(xlittle,ylittle),(255,255,255),60)
                
                # Network Transmission
                eraser_stroke = {
                    "x1": xthumb, "y1": ythumb, "x2": xlittle, "y2": ylittle,
                    "color": (255, 255, 255),
                    "thickness": 60,
                    "room_id": room_id,
                    "mode": "gesture"
                }
                if strokeSender:
                    strokeSender.send_stroke(eraser_stroke)
        else:
             pass # Guessers don't draw

    # -------- MOUSE DRAWING (MAIN LOOP) --------
    # Mouse drawing logic is now handled in the callback (draw_mouse) 
    # to ensure high sampling rate and smooth curves.
    pass

    # -------- COMPOSITION --------
    # 1. Base Layer: Drawing Canvas (White)
    img_display = image_canvas.copy()

    # 2. Overlay: Camera Feed (PIP - Picture in Picture)
    # Resize camera to be smaller (e.g., 20% of width)
    # 1280 * 0.2 = 256 width. Aspect ratio 16:9 -> 144 height.
    h, w, _ = img.shape
    pip_w = 320
    pip_h = 180
    
    if is_drawer:
        # Drawer sees a placeholder, not themselves
        pip_img = np.zeros((pip_h, pip_w, 3), dtype=np.uint8)
        pip_img[:] = (30, 30, 30) # Dark gray background
        cv2.putText(pip_img, "You are being", (60, 80), cv2.FONT_HERSHEY_PLAIN, 1.5, (255, 255, 255), 2)
        cv2.putText(pip_img, "watched!", (100, 110), cv2.FONT_HERSHEY_PLAIN, 1.5, (255, 255, 255), 2)
    else:
        if last_remote_frame is not None:
             # Remote frame is already 320x180, but just in case
             if last_remote_frame.shape[1] != pip_w or last_remote_frame.shape[0] != pip_h:
                 pip_img = cv2.resize(last_remote_frame, (pip_w, pip_h))
             else:
                 pip_img = last_remote_frame
        else:
             # Placeholder (Black box)
             pip_img = np.zeros((pip_h, pip_w, 3), dtype=np.uint8)
             cv2.putText(pip_img, "NO VIDEO", (100, 100), cv2.FONT_HERSHEY_PLAIN, 1, (255, 255, 255), 1)
    
    # Position: Top Left (below header)
    # Header is 100px.
    # Video box size: 320x180
    pip_x1 = 0
    pip_y1 = HEADER_HEIGHT
    pip_x2 = pip_x1 + pip_w
    pip_y2 = HEADER_HEIGHT + pip_h
    
    img_display[pip_y1:pip_y2, pip_x1:pip_x2] = pip_img
    
    # Draw Border
    cv2.rectangle(img_display, (pip_x1, pip_y1), (pip_x2, pip_y2), (50, 50, 50), 3)
    
    # Draw Label "DRAWER"
    # Background for label
    cv2.rectangle(img_display, (pip_x1, pip_y1 - 25), (pip_x1 + 100, pip_y1), (50, 50, 50), cv2.FILLED)
    cv2.putText(img_display, "DRAWER", (pip_x1 + 10, pip_y1 - 5), cv2.FONT_HERSHEY_PLAIN, 1, (255, 255, 255), 1)

    # 3. Overlay: UI Elements (Header)
    img_display[0:HEADER_HEIGHT, 0:FRAME_WIDTH] = header
    
    # 4. Overlay: Feedback & Cursors (Temporary, not saved to canvas)
    # If Gesture Mode, show hand landmarks or at least the drawing cursor
    if DRAW_MODE == "gesture":
        # We need to project the finger position onto the canvas if possible?
        # x1, y1 are already screen coordinates.
        if len(lmList) != 0:
            # Draw cursor on display only
            if fingers[1] == 1 and fingers[2] == 0:
                 cv2.circle(img_display, (x1, y1), 15, drawColor, cv2.FILLED)
                 cv2.circle(img_display, (x1, y1), 15, (0,0,0), 2) # border
            elif fingers[1] and fingers[2]:
                 # Selection mode
                  cv2.rectangle(img_display, (x1, y1-25), (x2, y2+25), selectionColor, cv2.FILLED)

    elif DRAW_MODE == "mouse":
         # Draw mouse cursor
         cv2.circle(img_display, (mouse_x, mouse_y), 10, drawColor, cv2.FILLED)
         cv2.circle(img_display, (mouse_x, mouse_y), 10, (0,0,0), 1)

    # UI Text
    cv2.putText(img_display, f"Room: {room_id}", (10, 150), cv2.FONT_HERSHEY_PLAIN, 1, (255, 0, 0), 2)
    cv2.putText(img_display, f"Player: {player_name}", (10, 170), cv2.FONT_HERSHEY_PLAIN, 1, (255, 0, 0), 2)
    
    # Mode Display
    mode_color = (0, 255, 0) if DRAW_MODE == "gesture" else (0, 0, 255)
    cv2.putText(img_display, f"Mode: {DRAW_MODE.upper()}", (10, 210), cv2.FONT_HERSHEY_PLAIN, 1.5, mode_color, 2)
    cv2.putText(img_display, "('m': Mouse, 'g': Gesture)", (10, 230), cv2.FONT_HERSHEY_PLAIN, 1, (100, 100, 100), 1)

    # Ready Status
    status_text = "READY" if is_ready else "NOT READY"
    status_color = (0, 255, 0) if is_ready else (0, 0, 255)
    cv2.putText(img_display, f"Status: {status_text}", (10, 260), cv2.FONT_HERSHEY_PLAIN, 1.5, status_color, 2)
    cv2.putText(img_display, "('r': Toggle Ready)", (10, 280), cv2.FONT_HERSHEY_PLAIN, 1, (100, 100, 100), 1)

    # Timer Display
    if strokeReceiver.round_end_time:
        time_left = max(0, int(strokeReceiver.round_end_time - time.time()))
        cv2.putText(img_display, f"Time: {time_left}s", (10, 190), cv2.FONT_HERSHEY_PLAIN, 1, (255, 0, 0), 2)
    
    # Word Display
    if strokeReceiver.current_word:
         # Draw 'card' background for word
         cv2.rectangle(img_display, (390, 60), (900, 110), (255, 255, 255), cv2.FILLED)
         cv2.putText(img_display, f"DRAW: {strokeReceiver.current_word}", (400, 100), cv2.FONT_HERSHEY_PLAIN, 3, (0, 0, 0), 4)
    elif strokeReceiver.current_drawer and not is_drawer:
         cv2.rectangle(img_display, (390, 60), (900, 110), (255, 255, 255), cv2.FILLED)
         cv2.putText(img_display, "GUESS THE WORD!", (400, 100), cv2.FONT_HERSHEY_PLAIN, 3, (0, 0, 255), 4)

    # Guesser/Drawer status
    if not is_drawer:
         cv2.putText(img_display, f"Guesser (Drawer: {strokeReceiver.current_drawer})", (20, 50), cv2.FONT_HERSHEY_PLAIN, 2, (0, 0, 255), 3)

    # Show Image
    cv2.imshow("Image", img_display)
    key = cv2.waitKey(1)
    if  key & 0xFF == ord("q") or key == 27:
        break
    elif key & 0xFF == ord('m'):
        if is_drawer and not mouse_drawing:
            DRAW_MODE = "mouse"
            print("Switched to MOUSE mode")
    elif key & 0xFF == ord('g'):
        if is_drawer and not mouse_drawing:
            DRAW_MODE = "gesture"
            print("Switched to GESTURE mode")
    elif key & 0xFF == ord('s'):
        # Start Game (Host only, but server validates)
        print("Attempting to start game...")
        if strokeSender:
            msg = {
                "action": Protocol.START_GAME,
                "room_id": room_id,
                "player_name": player_name
            }
            try:
                strokeSender.send_data(msg)
            except Exception as e:
                print(f"Failed to start game: {e}")
            # Also auto-ready host?
            # Host is implicitly ready by starting, but maybe explicit helps?
            # Let's keep it manual or auto. Host pressing Start implies ready.

    elif key & 0xFF == ord('r'):
        # Toggle Ready
        is_ready = not is_ready
        print(f"Toggled Ready: {is_ready}")
        if strokeSender:
            strokeSender.send_ready(is_ready)

if not webcam_stream.stopped:
    webcam_stream.stop()
strokeReceiver.close()
cv2.destroyAllWindows()
    
