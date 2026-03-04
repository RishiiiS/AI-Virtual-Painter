import React from 'react';

import SoundManager from '../utils/SoundManager';
import { Timer } from 'lucide-react';

const GameHeader = ({ word, timeLeft, isDrawer, isRoundActive }) => {
    const safeTime = typeof timeLeft === 'number' ? timeLeft : 0;

    // Play timer sound when low time
    React.useEffect(() => {
        if (isRoundActive && safeTime <= 15 && safeTime > 0) {
            SoundManager.playTimer();
        } else {
            SoundManager.stopTimer();
        }
    }, [safeTime, isRoundActive]);

    const formatTime = (t) => {
        const mins = Math.floor(t / 60);
        const secs = t % 60;
        return `${mins}:${secs < 10 ? '0' + secs : secs}`;
    };

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
                        fontSize: '3rem',
                        color: safeTime <= 10 ? '#E53935' : '#2A8C86',
                        animation: safeTime <= 5 && safeTime > 0 ? 'pulse 0.5s ease-in-out infinite alternate' : 'none',
                        transition: 'color 0.3s ease'
                    }}>
                        {formatTime(safeTime)}
                    </div>
                </div>
                <div style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: safeTime <= 10 ? '#E53935' : '#333',
                    border: '3px solid #EBC334',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '1.5rem',
                    boxShadow: '4px 4px 0 rgba(0,0,0,0.2)',
                    transition: 'background-color 0.3s ease'
                }}>
                    <Timer size={32} strokeWidth={2.5} />
                </div>
            </div>

            {/* Pulse animation for low time */}
            <style>{`
                @keyframes pulse {
                    from { transform: scale(1); }
                    to { transform: scale(1.1); }
                }
            `}</style>
        </div>
    );
};

export default GameHeader;
