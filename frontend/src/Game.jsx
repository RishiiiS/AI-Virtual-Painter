import React, { useState, useEffect } from 'react';
import GameHeader from './components/GameHeader';
import Toolbar from './components/Toolbar';
import DrawingCanvas from './components/DrawingCanvas';
import Palette from './components/Palette';
import GameChat from './components/GameChat';
import PlayerList from './components/PlayerList'; // Reuse PlayerList
import { getState, sendChat } from './api';

const Game = ({ playerName, roomId, onEndGame }) => {
    const [gameState, setGameState] = useState(null);
    const [selectedTool, setSelectedTool] = useState('brush');
    const [selectedColor, setSelectedColor] = useState('#333333');
    const [brushSize, setBrushSize] = useState(5); // Default size
    const [isDrawer, setIsDrawer] = useState(false);

    useEffect(() => {
        const interval = setInterval(async () => {
            const state = await getState();
            if (state && state[roomId]) {
                const roomData = state[roomId];
                setGameState(roomData);

                // Check if current user is drawer
                // Note: roomData.drawer is the name of the drawer
                setIsDrawer(roomData.drawer === playerName);

                // Check if round ended (optional: could auto-redirect or show game over screen)
                if (!roomData.round_active) {
                    // Logic to handle end of round/game
                }
            }
        }, 1000); // 1s polling
        return () => clearInterval(interval);
    }, [roomId, playerName]);

    const handleSendMessage = (msg) => {
        sendChat(roomId, msg, playerName);
    };

    if (!gameState) return <div style={{ fontFamily: '"Titan One"', color: 'white', textAlign: 'center', marginTop: '20%' }}>LOADING GAME...</div>;

    // Transform players for PlayerList
    // PlayerList expects: [{name, avatar, status, isHost, color, score}]
    const displayPlayers = (gameState.players || []).map(p => ({
        name: p.name,
        avatar: 'alien', // Placeholder
        status: p.name === gameState.drawer ? 'DRAWING' : 'GUESSING',
        score: p.score,
        isHost: p.is_host,
        color: '#EBC334' // Placeholder
    }));

    return (
        <div style={{
            width: '100%',
            height: '100%', // Changed from 100vh to fit container
            padding: '20px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden', // Prevent full page scroll
            position: 'relative', // Ensure above background
            zIndex: 10          // Ensure above background
        }}>
            <GameHeader
                word={gameState.current_word}
                timeLeft={gameState.time_remaining}
                isDrawer={isDrawer}
            />

            <div style={{
                display: 'flex',
                alignItems: 'stretch', // Stretch columns to full height
                justifyContent: 'center',
                gap: '20px',
                flex: 1,
                minHeight: 0 // Allow grid/flex children to shrink
            }}>

                {/* Left: Toolbar */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center', // Center toolbar vertically
                    gap: '20px',
                    pointerEvents: isDrawer ? 'auto' : 'none',
                    opacity: isDrawer ? 1 : 0.5,
                    width: '80px', // Fixed width for toolbar
                    flexShrink: 0
                }}>
                    <Toolbar
                        selectedTool={selectedTool}
                        onSelectTool={setSelectedTool}
                        brushSize={brushSize}
                        onSelectSize={setBrushSize}
                    />
                </div>

                {/* Center: Canvas & Palette */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center', // Center vertically
                    gap: '20px',
                    minWidth: 0,
                    minHeight: 0, // Critical for nested flex scrolling/shrinking
                    overflow: 'hidden'
                }}>
                    <DrawingCanvas
                        isDrawer={isDrawer}
                        color={selectedColor}
                        tool={selectedTool}
                        brushSize={brushSize}
                    />

                    {/* Palette (Only if Drawer) */}
                    <div style={{
                        pointerEvents: isDrawer ? 'auto' : 'none',
                        opacity: isDrawer ? 1 : 0.5,
                        display: 'flex',
                        justifyContent: 'center'
                    }}>
                        <Palette selectedColor={selectedColor} onSelectColor={setSelectedColor} />
                    </div>
                </div>

                {/* Right: Players & Chat */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center', // Center vertically
                    gap: '20px',
                    width: '300px',
                    flexShrink: 0,
                    height: '100%'
                }}>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <PlayerList players={displayPlayers} />
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <GameChat
                            messages={gameState.chat_history}
                            onSendMessage={handleSendMessage}
                            currentUser={playerName}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Game;
