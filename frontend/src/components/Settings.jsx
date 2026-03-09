import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Timer, Palette, ArrowLeft } from 'lucide-react';
import SoundManager from '../utils/SoundManager';

const Settings = ({ onBack }) => {
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [clickVolume, setClickVolume] = useState(50);
    const [timerVolume, setTimerVolume] = useState(60);

    // Load settings from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('doodledash_settings');
        if (saved) {
            try {
                const s = JSON.parse(saved);
                setSoundEnabled(s.soundEnabled ?? true);
                setClickVolume(s.clickVolume ?? 50);
                setTimerVolume(s.timerVolume ?? 60);
            } catch { }
        }
    }, []);

    // Apply and save settings whenever they change
    useEffect(() => {
        const settings = { soundEnabled, clickVolume, timerVolume };
        localStorage.setItem('doodledash_settings', JSON.stringify(settings));

        // Apply to SoundManager
        SoundManager.clickAudio.volume = soundEnabled ? clickVolume / 100 : 0;
        SoundManager.timerAudio.volume = soundEnabled ? timerVolume / 100 : 0;
    }, [soundEnabled, clickVolume, timerVolume]);

    const sliderStyle = {
        width: '100%',
        height: '8px',
        appearance: 'none',
        WebkitAppearance: 'none',
        background: '#ddd',
        borderRadius: '4px',
        outline: 'none',
        cursor: 'pointer',
        accentColor: '#EBC334',
    };

    const sectionStyle = {
        backgroundColor: '#f9f9f9',
        border: '3px solid #333',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '4px 4px 0 rgba(0,0,0,0.1)',
    };

    const labelStyle = {
        fontFamily: '"Titan One", sans-serif',
        fontSize: '0.9rem',
        color: '#333',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    };

    return (
        <div>
            {/* Title */}
            <h2 style={{
                fontFamily: '"Titan One", sans-serif',
                fontSize: '1.8rem',
                textTransform: 'uppercase',
                color: '#333',
                borderBottom: '4px solid #333',
                paddingBottom: '10px',
                marginBottom: '25px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
            }}>
                SETTINGS
            </h2>

            {/* Sound Section */}
            <div style={sectionStyle}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                }}>
                    <div style={{ ...labelStyle, fontSize: '1rem', marginBottom: 0 }}>
                        {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                        SOUND
                    </div>
                    <button
                        className="btn-sound"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: soundEnabled ? '#2A8C86' : '#ccc',
                            color: 'white',
                            border: '3px solid #333',
                            fontFamily: '"Titan One", sans-serif',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
                        }}
                    >
                        {soundEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>

                <div style={{ opacity: soundEnabled ? 1 : 0.4, pointerEvents: soundEnabled ? 'auto' : 'none' }}>
                    <div style={labelStyle}>
                        CLICK SOUNDS
                        <span style={{ fontFamily: '"Fredoka", sans-serif', color: '#666', fontWeight: 'bold', marginLeft: 'auto' }}>{clickVolume}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={clickVolume}
                        onChange={(e) => setClickVolume(Number(e.target.value))}
                        style={sliderStyle}
                    />

                    <div style={{ ...labelStyle, marginTop: '15px' }}>
                        <Timer size={16} />
                        TIMER SOUNDS
                        <span style={{ fontFamily: '"Fredoka", sans-serif', color: '#666', fontWeight: 'bold', marginLeft: 'auto' }}>{timerVolume}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={timerVolume}
                        onChange={(e) => setTimerVolume(Number(e.target.value))}
                        style={sliderStyle}
                    />
                </div>
            </div>

            {/* Game Features Section */}
            <div style={sectionStyle}>
                <div style={{ ...labelStyle, fontSize: '1rem', marginBottom: '15px' }}>
                    <Palette size={20} />
                    GAME INFO
                </div>

                <div style={{ fontFamily: '"Fredoka", sans-serif', fontSize: '0.9rem', color: '#555', lineHeight: '1.8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px dashed #ddd', paddingBottom: '8px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>Draw Mode</span>
                        <span>Mouse + Hand Gestures</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px dashed #ddd', paddingBottom: '8px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>Round Timer</span>
                        <span>60 / 90 / 120 seconds</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px dashed #ddd', paddingBottom: '8px', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>Max Players</span>
                        <span>8 per room</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>Correct Guess</span>
                        <span>+100 points</span>
                    </div>
                </div>
            </div>

            {/* Back Button */}
            <button
                className="btn-sound"
                onClick={onBack}
                style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: '#EBC334',
                    color: '#333',
                    border: '3px solid #333',
                    fontFamily: '"Titan One", sans-serif',
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    boxShadow: '4px 4px 0 #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'translate(0, 0)'}
            >
                <ArrowLeft size={20} strokeWidth={3} />
                BACK
            </button>
        </div>
    );
};

export default Settings;
