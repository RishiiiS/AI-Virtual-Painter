import React from 'react';

const COLORS = [
    '#333333', '#FFFFFF', '#D96C2C', '#EBC334',
    '#2A8C86', '#CC444B', '#4A90E2', '#50C878',
    '#D16BA5', '#8A2BE2', '#FFD700', '#000000'
];

const Palette = ({ selectedColor, onSelectColor }) => {
    return (
        <div style={{
            display: 'flex',
            gap: '10px',
            backgroundColor: 'white',
            border: '4px solid #333',
            padding: '10px 20px',
            boxShadow: '6px 6px 0 rgba(0,0,0,0.2)',
            alignItems: 'center'
        }}>
            {COLORS.map((color) => (
                <div
                    key={color}
                    onClick={() => onSelectColor(color)}
                    style={{
                        width: '35px',
                        height: '35px',
                        backgroundColor: color,
                        border: selectedColor === color ? '3px solid #333' : '3px solid rgba(0,0,0,0.2)',
                        boxShadow: selectedColor === color ? 'none' : '2px 2px 0 rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)',
                        transition: 'transform 0.1s'
                    }}
                ></div>
            ))}

            <div style={{ width: '2px', height: '40px', backgroundColor: '#ccc', margin: '0 10px' }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    backgroundColor: selectedColor,
                    border: '3px solid #333',
                    // boxShadow: '3px 3px 0 rgba(0,0,0,0.2)'
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
