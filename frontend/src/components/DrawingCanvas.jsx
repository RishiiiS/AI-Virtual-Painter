import React, { useRef, useEffect } from 'react';

const DrawingCanvas = ({ isDrawer, videoFrame }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        // Placeholder setup
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = "30px 'Titan One'";
        ctx.fillStyle = "#eee";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("DOODLE", canvas.width / 2, canvas.height / 2);
    }, []);

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
                    cursor: isDrawer ? 'crosshair' : 'default'
                }}
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
                    pointerEvents: 'none' // Let clicks pass through to canvas? Probably not for video area but ok.
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
        </div>
    );
};

export default DrawingCanvas;
