import React, { useState } from 'react';

const JoinRoom = ({ onJoin, onBack }) => {
    const [roomCode, setRoomCode] = useState('');

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            width: '100%'
        }}>
            <h2 style={{
                fontFamily: '"Titan One", sans-serif',
                fontSize: '2rem',
                margin: '0',
                color: '#333',
                textAlign: 'center',
                textTransform: 'uppercase'
            }}>
                JOIN A ROOM
            </h2>

            <input
                type="text"
                placeholder="ENTER ROOM CODE"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                style={{
                    width: '100%',
                    padding: '15px',
                    fontSize: '1.2rem',
                    fontFamily: '"Titan One", sans-serif',
                    border: '3px solid #333',
                    borderRadius: '0',
                    textAlign: 'center',
                    outline: 'none',
                    textTransform: 'uppercase',
                    boxSizing: 'border-box'
                }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
                <button style={{
                    flex: 1,
                    padding: '15px',
                    backgroundColor: '#ccc',
                    color: '#333',
                    border: '3px solid #333',
                    fontFamily: '"Titan One", sans-serif',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    boxShadow: '4px 4px 0 #333'
                }}
                    onClick={onBack}
                >
                    BACK
                </button>

                <button style={{
                    flex: 2,
                    padding: '15px',
                    backgroundColor: '#EBC334',
                    color: '#333',
                    border: '3px solid #333',
                    fontFamily: '"Titan One", sans-serif',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    boxShadow: '4px 4px 0 #333'
                }}
                    onClick={() => roomCode && onJoin(roomCode)}
                >
                    JOIN ROOM
                </button>
            </div>
        </div>
    );
};

export default JoinRoom;
