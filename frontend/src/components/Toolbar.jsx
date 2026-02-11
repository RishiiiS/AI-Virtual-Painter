import React from 'react';

const TOOLS = [
    { id: 'brush', icon: '🖌️' },
    { id: 'eraser', icon: '🧹' },
    { id: 'fill', icon: '🪣' },
    { id: 'undo', icon: '↩️' },
];

const Toolbar = ({ selectedTool, onSelectTool, brushSize, onSelectSize }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
        }}>
            {TOOLS.map((tool) => (
                <button
                    key={tool.id}
                    onClick={() => onSelectTool(tool.id)}
                    style={{
                        width: '60px',
                        height: '60px',
                        backgroundColor: selectedTool === tool.id ? '#EBC334' : 'white',
                        border: '3px solid #333',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        boxShadow: selectedTool === tool.id ? '2px 2px 0 #333' : '4px 4px 0 rgba(0,0,0,0.2)',
                        transform: selectedTool === tool.id ? 'translate(2px, 2px)' : 'none',
                        transition: 'all 0.1s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {tool.icon}
                </button>
            ))}

            {/* Brush Size Selector */}
            <div style={{
                width: '60px',
                backgroundColor: 'white',
                border: '3px solid #333',
                boxShadow: '4px 4px 0 rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 0',
                gap: '12px'
            }}>
                {[5, 10, 20].map((size) => (
                    <div
                        key={size}
                        onClick={() => onSelectSize && onSelectSize(size)}
                        style={{
                            width: '36px', // Touch target size
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <div style={{
                            width: `${size + 4}px`, // Map 5->9, 10->14, 20->24 visual size
                            height: `${size + 4}px`,
                            borderRadius: '50%',
                            backgroundColor: '#333',
                            border: brushSize === size ? '3px solid #EBC334' : 'none',
                            boxShadow: brushSize === size ? '0 0 0 2px #333' : 'none', // Ring effect
                        }} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Toolbar;
