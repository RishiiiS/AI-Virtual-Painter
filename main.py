import cv2
import mediapipe as mp
import numpy as np 
import os
import time
import handTracking as htm

folderPath = "header"
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

# -------- MAIN LOOP --------
while True:
    # import image----1
    success, img = cap.read()
    img = cv2.flip(img,1)
    if not success:
        break

    # find landmark---2
    img = detector.findHands(img)
    lmList = detector.findPosition(img,draw=False)
    if len(lmList) != 0:
        # print(lmList)q
        # tip of index and middle finger.
        x1,y1 = lmList[8][1:]
        x2,y2 = lmList[12][1:]
        xthumb,ythumb = lmList[4][1:]
        xlittle,ylittle = lmList[20][1:]


    # check which fingers are up---3
        fingers = detector.fingersUp()
        print(fingers)

    # setting the header image.
    img[0:HEADER_HEIGHT, 0:FRAME_WIDTH] = header
    # img = cv2.addWeighted(img,0.5,image_canvas,0.5,0)

    cv2.imshow("image",img)
    # stop on pressing q.

    key = cv2.waitKey(1)
    if  key & 0xFF == ord("q") or key == 27:
        break

cap.release()
cv2.destroyAllWindows()
    
