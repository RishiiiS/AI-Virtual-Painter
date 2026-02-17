import { useEffect, useRef, useCallback, useState } from 'react';
import { Hands } from '@mediapipe/hands';

/**
 * Finger tip landmark indices (MediaPipe Hand model)
 * 4: Thumb tip, 8: Index tip, 12: Middle tip, 16: Ring tip, 20: Pinky tip
 */
const TIP_IDS = [4, 8, 12, 16, 20];

/**
 * Determine which fingers are up (extended).
 * Returns [thumb, index, middle, ring, pinky] — 1=up, 0=down
 */
function fingersUp(landmarks) {
    if (!landmarks || landmarks.length < 21) return [0, 0, 0, 0, 0];
    const fingers = [];

    // Thumb: compare x of tip (4) vs x of IP joint (3)
    // For webcam (non-mirrored feed), right hand thumb up = tip.x > joint.x
    // We check both directions since hand orientation varies
    const thumbDiff = Math.abs(landmarks[TIP_IDS[0]].x - landmarks[TIP_IDS[0] - 1].x);
    if (thumbDiff > 0.03) {
        // Thumb is extended if tip is significantly away from joint in x
        if (landmarks[TIP_IDS[0]].x < landmarks[TIP_IDS[0] - 1].x) {
            fingers.push(1);
        } else {
            fingers.push(1); // Extended in either direction counts
        }
    } else {
        fingers.push(0); // Thumb curled
    }

    // Other 4 fingers: tip y < PIP joint y means finger is up
    for (let i = 1; i < 5; i++) {
        if (landmarks[TIP_IDS[i]].y < landmarks[TIP_IDS[i] - 2].y) {
            fingers.push(1);
        } else {
            fingers.push(0);
        }
    }
    return fingers;
}

/**
 * useHandTracking — feeds an existing MediaStream into MediaPipe Hands
 * and returns real-time gesture state for drawing.
 *
 * Uses a manual requestAnimationFrame loop instead of @mediapipe/camera_utils
 * to avoid re-acquiring the camera — we reuse the existing WebRTC stream.
 */
