# AI Virtual Painter 🎨

AI Virtual Painter is a computer vision–based application that lets you draw on the screen using **hand gestures** instead of a mouse or stylus.  
It uses your webcam to track hand movements in real time and convert them into digital strokes.

Built using **OpenCV** and **MediaPipe**, this project demonstrates intuitive, touch-free interaction using AI.

---

## Features.
- Real-time hand tracking using webcam  
- Draw on a virtual canvas using finger gestures  
- Multiple colors and drawing modes  
- Clear canvas using gestures  
- Smooth and responsive performance  

---

## Tech Stack.
- Python  
- OpenCV – video capture and drawing  
- MediaPipe – hand landmark detection  
- NumPy – image and array operations  

---

## Project Structure
AI-Virtual-Painter/
│── handTracking.py
│── main.py
│── requirements.txt
│── README.md
│── .gitignore
│── venv/ (ignored)

## Setup & Installation
### 1. Clone the repository
```bash
git clone https://github.com/your-username/AI-Virtual-Painter.git
cd AI-Virtual-Painter

2. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

3.Install dependencies
pip install -r requirements.txt
Note: MediaPipe works best with Python 3.10

Run the Project
python handTracking.py
Ensure your webcam is connected and accessible.

#Hand Gestures Examples.
Index finger up → Draw
Two fingers up → Select color or mode
Specific gesture → Clear canvas
(Gestures may vary based on implementation)

# Learning Outcomes.
Hands-on experience with real-time computer vision
Understanding hand landmark detection
Gesture-based interaction design
Managing Python projects using virtual environments

# Future Improvements.
Brush size control
Save drawings as images
Gesture-based undo/redo
UI overlay for better user experience

# contribution.
Feel free to fork the repository and experiment with new features.
Pull requests are welcome.

# License
This project is for learning and educational purposes.

# Author
Rishi Seth