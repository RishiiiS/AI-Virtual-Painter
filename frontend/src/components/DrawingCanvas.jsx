import React, { useRef, useEffect, useState, useCallback } from 'react';

const DrawingCanvas = ({ isDrawer, color, tool, brushSize, videoFrame, roomId, playerName, onSendStroke, strokesFromServer }) => {
    const canvasRef = useRef(null);
    const isDrawing = useRef(false);
    const lastPoint = useRef(null);

    // Initialize canvas with white background
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

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
            // or could be stroke points
            if (stroke.x1 !== undefined && stroke.y1 !== undefined && stroke.x2 !== undefined && stroke.y2 !== undefined) {
                const strokeColor = stroke.color || '#333333';
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

    const handleMouseDown = useCallback((e) => {
        if (!isDrawer) return;
        isDrawing.current = true;
        const point = getCanvasPoint(e);
        lastPoint.current = point;
    }, [isDrawer, getCanvasPoint]);

    const handleMouseMove = useCallback((e) => {
        if (!isDrawer || !isDrawing.current || !lastPoint.current) return;

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
    }, [isDrawer, color, tool, brushSize, getCanvasPoint, onSendStroke]);

    const handleMouseUp = useCallback(() => {
        isDrawing.current = false;
        lastPoint.current = null;
    }, []);

    // Fill tool
    const handleClick = useCallback((e) => {
        if (!isDrawer || tool !== 'fill') return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (onSendStroke) {
            onSendStroke({ action: 'fill', color, mode: 'mouse' });
        }
    }, [isDrawer, tool, color, onSendStroke]);

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
                    cursor: isDrawer ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleClick}
            />

            {/* Drawer Video Feed (PIP) - Inside Canvas Container */}
            {videoFrame && (
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
                    <img
                        src={`data:image/jpeg;base64,${videoFrame}`}
                        alt="Drawer Feed"
                        style={{
                            width: '100%',
                            display: 'block'
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
                        Live Feed
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
        </div>
    );
};

export default DrawingCanvas;
