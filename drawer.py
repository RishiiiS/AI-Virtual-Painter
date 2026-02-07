import cv2
import mediapipe as mp
import numpy as np 
import threading 
import os
import time
import sys
import json

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

# -------- CAMERA --------
cap = cv2.VideoCapture(0)
image_canvas = np.zeros((720, 1280, 3),dtype=np.uint8)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

# -------- RESIZE HEADER ONCE --------
HEADER_HEIGHT = 100
FRAME_WIDTH = 1280
header = cv2.resize(header, (FRAME_WIDTH, HEADER_HEIGHT))
 
detector = htm.handDetect(min_dect_confidence = 0.85)
strokeManager = StrokeManager()

# Ask for Room ID
try:
    room_id = input("Enter Room ID (default: room1): ").strip()
    if not room_id:
        room_id = "room1"
    player_name = input("Enter Player Name (default: Guest): ").strip()
    if not player_name:
        player_name = "Guest"
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
print("1. To START GAME: Press 's' on the CAMERA WINDOW (not here).")
print("2. To CHAT/GUESS: Type here in the terminal.")
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
                # Use strokeSender socket to send
                strokeSender.client_socket.sendall((json.dumps(chat_packet) + "\n").encode('utf-8'))
        except EOFError:
            break
        except Exception as e:
            print(f"Chat Error: {e}")

# Start Chat Thread
chat_thread = threading.Thread(target=chat_input_thread)
chat_thread.daemon = True
chat_thread.start()
selectionColor = (0,0,255)
lineThickNess = 15
Xprev,Yprev = 0,0

# drawing Stroke Locally funtion.
def drawLocally(stroke,img,image_canvas):
    x1,y1 = stroke["x1"],stroke["y1"]
    x2,y2 = stroke["x2"],stroke["y2"]
    color = stroke["color"]
    thickness = stroke["thickness"]
    cv2.line(img, (x1, y1), (x2, y2), color, thickness)
    cv2.line(image_canvas, (x1, y1), (x2, y2), color, thickness)

# -------- MAIN LOOP --------
while True:
    # import image----1
    success, img = cap.read()
    img = cv2.flip(img,1)
    
    # Check for remote strokes
    while True:
        remote_stroke = strokeReceiver.get_stroke()
        if not remote_stroke:
            break
        drawLocally(remote_stroke, img, image_canvas)
        
    # Determine is_drawer
    if strokeReceiver.current_drawer:
        is_drawer = (player_name == strokeReceiver.current_drawer)
    else:
        is_drawer = True 

    if not success:
        break

    # find landmark---2
    img = detector.findHands(img)
    lmList = detector.findPosition(img,draw = False)
    
    if len(lmList) != 0:
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
            if selectionColor == (255,255,255):
                drawColor = (0,0,0)
            else:
                drawColor = selectionColor
                
            if fingers[1] == 1 and fingers[2] == 0 and fingers[3] == 0 and fingers[4] == 0 and fingers[0] == 0 :
                cv2.circle(img,(x1,y1),15,drawColor,cv2.FILLED)
                
                stroke = strokeManager.getStroke(x1,y1,drawColor,lineThickNess)
                if stroke:
                    drawLocally(stroke, img, image_canvas)
                    stroke_data = stroke # Already a dict
                    stroke_data['room_id'] = room_id
                    strokeSender.send_stroke(stroke_data)

            if fingers[1] and fingers[2] == 1 and fingers[3] == 1 and fingers[4] == 1 and fingers[0] == 1:
                cv2.line(image_canvas,(xthumb,ythumb),(xlittle,ylittle),(0,0,0),60)
        else:
             cv2.putText(img, f"Guesser (Drawer: {strokeReceiver.current_drawer})", (20, 50), cv2.FONT_HERSHEY_PLAIN, 2, (0, 0, 255), 3)

    imgGray = cv2.cvtColor(image_canvas,cv2.COLOR_BGR2GRAY)
    _,imgInv = cv2.threshold(imgGray,50,255,cv2.THRESH_BINARY_INV)
    imgInv = cv2.cvtColor(imgInv,cv2.COLOR_GRAY2BGR)
    img = cv2.bitwise_and(img,imgInv)
    img = cv2.bitwise_or(img,image_canvas)
    
    # setting the header image.
    img[0:HEADER_HEIGHT, 0:FRAME_WIDTH] = header
    
    # UI Text
    cv2.putText(img, f"Room: {room_id}", (10, 150), cv2.FONT_HERSHEY_PLAIN, 1, (255, 0, 0), 2)
    cv2.putText(img, f"Player: {player_name}", (10, 170), cv2.FONT_HERSHEY_PLAIN, 1, (255, 0, 0), 2)
    
    # Word Display
    if strokeReceiver.current_word:
        cv2.putText(img, f"DRAW: {strokeReceiver.current_word}", (400, 100), cv2.FONT_HERSHEY_PLAIN, 3, (0, 0, 0), 4)
    elif strokeReceiver.current_drawer and not is_drawer:
        cv2.putText(img, "GUESS THE WORD!", (400, 100), cv2.FONT_HERSHEY_PLAIN, 3, (0, 0, 255), 4)

    # Show Image
    cv2.imshow("Image", img)
    key = cv2.waitKey(1)
    if  key & 0xFF == ord("q") or key == 27:
        break
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
                msg_str = json.dumps(msg) + "\n"
                strokeSender.client_socket.sendall(msg_str.encode('utf-8'))
            except Exception as e:
                print(f"Failed to start game: {e}")

cap.release()
strokeReceiver.close()
cv2.destroyAllWindows()
    
