import cv2
import mediapipe as mp
import time
class handDetect():
    def __init__(self,mode = False,max_num_hands = 2,model_complexity = 1,min_dect_confidence = 0.5,min_tracking_confidence = 0.5):
        self.mode = mode
        self.max_num_hands = max_num_hands
        self.model_complexity = model_complexity
        self.min_dect_confidence = min_dect_confidence
        self.min_tracking_confidence = min_tracking_confidence
        self.mpHands = mp.solutions.hands 
        self.hands = self.mpHands.Hands(self.mode,self.max_num_hands,self.model_complexity,self.min_dect_confidence, self.min_tracking_confidence)
        self.mpDraw = mp.solutions.drawing_utils
        self.tipIds = [4,8,12,16,20]

    def findHands(self,img,draw = True):
        imgRGB = cv2.cvtColor(img,cv2.COLOR_BGR2RGB)
        self.results = self.hands.process(imgRGB)
        # print(results.multi_hand_landmarks)
        if self.results.multi_hand_landmarks:
            for handLms in self.results.multi_hand_landmarks:
                if draw:
                    self.mpDraw.draw_landmarks(img,handLms,self.mpHands.HAND_CONNECTIONS)

        return img

    def findPosition(self,img,handNo = 0, draw = True):
        self.lmList = []
        if self.results.multi_hand_landmarks:
            myHand = self.results.multi_hand_landmarks[handNo]
            for Id,lm in enumerate(myHand.landmark):
                h,w,c = img.shape
                cx,cy = int(lm.x * w),int(lm.y * h)
                self.lmList.append([Id,cx,cy])
                if draw:
                    cv2.circle(img,(cx,cy),15,(0,255,0),cv2.FILLED)
        
        return self.lmList
    def fingersUp(self):
        fingers = []
        # thumb.
        if self.lmList[self.tipIds[0]][1] < self.lmList[self.tipIds[0] - 1][1]:
            fingers.append(1)
        else:
            fingers.append(0)

        # fingers.
        for Id in range(1,5):
            if self.lmList[self.tipIds[Id]][2] < self.lmList[self.tipIds[Id] - 2][2]:
                fingers.append(1)
            else:
                fingers.append(0)
        return fingers

    
def main():
    pTime = 0
    cTime = 0
    cap = cv2.VideoCapture(0)
    Detector = handDetect()
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
    

if __name__ == "__main__":
    main()

