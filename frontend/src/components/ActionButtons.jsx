
import React from 'react';

const ActionButtons = ({ onPlay }) => {
    return (
        <div style={{ display: 'flex', gap: '10px' }}>
            <button style={{
                flex: 3,
                padding: '15px',
                backgroundColor: '#EBC334',
                color: '#333',
                border: '3px solid #333',
                fontFamily: '"Titan One", sans-serif',
                fontSize: '1.5rem',
                textTransform: 'uppercase',
                boxShadow: '4px 4px 0 #333',
                cursor: 'pointer',
                transition: 'transform 0.1s',
            }}
                onClick={onPlay}
                onMouseDown={(e) => e.target.style.transform = 'translate(2px, 2px)'}
                onMouseUp={(e) => e.target.style.transform = 'translate(0, 0)'}
            >
                Play Now
            </button>

            <button style={{
                flex: 1,
                backgroundColor: '#2A8C86',
                color: 'white',
                border: '3px solid #333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                boxShadow: '4px 4px 0 #333',
                cursor: 'pointer'
            }}>
                👥+
            </button>
        </div>
    );
};

export default ActionButtons;
