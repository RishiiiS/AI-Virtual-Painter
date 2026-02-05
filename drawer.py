import cv2
import mediapipe as mp
import numpy as np 
import os
import time
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
strokeSender = StrokeSender()
strokeReceiver = StrokeReceiver()
strokeReceiver.connect()
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
    remote_stroke = strokeReceiver.get_stroke()
    if remote_stroke:
        print("Received remote stroke")
        drawLocally(remote_stroke, img, image_canvas)

    if not success:
        break

    # find landmark---2
    img = detector.findHands(img)
    lmList = detector.findPosition(img,draw = False)
    if len(lmList) != 0:
        # print(lmList)q
        # tip of index and middle finger.
        x1,y1 = lmList[8][1:]
        x2,y2 = lmList[12][1:]
        xthumb,ythumb = lmList[4][1:]
        xlittle,ylittle = lmList[20][1:]


    # check which fingers are up---3
        fingers = detector.fingersUp()
        # print(fingers)

    # if selection mode ---->> two finger are up.
        if fingers[1] and fingers[2]:
            Xprev,Yprev = 0,0
            print(x1,y1)
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
                        

            print("selection mode")
        # drawing mode----index finger is up.
        if selectionColor == (255,255,255):
            drawColor = (0,0,0)
        else:
            drawColor = selectionColor
        if fingers[1] == 1 and fingers[2] == 0 and fingers[3] == 0 and fingers[4] == 0 and fingers[0] == 0 :
            cv2.circle(img,(x1,y1),15,drawColor,cv2.FILLED)
            print("drawing mode")

            stroke = strokeManager.getStroke(x1,y1,drawColor,lineThickNess)
            print(stroke)
            if stroke:
                drawLocally(stroke, img, image_canvas)
                strokeSender.send_stroke(stroke)
            # if Xprev==0 and Yprev==0:
            #     Xprev,Yprev = x1,y1
            # # creating stroke.
            # cv2.line(img,(Xprev,Yprev),(x1,y1),drawColor,lineThickNess)
            # cv2.line(image_canvas,(Xprev,Yprev),(x1,y1),drawColor,lineThickNess)
            # Xprev,Yprev = x1,y1

        if fingers[1] and fingers[2] == 1 and fingers[3] == 1 and fingers[4] == 1 and fingers[0] == 1:
            cv2.line(image_canvas,(xthumb,ythumb),(xlittle,ylittle),(0,0,0),60)

    imgGray = cv2.cvtColor(image_canvas,cv2.COLOR_BGR2GRAY)
    _,imgInv = cv2.threshold(imgGray,50,255,cv2.THRESH_BINARY_INV)
    imgInv = cv2.cvtColor(imgInv,cv2.COLOR_GRAY2BGR)
    img = cv2.bitwise_and(img,imgInv)
    img = cv2.bitwise_or(img,image_canvas)
    # setting the header image.
    img[0:HEADER_HEIGHT, 0:FRAME_WIDTH] = header
    # img = cv2.addWeighted(img,0.5,image_canvas,0.5,0)

    cv2.imshow("image",img)
    # stop on pressing q.
    key = cv2.waitKey(1)
    if  key & 0xFF == ord("q") or key == 27:
        break

cap.release()
strokeReceiver.close()
cv2.destroyAllWindows()
    
