import React from 'react';

const ActionButtons = ({ onCreate, onJoin, isCreating = false }) => {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', width: '100%' }}>
            <button style={{
                flex: 1,
                minWidth: '150px',
                boxSizing: 'border-box',
                padding: '15px',
                backgroundColor: isCreating ? '#ccc' : '#EBC334',
                color: '#333',
                border: '3px solid #333',
                fontFamily: '"Titan One", sans-serif',
                fontSize: '1.2rem',
                textTransform: 'uppercase',
                boxShadow: isCreating ? 'none' : '4px 4px 0 #333',
                cursor: isCreating ? 'not-allowed' : 'pointer',
                transition: 'transform 0.1s',
            }}
                className="btn-sound"
                onClick={onCreate}
                disabled={isCreating}
                onMouseDown={(e) => { if (!isCreating) e.target.style.transform = 'translate(2px, 2px)'; }}
                onMouseUp={(e) => e.target.style.transform = 'translate(0, 0)'}
            >
                {isCreating ? 'CREATING...' : 'Create Room'}
            </button>

            <button style={{
                flex: 1,
                minWidth: '150px',
                boxSizing: 'border-box',
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
                className="btn-sound"
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
