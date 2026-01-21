import cv2
import mediapipe as mp
import numpy as np 
import os
import time
import handTracking as htm

pTime = 0
cTime = 0
cap = cv2.VideoCapture(0)
Detector = htm.handDetect()
while True:
    succ,img = cap.read()
    img = Detector.findHands(img)
    lmList = Detector.findPosition(img)
    # if len(lmList)!=0:
        # print(lmList[4])
    # putting fps. 
    cTime = time.time()
    fps = 1/(cTime - pTime)
    pTime = cTime
    cv2.putText(img,str(int(fps)),(10,70),cv2.FONT_HERSHEY_PLAIN,3,(0,0,255),3)


    cv2.imshow("image",img)
    # stop on pressing q.

    key = cv2.waitKey(1)
    if  key & 0xFF == ord("q") or key == 27:
        break

cap.release()
cv2.destroyAllWindows()
    
