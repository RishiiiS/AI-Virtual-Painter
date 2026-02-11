import React from 'react';

const LobbyHeader = () => {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
            width: '100%'
        }}>
            {/* Left: Branding */}
            <div>
                <h1 style={{
                    fontFamily: '"Titan One", sans-serif',
                    fontSize: '3rem',
                    color: '#EBC334',
                    textShadow: '3px 3px 0 #333, -1px -1px 0 #333',
                    letterSpacing: '2px',
                    margin: '0',
                    lineHeight: '1',
                    textTransform: 'uppercase'
                }}>
                    DOODLEDASH
                </h1>
                <h2 style={{
                    fontFamily: '"Pacifico", cursive',
                    fontSize: '1.5rem',
                    color: '#333',
                    margin: '0 0 0 5px'
                }}>
                    Waiting Room
                </h2>
            </div>

            {/* Right: Room Code & Settings */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{
                    backgroundColor: 'white',
                    border: '3px solid #333',
                    padding: '10px 20px',
                    fontFamily: '"Titan One", sans-serif',
                    boxShadow: '4px 4px 0 rgba(0,0,0,0.2)',
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <span style={{ color: '#333' }}>ROOM:</span>
                    <span style={{ color: '#D96C2C' }}>RETRO-99</span>
                </div>


            </div>
        </div>
    );
};

export default LobbyHeader;
