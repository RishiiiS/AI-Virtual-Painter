import React from 'react';

const COLORS = [
    '#333333', '#FFFFFF', '#D96C2C', '#EBC334',
    '#2A8C86', '#CC444B', '#4A90E2', '#50C878',
    '#D16BA5', '#8A2BE2', '#FFD700', '#000000'
];

const Palette = ({ selectedColor, onSelectColor }) => {
    return (
        <div className="palette-container">
            {COLORS.map((color) => (
                <div
                    key={color}
                    onClick={() => onSelectColor(color)}
                    className="color-square"
                    style={{
                        backgroundColor: color,
                        border: selectedColor === color ? '3px solid #333' : '3px solid rgba(0,0,0,0.2)',
                        boxShadow: selectedColor === color ? 'none' : '2px 2px 0 rgba(0,0,0,0.1)',
                        transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)',
                    }}
                ></div>
            ))}

            <div className="palette-divider"></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="current-color-preview" style={{
                    backgroundColor: selectedColor,
                }}></div>
                <div style={{
                    fontFamily: '"Fredoka", sans-serif',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    color: '#333',
                    width: '60px',
                    lineHeight: '1.2'
                }}>
                    CURRENT COLOR
                </div>
            </div>
        </div>
    );
};

export default Palette;
