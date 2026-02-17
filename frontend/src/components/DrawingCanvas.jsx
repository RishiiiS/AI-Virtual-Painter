import React, { useRef, useEffect, useState, useCallback } from 'react';
import useHandTracking from '../hooks/useHandTracking';

const DrawingCanvas = ({ isDrawer, color, tool, brushSize, remoteStream, roomId, playerName, onSendStroke, strokesFromServer, drawMode, localStream }) => {
    const canvasRef = useRef(null);
    const videoRef = useRef(null);
    const isDrawing = useRef(false);
    const lastPoint = useRef(null);
    const gestureOverlayRef = useRef(null);

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
        800,
        600,
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
        // Account for CSS scaling (canvas internal size vs displayed size)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
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

            const strokeColor = s.color === '__CURRENT__' ? color : s.color;
            const strokeWidth = s.color === '#FFFFFF' ? s.thickness : brushSize;

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
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2 + 3, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#000';
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
    }, [gestureState, drawMode, color, brushSize]);

    const handleMouseDown = useCallback((e) => {
        if (!isDrawer || drawMode === 'gesture') return;
        isDrawing.current = true;
        const point = getCanvasPoint(e);
        lastPoint.current = point;
    }, [isDrawer, drawMode, getCanvasPoint]);

    const handleMouseMove = useCallback((e) => {
        if (!isDrawer || drawMode === 'gesture' || !isDrawing.current || !lastPoint.current) return;

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
    }, [isDrawer, drawMode, color, tool, brushSize, getCanvasPoint, onSendStroke]);

    const handleMouseUp = useCallback(() => {
        isDrawing.current = false;
        lastPoint.current = null;
    }, []);

    // Fill tool
    const handleClick = useCallback((e) => {
        if (!isDrawer || drawMode === 'gesture' || tool !== 'fill') return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (onSendStroke) {
            onSendStroke({ action: 'fill', color, mode: 'mouse' });
        }
    }, [isDrawer, drawMode, tool, color, onSendStroke]);

    return (
        <div style={{
            flex: 1,
            backgroundColor: 'white',
            border: '4px solid #333',
            boxShadow: '8px 8px 0 rgba(0,0,0,0.2)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    cursor: isDrawer
                        ? (drawMode === 'gesture' ? 'none' : (tool === 'eraser' ? 'cell' : 'crosshair'))
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
                    width={800}
                    height={600}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
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
                        textAlign: 'center',
                        fontFamily: '"Fredoka", sans-serif'
                    }}>
                        🟢 Live Feed
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
                    top: '10px',
                    right: '10px',
                    backgroundColor: drawMode === 'gesture'
                        ? 'rgba(0, 200, 100, 0.85)'
                        : 'rgba(0, 100, 255, 0.85)',
                    color: 'white',
                    padding: '6px 14px',
                    fontFamily: '"Fredoka", sans-serif',
                    fontSize: '0.75rem',
                    borderRadius: '20px',
                    zIndex: 25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                    {drawMode === 'gesture' ? '✋' : '🖱️'}
                    {drawMode === 'gesture' ? 'GESTURE' : 'MOUSE'}
                    <span style={{ opacity: 0.7, fontSize: '0.65rem' }}>
                        ({drawMode === 'gesture' ? 'M→mouse' : 'G→gesture'})
                    </span>
                </div>
            )}
        </div>
    );
};

export default DrawingCanvas;
