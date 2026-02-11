
import React from 'react';

const ActionButtons = ({ onCreate, onJoin }) => {
    return (
        <div style={{ display: 'flex', gap: '10px' }}>
            <button style={{
                flex: 1,
                padding: '15px',
                backgroundColor: '#EBC334',
                color: '#333',
                border: '3px solid #333',
                fontFamily: '"Titan One", sans-serif',
                fontSize: '1.2rem',
                textTransform: 'uppercase',
                boxShadow: '4px 4px 0 #333',
                cursor: 'pointer',
                transition: 'transform 0.1s',
            }}
                onClick={onCreate}
                onMouseDown={(e) => e.target.style.transform = 'translate(2px, 2px)'}
                onMouseUp={(e) => e.target.style.transform = 'translate(0, 0)'}
            >
                Create Room
            </button>

            <button style={{
                flex: 1,
                padding: '15px',
                backgroundColor: '#2A8C86',
                color: 'white',
                border: '3px solid #333',
                fontFamily: '"Titan One", sans-serif',
                fontSize: '1.2rem',
                textTransform: 'uppercase',
                boxShadow: '4px 4px 0 #333',
                cursor: 'pointer',
                transition: 'transform 0.1s',
            }}
                onClick={onJoin}
                onMouseDown={(e) => e.target.style.transform = 'translate(2px, 2px)'}
                onMouseUp={(e) => e.target.style.transform = 'translate(0, 0)'}
            >
                Join Room
            </button>
        </div>
    );
};

export default ActionButtons;
