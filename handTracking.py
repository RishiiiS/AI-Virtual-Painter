import cv2
import mediapipe
cap = cv2.VideoCapture(0)
while True:
    succ,img = cap.read()
    cv2.imshow("image",img)

    key = cv2.waitKey(1)
    if  key & 0xFF == ord("q") or key == 27:
        break
    
cap.release()
cv2.destroyAllWindows()