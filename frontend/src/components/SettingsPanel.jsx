import React, { useState, useEffect } from 'react';
import { sendReady } from '../api';

const SettingsPanel = ({ onStartGame, isHost, roomId, setRoomId, players = [], playerName }) => {
    const [duration, setDuration] = useState(60);
    const [settings, setSettings] = useState({
        quickChat: true,
        powerUps: true,
        difficulty: 1 // 0: Easy, 1: Medium, 2: Hard
    });
    // Local ready state might drift from backend, rely on props?
    // But we need immediate feedback.
    // Let's use internal state but sync with props if needed.
    // Actually, simple toggle with optimistic update is fine.
    const [isReady, setIsReady] = useState(false);

    // Check if all players (except host? or all including host?) are ready.
    // Backend logic: Host controls start. Others must be ready.
    // We filter for non-hosts.
    const guests = players.filter(p => !p.isHost);
    const allGuestsReady = guests.length > 0 && guests.every(p => p.status === 'READY');

    // Host can start if: at least 1 guest, and ALL guests are ready.
    const canStart = isHost && guests.length >= 1 && allGuestsReady;

    const toggleSetting = (key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div style={{
            backgroundColor: 'white',
            border: '4px solid #333',
            padding: '25px',
            boxShadow: '8px 8px 0 rgba(0,0,0,0.1)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
        }}>


            <h2 style={{
                fontFamily: '"Titan One", sans-serif',
                fontSize: '2rem',
                margin: '0 0 30px 0',
                textTransform: 'uppercase',
                zIndex: 1,
                position: 'relative'
            }}>
                ROOM SETTINGS
            </h2>

            {isHost ? (
                <>
                    {/* Room Code Input (Host only) */}
                    <div style={{ marginBottom: '25px', zIndex: 1 }}>
                        <h4 style={{ fontFamily: '"Titan One", sans-serif', margin: '0 0 10px 0' }}>ROOM CODE</h4>
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                            style={{
                                width: '100%',
                                padding: '10px',
                                fontFamily: '"Titan One", sans-serif',
                                fontSize: '1.2rem',
                                border: '3px solid #333',
                                textTransform: 'uppercase',
                                color: '#D96C2C',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    {/* Round Duration */}
                    <div style={{ marginBottom: '25px', zIndex: 1 }}>
                        <h4 style={{ fontFamily: '"Titan One", sans-serif', margin: '0 0 10px 0' }}>ROUND DURATION</h4>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {[60, 90, 120].map((sec) => (
                                <button
                                    key={sec}
                                    onClick={() => setDuration(sec)}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        fontFamily: '"Titan One", sans-serif',
                                        fontSize: '1.2rem',
                                        backgroundColor: duration === sec ? '#EBC334' : '#D1C4A5',
                                        border: duration === sec ? '3px solid #333' : '3px solid transparent', // Design shows solid border for selected
                                        color: duration === sec ? '#333' : '#777',
                                        cursor: 'pointer',
                                        boxShadow: duration === sec ? '2px 2px 0 #333' : 'none'
                                    }}
                                >
                                    {sec}s
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Word Difficulty */}
                    <div style={{ marginBottom: '25px', zIndex: 1 }}>
                        <h4 style={{ fontFamily: '"Titan One", sans-serif', margin: '0 0 10px 0' }}>WORD DIFFICULTY</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                value={settings.difficulty}
                                onChange={(e) => setSettings({ ...settings, difficulty: parseInt(e.target.value) })}
                                style={{
                                    width: '100%',
                                    accentColor: '#EBC334',
                                    cursor: 'pointer'
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: '"Fredoka", sans-serif', fontWeight: 'bold', fontSize: '0.8rem', color: '#666' }}>
                                <span>EASY</span>
                                <span>MEDIUM</span>
                                <span>HARD</span>
                            </div>
                        </div>
                    </div>

                    {/* Toggles */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', zIndex: 1 }}>
                        {[
                            { key: 'quickChat', label: 'QUICK CHAT' },
                            { key: 'powerUps', label: 'POWER-UPS' }
                        ].map(({ key, label }) => (
                            <div
                                key={key}
                                onClick={() => toggleSetting(key)}
                                style={{
                                    flex: 1,
                                    border: '3px solid #333',
                                    padding: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontFamily: '"Fredoka", sans-serif',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    backgroundColor: settings[key] ? '#fff' : '#eee',
                                    opacity: settings[key] ? 1 : 0.7
                                }}
                            >
                                <div style={{
                                    width: '25px',
                                    height: '25px',
                                    backgroundColor: settings[key] ? '#2A8C86' : '#ccc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    border: '2px solid #333'
                                }}>
                                    {settings[key] && '✓'}
                                </div>
                                {label}
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '"Fredoka", sans-serif',
                    color: '#666',
                    fontSize: '1.2rem',
                    textAlign: 'center',
                    fontStyle: 'italic'
                }}>
                    Wait for the host to configure the game...
                </div>
            )}

            {/* Start/Ready Button */}
            <button style={{
                width: '100%',
                padding: '20px',
                backgroundColor: isHost ? (canStart ? '#EBC334' : '#ccc') : (isReady ? '#69B578' : '#ccc'),
                border: '4px solid #333',
                fontFamily: '"Titan One", sans-serif',
                fontSize: '2.5rem',
                textTransform: 'uppercase',
                boxShadow: '6px 6px 0 #333',
                cursor: (isHost && !canStart) ? 'not-allowed' : 'pointer',
                marginBottom: '20px',
                zIndex: 1,
                color: '#333',
                opacity: (isHost && !canStart) ? 0.6 : 1
            }}
                onClick={() => {
                    if (isHost) {
                        if (canStart) {
                            onStartGame();
                        } else {
                            if (guests.length === 0) {
                                alert("Need at least 2 players!");
                            } else {
                                alert("Wait for all players to be READY!");
                            }
                        }
                    } else {
                        const newState = !isReady;
                        setIsReady(newState);
                        sendReady(roomId, newState, playerName);
                    }
                }}
            >
                {isHost ? 'START GAME' : (isReady ? 'READY!' : 'READY')}
            </button>

            <div style={{ textAlign: 'center', fontFamily: '"Fredoka", sans-serif', color: '#666', fontSize: '0.8rem', letterSpacing: '2px', fontWeight: 'bold' }}>
                {isHost ? (guests.length === 0 ? "WAITING FOR PLAYERS..." : (canStart ? "READY TO START!" : "WAITING FOR OTHERS TO BE READY...")) : "ARE YOU READY?"}
            </div>

        </div>
    );
};

export default SettingsPanel;
