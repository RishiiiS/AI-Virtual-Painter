import React, { useRef, useEffect } from 'react';

const DrawingCanvas = ({ isDrawer }) => {
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
        </div>
    );
};

export default DrawingCanvas;
