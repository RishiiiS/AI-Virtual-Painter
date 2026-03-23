import React, { useRef, useEffect, useState, useCallback } from 'react';
import useHandTracking from '../hooks/useHandTracking';
import { Hand, Mouse, Video } from 'lucide-react';

const DrawingCanvas = ({ isDrawer, color, tool, brushSize, remoteStream, roomId, playerName, onSendStroke, strokesFromServer, drawMode, localStream, onUndoRef }) => {
    const canvasRef = useRef(null);
    const videoRef = useRef(null);
    const isDrawing = useRef(false);
    const lastPoint = useRef(null);
    const gestureOverlayRef = useRef(null);
    const undoStack = useRef([]);
    const MAX_UNDO = 30;

    // Ref to hold callback for immediate gesture stroke processing
    // (useEffect + state dependency can miss rapid updates due to React batching)
    const onGestureStrokeRef = useRef(null);

    // Stable callback that dispatches to the ref
    const handleGestureStroke = useCallback((stroke) => {
        if (onGestureStrokeRef.current) {
            onGestureStrokeRef.current(stroke);
        }
    }, []);

    // Hand tracking hook — feeds existing camera stream into MediaPipe
    const gestureState = useHandTracking(
        localStream,
        isDrawer && drawMode === 'gesture',
        1280,
        720,
        handleGestureStroke  // Direct callback — bypasses React render cycle
    );

    // Set video srcObject when remoteStream changes
    useEffect(() => {
        const video = videoRef.current;
        if (video && remoteStream) {
            video.srcObject = remoteStream;
            // Explicit play() — autoPlay can be unreliable
            video.play().catch(err => {
                console.warn('[Video] Autoplay blocked, retrying:', err.message);
                // Retry after a short delay
                setTimeout(() => video.play().catch(() => { }), 500);
            });
        }
    }, [remoteStream]);

    // Initialize canvas with white background
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Save initial blank canvas as first undo state
        undoStack.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    }, []);

    // Convert color from any format to a valid CSS color string
    // Backend gesture strokes send BGR arrays like [0, 0, 255] (red in OpenCV)
    // Frontend mouse strokes send CSS strings like '#FF0000'
    const normalizeColor = (color) => {
        if (typeof color === 'string') return color;
        if (Array.isArray(color) && color.length >= 3) {
            // BGR → RGB → hex
            const [b, g, r] = color;
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        }
        return '#333333'; // fallback
    };

    // Render incoming strokes from server (other players)
    useEffect(() => {
        if (!strokesFromServer || strokesFromServer.length === 0) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        for (const stroke of strokesFromServer) {
            if (stroke.action === 'clear') {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                continue;
            }

            if (stroke.action === 'fill' && stroke.x !== undefined && stroke.y !== undefined) {
                // Flood fill at the normalized coordinates
                const fx = stroke.x * canvas.width;
                const fy = stroke.y * canvas.height;
                floodFill(canvas, fx, fy, stroke.color);
                continue;
            }

            // Stroke format from backend: {x1, y1, x2, y2, color, thickness, mode}
            if (stroke.x1 !== undefined && stroke.y1 !== undefined && stroke.x2 !== undefined && stroke.y2 !== undefined) {
                const strokeColor = normalizeColor(stroke.color);
                const strokeWidth = stroke.thickness || 5;

                // Scale from backend canvas (1280x720) to our canvas (800x600)
                const scaleX = canvas.width / 1280;
                const scaleY = canvas.height / 720;

                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = strokeWidth * Math.min(scaleX, scaleY);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(stroke.x1 * scaleX, stroke.y1 * scaleY);
                ctx.lineTo(stroke.x2 * scaleX, stroke.y2 * scaleY);
                ctx.stroke();
            }
        }
    }, [strokesFromServer]);

    // Get canvas coordinates from mouse event
    const getCanvasPoint = useCallback((e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Canvas is stretched to fill container, calculate raw scale across both axes
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;

        // Get mouse position relative to the top-left of the stretched canvas
        let x = (e.clientX - rect.left) / scaleX;
        let y = (e.clientY - rect.top) / scaleY;

        // Clamp coordinates to strictly stay within the logical 800x600 bounds
        x = Math.max(0, Math.min(x, canvas.width));
        y = Math.max(0, Math.min(y, canvas.height));

        return { x, y };
    }, []);

    // Keep the gesture stroke callback ref updated with latest color/brush/sender
    useEffect(() => {
        if (!isDrawer || drawMode !== 'gesture') {
            onGestureStrokeRef.current = null;
            return;
        }
        onGestureStrokeRef.current = (s) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            let strokeColor = s.color === '__CURRENT__' ? color : s.color;
            let strokeWidth = s.color === '#FFFFFF' ? s.thickness : brushSize;

            // If a standard 1-finger gesture stroke but UI UI tool is 'eraser', force erase
            if (s.color === '__CURRENT__' && tool === 'eraser') {
                strokeColor = '#FFFFFF';
                strokeWidth = brushSize * 3;
            }

            // Draw locally using canvas coords — bezier curves for smoothness
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            if (s.cmx !== undefined && s.cmy !== undefined) {
                // Quadratic bezier: use midpoint as start, prev as control, current as end
                ctx.moveTo(s.cx1, s.cy1);
                ctx.quadraticCurveTo(s.cmx, s.cmy, s.cx2, s.cy2);
            } else {
                ctx.moveTo(s.cx1, s.cy1);
                ctx.lineTo(s.cx2, s.cy2);
            }
            ctx.stroke();

            // Send to server
            if (onSendStroke) {
                onSendStroke({
                    x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2,
                    color: strokeColor,
                    thickness: strokeWidth,
                    mode: 'gesture',
                });
            }
        };
    }, [isDrawer, drawMode, color, brushSize, onSendStroke]);

    // Draw gesture cursor overlay
    useEffect(() => {
        const overlay = gestureOverlayRef.current;
        if (!overlay) return;
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        if (drawMode !== 'gesture' || !gestureState.isTracking || !gestureState.indexPos) return;

        const { x, y } = gestureState.indexPos;
        const fingers = gestureState.fingers;

        // Index only = draw cursor
        if (fingers[1] === 1 && fingers[2] === 0) {
            const isEraser = tool === 'eraser';
            const cursorColor = isEraser ? 'rgba(255, 255, 255, 0.8)' : color;
            const cursorSize = isEraser ? (brushSize * 3) / 2 + 3 : brushSize / 2 + 3;

            ctx.beginPath();
            ctx.arc(x, y, cursorSize, 0, Math.PI * 2);
            ctx.fillStyle = cursorColor;
            ctx.fill();
            ctx.strokeStyle = isEraser ? '#999' : '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        // Two fingers = selection indicator
        else if (fingers[1] === 1 && fingers[2] === 1 && fingers[3] === 0) {
            ctx.beginPath();
            ctx.arc(x, y, 20, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.7)';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        // All fingers = eraser indicator
        else if (fingers[0] === 1 && fingers[1] === 1 && fingers[2] === 1 && fingers[3] === 1 && fingers[4] === 1) {
            ctx.beginPath();
            ctx.arc(x, y, 25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fill();
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }, [gestureState, drawMode, color, brushSize, tool]);

    const handleMouseDown = useCallback((e) => {
        if (!isDrawer || drawMode === 'gesture' || tool === 'fill') return;
        isDrawing.current = true;
        const point = getCanvasPoint(e);
        lastPoint.current = point;
    }, [isDrawer, drawMode, tool, getCanvasPoint]);

    const handleMouseMove = useCallback((e) => {
        if (!isDrawer || drawMode === 'gesture' || tool === 'fill' || !isDrawing.current || !lastPoint.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const point = getCanvasPoint(e);

        const drawColor = tool === 'eraser' ? '#FFFFFF' : color;
        const drawSize = tool === 'eraser' ? brushSize * 3 : brushSize;

        // Draw locally
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = drawSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();

        // Send to server (scale to backend coordinate space 1280x720)
        const scaleX = 1280 / canvas.width;
        const scaleY = 720 / canvas.height;

        if (onSendStroke) {
            onSendStroke({
                x1: Math.round(lastPoint.current.x * scaleX),
                y1: Math.round(lastPoint.current.y * scaleY),
                x2: Math.round(point.x * scaleX),
                y2: Math.round(point.y * scaleY),
                color: drawColor,
                thickness: drawSize,
                mode: 'mouse'
            });
        }

        lastPoint.current = point;
    }, [isDrawer, drawMode, tool, color, brushSize, getCanvasPoint, onSendStroke]);

    const handleMouseUp = useCallback(() => {
        if (isDrawing.current) {
            // Save canvas snapshot for undo
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
                undoStack.current.push(snapshot);
                if (undoStack.current.length > MAX_UNDO) {
                    undoStack.current.shift();
                }
            }
        }
        isDrawing.current = false;
        lastPoint.current = null;
    }, [tool]);

    // Flood fill algorithm (scanline)
    const floodFill = useCallback((canvas, startX, startY, fillColor) => {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Convert CSS color to RGBA
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1;
        tempCanvas.height = 1;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = fillColor;
        tempCtx.fillRect(0, 0, 1, 1);
        const fillRGBA = tempCtx.getImageData(0, 0, 1, 1).data;

        // Get the color at the starting pixel
        const sx = Math.floor(startX);
        const sy = Math.floor(startY);
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

        const startIdx = (sy * width + sx) * 4;
        const targetR = data[startIdx];
        const targetG = data[startIdx + 1];
        const targetB = data[startIdx + 2];
        const targetA = data[startIdx + 3];

        // Don't fill if clicking on the same color
        if (targetR === fillRGBA[0] && targetG === fillRGBA[1] && targetB === fillRGBA[2] && targetA === fillRGBA[3]) return;

        const colorMatch = (idx) => {
            const tolerance = 15;
            return Math.abs(data[idx] - targetR) <= tolerance &&
                Math.abs(data[idx + 1] - targetG) <= tolerance &&
                Math.abs(data[idx + 2] - targetB) <= tolerance &&
                Math.abs(data[idx + 3] - targetA) <= tolerance;
        };

        const setPixel = (idx) => {
            data[idx] = fillRGBA[0];
            data[idx + 1] = fillRGBA[1];
            data[idx + 2] = fillRGBA[2];
            data[idx + 3] = fillRGBA[3];
        };

        // Scanline flood fill using a stack
        const stack = [[sx, sy]];
        const visited = new Uint8Array(width * height);

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            const pixelPos = y * width + x;
            if (visited[pixelPos]) continue;

            const idx = pixelPos * 4;
            if (!colorMatch(idx)) continue;

            // Scan left
            let left = x;
            while (left > 0 && colorMatch(((y * width) + (left - 1)) * 4) && !visited[y * width + (left - 1)]) {
                left--;
            }

            // Scan right
            let right = x;
            while (right < width - 1 && colorMatch(((y * width) + (right + 1)) * 4) && !visited[y * width + (right + 1)]) {
                right++;
            }

            // Fill the span and check above/below
            for (let px = left; px <= right; px++) {
                const pIdx = (y * width + px) * 4;
                setPixel(pIdx);
                visited[y * width + px] = 1;

                if (y > 0 && !visited[(y - 1) * width + px] && colorMatch(((y - 1) * width + px) * 4)) {
                    stack.push([px, y - 1]);
                }
                if (y < height - 1 && !visited[(y + 1) * width + px] && colorMatch(((y + 1) * width + px) * 4)) {
                    stack.push([px, y + 1]);
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }, []);

    // Fill tool click handler
    const handleClick = useCallback((e) => {
        if (!isDrawer || drawMode === 'gesture' || tool !== 'fill') return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        floodFill(canvas, x, y, color);

        // Save snapshot after fill for undo
        const ctx = canvas.getContext('2d');
        const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        undoStack.current.push(snapshot);
        if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();

        if (onSendStroke) {
            // Send normalized coordinates (0-1 range) so receiver can scale
            onSendStroke({ action: 'fill', color, x: x / canvas.width, y: y / canvas.height, mode: 'mouse' });
        }
    }, [isDrawer, drawMode, tool, color, onSendStroke, floodFill]);

    // Expose undo function via ref
    useEffect(() => {
        if (onUndoRef) {
            onUndoRef.current = () => {
                if (undoStack.current.length > 1) {
                    undoStack.current.pop(); // Remove current state
                    const prevState = undoStack.current[undoStack.current.length - 1];
                    const canvas = canvasRef.current;
                    if (canvas && prevState) {
                        const ctx = canvas.getContext('2d');
                        ctx.putImageData(prevState, 0, 0);
                    }
                }
            };
        }
    }, [onUndoRef]);

    const paintBucketCursor = `url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m19%2011-8-8-8.6%208.6a2%202%200%200%200%200%202.8l5.2%205.2c.8.8%202%20.8%202.8%200L19%2011Z%22%2F%3E%3Cpath%20d%3D%22m5%202%205%205%22%2F%3E%3Cpath%20d%3D%22M2%2013h15%22%2F%3E%3Cpath%20d%3D%22m22%2020-1.5-1.5%22%2F%3E%3Cpath%20d%3D%22m22%2016-1.5%201.5%22%2F%3E%3Cpath%20d%3D%22m18%2020%201.5-1.5%22%2F%3E%3C%2Fsvg%3E') 0 24, crosshair`;
    const eraserCursor = `url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m7%2021-4.3-4.3c-1-1-1-2.5%200-3.4l9.6-9.6c1-1%202.5-1%203.4%200l5.6%205.6c1%201%201%202.5%200%203.4L13%2021%22%2F%3E%3Cpath%20d%3D%22M22%2021H7%22%2F%3E%3Cpath%20d%3D%22m5%2011%209%209%22%2F%3E%3C%2Fsvg%3E') 0 24, cell`;

    return (
        <div className="drawing-canvas-wrapper" style={{
            backgroundColor: 'white',
            border: '4px solid #333',
            boxShadow: '8px 8px 0 rgba(0,0,0,0.2)',
            position: 'relative',
            overflow: 'hidden',
            touchAction: 'none' // Prevent scrolling when drawing on mobile
        }}>
            <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    cursor: isDrawer
                        ? (drawMode === 'gesture' ? 'none' : (tool === 'eraser' ? eraserCursor : tool === 'fill' ? paintBucketCursor : 'crosshair'))
                        : 'default'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleClick}
            />

            {/* Gesture cursor overlay canvas (transparent, same size) */}
            {isDrawer && drawMode === 'gesture' && (
                <canvas
                    ref={gestureOverlayRef}
                    width={1280}
                    height={720}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        pointerEvents: 'none',
                        zIndex: 10
                    }}
                />
            )}

            {/* Drawer Video Feed (PIP) — WebRTC stream */}
            {remoteStream && !isDrawer && (
                <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '200px',
                    borderRight: '3px solid #333',
                    borderBottom: '3px solid #333',
                    borderTop: 'none',
                    borderLeft: 'none',
                    backgroundColor: '#000',
                    zIndex: 20,
                    pointerEvents: 'none'
                }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            width: '100%',
                            display: 'block',
                            transform: 'scaleX(-1)'
                        }}
                    />
                    <div style={{
                        position: 'absolute',
                        bottom: '0',
                        left: '0',
                        right: '0',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        fontSize: '0.8rem',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontFamily: '"Fredoka", sans-serif'
                    }}>
                        <Video size={14} color="#00ff00" /> Live Feed
                    </div>
                </div>
            )}

            {/* Drawing status overlay */}
            {!isDrawer && (
                <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    padding: '5px 15px',
                    fontFamily: '"Fredoka", sans-serif',
                    fontSize: '0.8rem',
                    borderRadius: '20px',
                    zIndex: 20
                }}>
                    Watching the drawer...
                </div>
            )}

            {/* Mode indicator badge */}
            {isDrawer && (
                <div style={{
                    position: 'absolute',
                    top: '15px',
                    right: '15px',
                    backgroundColor: drawMode === 'gesture' ? '#69B578' : '#EBC334',
                    color: '#333',
                    border: '3px solid #333',
                    boxShadow: '4px 4px 0 #333',
                    padding: '8px 16px',
                    fontFamily: '"Titan One", sans-serif',
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    zIndex: 25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                }}>
                    {drawMode === 'gesture' ? <Hand size={20} strokeWidth={2.5} /> : <Mouse size={20} strokeWidth={2.5} />}
                    <span style={{ marginTop: '2px' }}>{drawMode === 'gesture' ? 'GESTURE MODE' : 'MOUSE MODE'}</span>
                    <span style={{
                        backgroundColor: '#fff',
                        color: '#333',
                        border: '2px solid #333',
                        fontFamily: '"Fredoka", sans-serif',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        marginLeft: '5px',
                        boxShadow: '2px 2px 0 #333'
                    }}>
                        {drawMode === 'gesture' ? 'PRESS M' : 'PRESS G'}
                    </span>
                </div>
            )}
        </div>
    );
};

export default DrawingCanvas;
