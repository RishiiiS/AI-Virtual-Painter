import React from 'react';
import SoundManager from '../utils/SoundManager';

const HowToPlay = ({ onBack }) => {
    const playSound = () => SoundManager.playClick();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            fontFamily: '"Fredoka", sans-serif',
            color: '#333',
            textAlign: 'left'
        }}>
            <h2 style={{
                fontFamily: '"Titan One", sans-serif',
                fontSize: '2rem',
                margin: 0,
                color: '#2A8C86',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                textAlign: 'center',
                textShadow: '2px 2px 0px rgba(0,0,0,0.1)'
            }}>
                How To Play
            </h2>

            <div style={{
                backgroundColor: '#F7F7F7',
                padding: '20px',
                border: '3px solid #333',
                boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.05)',
                fontSize: '1rem',
                lineHeight: '1.6',
                maxHeight: '400px',
                overflowY: 'auto'
            }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#D96C2C', fontFamily: '"Titan One", sans-serif' }}>The Objective</h3>
                <p style={{ margin: '0 0 20px 0', fontWeight: '500' }}>
                    DoodleDash is a fast-paced multiplayer drawing and guessing game. Take turns drawing a secret word while everyone else races to guess it in the chat!
                </p>

                <h3 style={{ margin: '0 0 10px 0', color: '#69B578', fontFamily: '"Titan One", sans-serif' }}>Controls</h3>
                <div style={{ margin: '0 0 20px 0', fontWeight: '500' }}>
                    <strong>Mouse Mode (Default - Press 'M'):</strong>
                    <ul style={{ margin: '5px 0 15px 0', paddingLeft: '20px' }}>
                        <li>Click and drag on the canvas to draw or erase.</li>
                        <li>Use the tools on the left to switch colors, brushes, or use the paint bucket.</li>
                    </ul>

                    <strong>Gesture Mode 📷 (Webcam Required - Press 'G'):</strong>
                    <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
                        <li><strong>Draw ☝️:</strong> Point with your <em>Index Finger</em> (keep other fingers closed like a fist).</li>
                        <li><strong>Erase 🖐️:</strong> Hold up an <em>Open Hand</em> (all fingers extended) to use the chunky block eraser.</li>
                        <li><strong>Hover ✊:</strong> Close your hand completely to stop drawing and move between strokes.</li>
                    </ul>
                </div>

                <h3 style={{ margin: '0 0 10px 0', color: '#EBC334', fontFamily: '"Titan One", sans-serif' }}>When It's Your Turn to Draw</h3>
                <ul style={{ margin: '0 0 20px 0', paddingLeft: '20px', fontWeight: '500' }}>
                    <li style={{ marginBottom: '8px' }}>You will receive a secret word at the top of the screen.</li>
                    <li style={{ marginBottom: '8px' }}>Use the toolbar to choose colors, brush sizes, and tools (brush, fill, block eraser).</li>
                    <li style={{ marginBottom: '8px' }}>Draw the word as best as you can! <strong>NO spelling words out!</strong></li>
                </ul>

                <h3 style={{ margin: '0 0 10px 0', color: '#2A8C86', fontFamily: '"Titan One", sans-serif' }}>When It's Your Turn to Guess</h3>
                <ul style={{ margin: '0 0 0 0', paddingLeft: '20px', fontWeight: '500' }}>
                    <li style={{ marginBottom: '8px' }}>Watch the drawer closely.</li>
                    <li style={{ marginBottom: '8px' }}>Type your guesses into the chat box on the right.</li>
                    <li style={{ marginBottom: '8px' }}>The faster you guess the correct word, the more points you earn!</li>
                </ul>
            </div>

            <button
                className="btn-sound"
                onClick={() => {
                    playSound();
                    onBack();
                }}
                style={{
                    padding: '12px',
                    backgroundColor: '#EBC334',
                    color: '#333',
                    border: '3px solid #333',
                    fontFamily: '"Titan One", sans-serif',
                    fontSize: '1.2rem',
                    textTransform: 'uppercase',
                    boxShadow: '4px 4px 0 #333',
                    cursor: 'pointer',
                    transition: 'transform 0.1s',
                    marginTop: '10px'
                }}
                onMouseDown={(e) => e.target.style.transform = 'translate(2px, 2px)'}
                onMouseUp={(e) => e.target.style.transform = 'translate(0, 0)'}
            >
                GO BACK
            </button>
        </div>
    );
};

export default HowToPlay;