export default function useHandTracking(stream, enabled, canvasWidth = 800, canvasHeight = 600, onStrokeCallback = null) {
    const handsRef = useRef(null);
    const videoRef = useRef(null);
    const rafRef = useRef(null);
    const prevPosRef = useRef({ x: 0, y: 0 });
    const smoothPosRef = useRef({ x: 0, y: 0 }); // EMA-smoothed position
    const lastGestureRef = useRef(null);
    const onStrokeRef = useRef(onStrokeCallback);
    const [gestureState, setGestureState] = useState({
        isTracking: false,
        fingers: [0, 0, 0, 0, 0],
        indexPos: null,
        stroke: null,
    });

    // Keep callback ref fresh
    useEffect(() => {
        onStrokeRef.current = onStrokeCallback;
    }, [onStrokeCallback]);

    // Process MediaPipe results
    const onResults = useCallback((results) => {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            setGestureState(prev => ({
                ...prev,
                isTracking: false,
                fingers: [0, 0, 0, 0, 0],
                indexPos: null,
                stroke: null,
            }));
            prevPosRef.current = { x: 0, y: 0 };
            smoothPosRef.current = { x: 0, y: 0 };
            lastGestureRef.current = null;
            return;
        }

        const landmarks = results.multiHandLandmarks[0];
        const fingers = fingersUp(landmarks);

        // Index fingertip — normalized (0-1), scale to canvas
        // Mirror X axis since webcam is not flipped but user faces camera
        const indexTip = landmarks[8];
        // Use float coordinates for sub-pixel precision (no Math.round)
        const rawX = (1 - indexTip.x) * canvasWidth;   // Mirror X
        const rawY = indexTip.y * canvasHeight;

        let stroke = null;
        const currentGesture = `${fingers.join(',')}`;

        // Exponential Moving Average smoothing factor
        // Lower = smoother but laggier, higher = more responsive but jittery
        const EMA_ALPHA = 0.4;

        // Drawing mode: Index finger up, middle+ring+pinky down
        if (fingers[1] === 1 && fingers[2] === 0 && fingers[3] === 0 && fingers[4] === 0) {
            // Apply EMA smoothing
            const sm = smoothPosRef.current;
            let sx, sy;
            if (sm.x === 0 && sm.y === 0) {
                // First point — initialize directly
                sx = rawX;
                sy = rawY;
            } else {
                sx = sm.x + EMA_ALPHA * (rawX - sm.x);
                sy = sm.y + EMA_ALPHA * (rawY - sm.y);
            }
            smoothPosRef.current = { x: sx, y: sy };

            const px = prevPosRef.current.x;
            const py = prevPosRef.current.y;

            if (px !== 0 || py !== 0) {
                // Jitter threshold — ignore sub-pixel noise
                const dist = Math.sqrt((sx - px) ** 2 + (sy - py) ** 2);
                if (dist > 1.0) {
                    const scaleX = 1280 / canvasWidth;
                    const scaleY = 720 / canvasHeight;

                    // Midpoint for smoother curve rendering
                    const mx = (px + sx) / 2;
                    const my = (py + sy) / 2;

                    stroke = {
                        x1: Math.round(px * scaleX),
                        y1: Math.round(py * scaleY),
                        x2: Math.round(sx * scaleX),
                        y2: Math.round(sy * scaleY),
                        color: '__CURRENT__',
                        thickness: 5,
                        mode: 'gesture',
                        // Float canvas coords for smooth local rendering
                        cx1: px, cy1: py, cx2: sx, cy2: sy,
                        // Midpoint for quadratic bezier
                        cmx: mx, cmy: my,
                    };
                }
            }
            prevPosRef.current = { x: sx, y: sy };
        }
        // Eraser mode: ALL fingers up
        else if (fingers[1] === 1 && fingers[2] === 1 && fingers[3] === 1 && fingers[4] === 1) {
            const thumbTip = landmarks[4];
            const pinkyTip = landmarks[20];
            const tx = (1 - thumbTip.x) * canvasWidth;
            const ty = thumbTip.y * canvasHeight;
            const pkx = (1 - pinkyTip.x) * canvasWidth;
            const pky = pinkyTip.y * canvasHeight;

            const scaleX = 1280 / canvasWidth;
            const scaleY = 720 / canvasHeight;
            stroke = {
                x1: Math.round(tx * scaleX),
                y1: Math.round(ty * scaleY),
                x2: Math.round(pkx * scaleX),
                y2: Math.round(pky * scaleY),
                color: '#FFFFFF',
                thickness: 40,
                mode: 'gesture',
                cx1: tx, cy1: ty, cx2: pkx, cy2: pky,
            };
            prevPosRef.current = { x: 0, y: 0 };
            smoothPosRef.current = { x: 0, y: 0 };
        }
        // Selection mode or other: reset
        else {
            prevPosRef.current = { x: 0, y: 0 };
            smoothPosRef.current = { x: 0, y: 0 };
        }

        lastGestureRef.current = currentGesture;

        // Use smoothed position for cursor display
        const displayX = smoothPosRef.current.x || rawX;
        const displayY = smoothPosRef.current.y || rawY;

        // Call stroke callback immediately (bypasses React render cycle)
        if (stroke && onStrokeRef.current) {
            onStrokeRef.current(stroke);
        }

        setGestureState({
            isTracking: true,
            fingers,
            indexPos: { x: displayX, y: displayY },
            stroke,
        });
    }, [canvasWidth, canvasHeight]);

    // Initialize / teardown MediaPipe with manual rAF loop
    useEffect(() => {
        if (!enabled || !stream) {
            // Cleanup
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.srcObject = null;
                videoRef.current.remove();
                videoRef.current = null;
            }
            if (handsRef.current) {
                handsRef.current.close();
                handsRef.current = null;
            }
            prevPosRef.current = { x: 0, y: 0 };
            setGestureState(prev => ({ ...prev, isTracking: false, stroke: null }));
            return;
        }

        let active = true;

        // Create hidden video element — attach EXISTING stream (no new getUserMedia)
        const video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.setAttribute('autoplay', '');
        video.muted = true;
        video.srcObject = stream;
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        video.style.width = '1px';
        video.style.height = '1px';
        document.body.appendChild(video);
        videoRef.current = video;

        // Initialize Hands
        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 0,           // Faster processing = less frame skip
            minDetectionConfidence: 0.65,
            minTrackingConfidence: 0.3,    // Lower = landmarks persist through rapid motion
        });
        hands.onResults(onResults);
        handsRef.current = hands;

        // Manual frame processing loop (no Camera utility — avoids double getUserMedia)
        let busy = false;
        let stallCount = 0;

        const processFrame = () => {
            if (!active) return;

            // Always schedule next frame first — keeps loop alive even if send() stalls
            rafRef.current = requestAnimationFrame(processFrame);

            // Skip if previous send is still in-flight
            if (busy) {
                stallCount++;
                if (stallCount > 90) { // ~1.5s stall → reset
                    console.warn('[HandTracking] MediaPipe stalled, resetting busy flag');
                    busy = false;
                    stallCount = 0;
                }
                return;
            }

            if (video.readyState >= 2 && handsRef.current) {
                busy = true;
                stallCount = 0;
                handsRef.current.send({ image: video }).then(() => {
                    busy = false;
                }).catch((e) => {
                    console.warn('[HandTracking] send error:', e?.message);
                    busy = false;
                });
            }
        };

        // Wait for video to be ready, then start processing
        video.play().then(() => {
            console.log('[HandTracking] Video playing, starting MediaPipe frame loop');
            if (active) {
                rafRef.current = requestAnimationFrame(processFrame);
            }
        }).catch(err => {
            console.warn('[HandTracking] Video play failed:', err.message);
            // Try starting anyway after a delay
            setTimeout(() => {
                if (active) {
                    rafRef.current = requestAnimationFrame(processFrame);
                }
            }, 500);
        });

        console.log('[HandTracking] MediaPipe Hands initialized (manual rAF loop)');

        return () => {
            active = false;
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            video.pause();
            video.srcObject = null;
            video.remove();
            videoRef.current = null;
            hands.close();
            handsRef.current = null;
            prevPosRef.current = { x: 0, y: 0 };
            console.log('[HandTracking] Cleaned up');
        };
    }, [enabled, stream, onResults]);

    return gestureState;
}
