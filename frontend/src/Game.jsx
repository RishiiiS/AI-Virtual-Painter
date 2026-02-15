import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameHeader from './components/GameHeader';
import Toolbar from './components/Toolbar';
import DrawingCanvas from './components/DrawingCanvas';
import Palette from './components/Palette';
import GameChat from './components/GameChat';
import PlayerList from './components/PlayerList';
import { getState, sendChat, getVideoFrame, joinRoom, sendStroke, getStrokes } from './api';

const Game = ({ playerName, roomId, isHost, onEndGame }) => {
    const [gameState, setGameState] = useState(null);
    const [selectedTool, setSelectedTool] = useState('brush');
    const [selectedColor, setSelectedColor] = useState('#333333');
    const [brushSize, setBrushSize] = useState(5);
    const [isDrawer, setIsDrawer] = useState(false);
    const [videoFrame, setVideoFrame] = useState(null);
    const [newStrokes, setNewStrokes] = useState([]);
    const strokeIndexRef = useRef(0);
    const joinedRef = useRef(false);
    const prevRoundActiveRef = useRef(false);
    const prevDrawerRef = useRef(null);

    // Register web player on mount
    useEffect(() => {
        if (!joinedRef.current) {
            joinedRef.current = true;
            joinRoom(roomId, playerName).then(res => {
                console.log("Joined room:", res);
            });
        }
    }, [roomId, playerName]);

    // Poll game state
    useEffect(() => {
        const interval = setInterval(async () => {
            const state = await getState();
            if (state && state[roomId]) {
                const roomData = state[roomId];
                setGameState(roomData);

                const currentlyDrawer = roomData.drawer === playerName;
                setIsDrawer(currentlyDrawer);

                // Poll video if NOT drawer and round active
                if (!currentlyDrawer && roomData.round_active) {
                    const frame = await getVideoFrame(roomId);
                    if (frame) setVideoFrame(frame);
                } else {
                    setVideoFrame(null);
                }

                // Clear canvas on new round OR drawer change
                const newRound = roomData.round_active && !prevRoundActiveRef.current;
                const drawerChanged = roomData.drawer && roomData.drawer !== prevDrawerRef.current;

                if (newRound || drawerChanged) {
                    strokeIndexRef.current = 0;
                    setNewStrokes([{ action: 'clear' }]);
                }

                prevRoundActiveRef.current = roomData.round_active;
                prevDrawerRef.current = roomData.drawer;
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [roomId, playerName]);

    // Poll strokes (for guessers to see what's being drawn)
    useEffect(() => {
        const interval = setInterval(async () => {
            if (isDrawer) return; // Drawer draws locally, no need to poll
            const result = await getStrokes(roomId, strokeIndexRef.current);
            if (result.strokes && result.strokes.length > 0) {
                setNewStrokes(result.strokes);
                strokeIndexRef.current = result.total;
            }
        }, 500); // 500ms polling for responsive drawing
        return () => clearInterval(interval);
    }, [roomId, isDrawer]);

    const handleSendMessage = (msg) => {
        sendChat(roomId, msg, playerName);
    };

    const handleSendStroke = useCallback((stroke) => {
        sendStroke(roomId, playerName, stroke);
    }, [roomId, playerName]);

    const handleUndo = useCallback(() => {
        // Simple undo: clear canvas (could be improved with stroke stack)
        const canvas = document.querySelector('canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }, []);

    if (!gameState) return <div style={{ fontFamily: '"Titan One"', color: 'white', textAlign: 'center', marginTop: '20%' }}>LOADING GAME...</div>;

    // Transform players for PlayerList
    const displayPlayers = (gameState.players || []).map(p => ({
        name: p.name,
        avatar: 'alien',
        status: p.name === gameState.drawer ? 'DRAWING' : 'GUESSING',
        score: p.score,
        isHost: p.is_host,
        color: '#EBC334'
    }));

    return (
        <div style={{
            width: '100%',
            height: '100%',
            padding: '20px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10
        }}>
            <GameHeader
                word={gameState.current_word}
                timeLeft={gameState.time_remaining}
                isDrawer={isDrawer}
            />

            <div style={{
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'center',
                gap: '20px',
                flex: 1,
                minHeight: 0
            }}>

                {/* Left: Toolbar */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '20px',
                    pointerEvents: isDrawer ? 'auto' : 'none',
                    opacity: isDrawer ? 1 : 0.5,
                    width: '80px',
                    flexShrink: 0
                }}>
                    <Toolbar
                        selectedTool={selectedTool}
                        onSelectTool={(t) => {
                            if (t === 'undo') {
                                handleUndo();
                            } else {
                                setSelectedTool(t);
                            }
                        }}
                        brushSize={brushSize}
                        onSelectSize={setBrushSize}
                    />
                </div>

                {/* Center: Canvas & Palette */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '20px',
                    minWidth: 0,
                    minHeight: 0,
                    overflow: 'hidden'
                }}>
                    <DrawingCanvas
                        isDrawer={isDrawer}
                        color={selectedColor}
                        tool={selectedTool}
                        brushSize={brushSize}
                        videoFrame={videoFrame}
                        roomId={roomId}
                        playerName={playerName}
                        onSendStroke={handleSendStroke}
                        strokesFromServer={newStrokes}
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
                    justifyContent: 'center',
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
