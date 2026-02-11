import React from 'react';

const GameHeader = ({ word, timeLeft, isDrawer }) => {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            width: '100%'
        }}>
            {/* Left: Branding */}
            <div>
                <h1 style={{
                    fontFamily: '"Titan One", sans-serif',
                    fontSize: '2.5rem',
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
                    fontSize: '1.2rem',
                    color: '#333',
                    margin: '0 0 0 5px'
                }}>
                    Live Drawing...
                </h2>
            </div>

            {/* Center: Word Display */}
            <div style={{
                backgroundColor: 'white',
                border: '4px solid #333',
                padding: '10px 40px',
                textAlign: 'center',
                boxShadow: '4px 4px 0 rgba(0,0,0,0.2)',
                transform: 'rotate(-2deg)'
            }}>
                <div style={{ fontFamily: '"Fredoka", sans-serif', fontSize: '0.9rem', color: '#777', fontWeight: 'bold' }}>
                    THE WORD IS
                </div>
                <div style={{
                    fontFamily: '"Titan One", sans-serif',
                    fontSize: '2rem',
                    color: '#D96C2C',
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                }}>
                    {isDrawer ? word : (word ? word.replace(/./g, '_ ') : "WAITING...")}
                </div>
            </div>

            {/* Right: Timer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: '"Fredoka", sans-serif', fontSize: '0.8rem', color: '#777', fontWeight: 'bold' }}>
                        TIME LEFT
                    </div>
                    <div style={{
                        fontFamily: '"Titan One", sans-serif',
                        fontSize: '2.5rem',
                        color: '#2A8C86'
                    }}>
                        0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                    </div>
                </div>
                <div style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: '#333',
                    border: '3px solid #EBC334',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1.5rem',
                    boxShadow: '4px 4px 0 rgba(0,0,0,0.2)'
                }}>
                    ⏱
                </div>
            </div>
        </div>
    );
};

export default GameHeader;
