import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameHeader from './components/GameHeader';
import Toolbar from './components/Toolbar';
import DrawingCanvas from './components/DrawingCanvas';
import Palette from './components/Palette';
import GameChat from './components/GameChat';
import PlayerList from './components/PlayerList';
import { getState, sendChat, joinRoom, sendStroke, getStrokes } from './api';
import { joinSignalingRoom, sendOffer, sendAnswer, sendIceCandidate, onNewGuesser, onOffer, onAnswer, onIceCandidate, disconnectSignaling } from './signaling';

import SoundManager from './utils/SoundManager'; // Import SoundManager

const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const Game = ({ playerName, roomId, isHost, onEndGame }) => {
    const [gameState, setGameState] = useState(null);
    const [selectedTool, setSelectedTool] = useState('brush');
    const [selectedColor, setSelectedColor] = useState('#333333');
    const [brushSize, setBrushSize] = useState(10);
    const [isDrawer, setIsDrawer] = useState(false);
    const [drawMode, setDrawMode] = useState('mouse'); // 'mouse' or 'gesture'
    const [remoteStream, setRemoteStream] = useState(null);
    const [newStrokes, setNewStrokes] = useState([]);
    const strokeIndexRef = useRef(0);
    const joinedRef = useRef(false);
    const prevRoundActiveRef = useRef(false);
    const prevDrawerRef = useRef(null);

    // WebRTC refs
    const peerConnectionsRef = useRef(new Map()); // guesserSid → RTCPeerConnection
    const localStreamRef = useRef(null);

    // Register web player on mount
    useEffect(() => {
        if (!joinedRef.current) {
            joinedRef.current = true;
            joinRoom(roomId, playerName).then(res => {
                console.log("Joined room:", res);
            });
        }
    }, [roomId, playerName]);

    // Sync round active state to SoundManager
    useEffect(() => {
        if (gameState) {
            SoundManager.setRoundActive(gameState.round_active);
        }
    }, [gameState?.round_active]);

    // Drawer WebRTC: one peer connection per guesser (mesh model)
    useEffect(() => {
        if (!isDrawer) {
            // Cleanup all connections when no longer drawer
            peerConnectionsRef.current.forEach(pc => pc.close());
            peerConnectionsRef.current.clear();
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
                localStreamRef.current = null;
            }
            return;
        }

        const startDrawerWebRTC = async () => {
            try {
                // Queue to hold guessers that arrive before camera is ready
                const pendingGuessers = [];
                let cameraReady = false;

                // 1. Define peer creation function
                const createPeerForGuesser = async (guesserSid) => {
                    if (!localStreamRef.current) {
                        console.log(`[WebRTC Drawer] Camera not ready, queuing guesser ${guesserSid}`);
                        pendingGuessers.push(guesserSid);
                        return;
                    }

                    // Close existing connection for this guesser if any
                    if (peerConnectionsRef.current.has(guesserSid)) {
                        peerConnectionsRef.current.get(guesserSid).close();
                    }

                    const pc = new RTCPeerConnection(ICE_SERVERS);
                    peerConnectionsRef.current.set(guesserSid, pc);

                    // Add camera tracks
                    localStreamRef.current.getTracks().forEach(track => {
                        pc.addTrack(track, localStreamRef.current);
                    });

                    // ICE candidates → send to this specific guesser
                    pc.onicecandidate = (event) => {
                        if (event.candidate) {
                            sendIceCandidate(roomId, event.candidate, guesserSid);
                        }
                    };

                    pc.oniceconnectionstatechange = () => {
                        console.log(`[WebRTC Drawer] ICE state for ${guesserSid}:`, pc.iceConnectionState);
                        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                            pc.close();
                            peerConnectionsRef.current.delete(guesserSid);
                        }
                    };

                    // Create and send offer to this guesser
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    sendOffer(roomId, offer, guesserSid);
                    console.log(`[WebRTC Drawer] Offer sent to ${guesserSid}`);
                };

                // 2. Set up ALL event listeners FIRST (before joining signaling)
                onNewGuesser((data) => {
                    console.log('[WebRTC Drawer] New guesser:', data.guesser_sid);
                    createPeerForGuesser(data.guesser_sid);
                });

                onAnswer((data) => {
                    const pc = peerConnectionsRef.current.get(data.from);
                    if (pc && pc.signalingState !== 'closed') {
                        pc.setRemoteDescription(new RTCSessionDescription(data.answer))
                            .then(() => console.log(`[WebRTC Drawer] Answer set from ${data.from}`))
                            .catch(err => console.error('[WebRTC Drawer] Answer error:', err));
                    }
                });

                onIceCandidate((data) => {
                    const pc = peerConnectionsRef.current.get(data.from);
                    if (pc && pc.signalingState !== 'closed' && data.candidate) {
                        pc.addIceCandidate(new RTCIceCandidate(data.candidate))
                            .catch(err => console.error('[WebRTC Drawer] ICE error:', err));
                    }
                });

                // 3. Join signaling room (triggers new_guesser events — listeners are ready)
                joinSignalingRoom(roomId, 'drawer');

                // 4. Get camera (may take time for permission dialog)
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                localStreamRef.current = stream;
                console.log('[WebRTC Drawer] Camera acquired');

                // 5. Process any guessers that arrived while camera was starting
                console.log(`[WebRTC Drawer] Processing ${pendingGuessers.length} queued guessers`);
                for (const guesserSid of pendingGuessers) {
                    await createPeerForGuesser(guesserSid);
                }

            } catch (err) {
                console.error('[WebRTC Drawer] Setup error:', err);
            }
        };

        startDrawerWebRTC();

        return () => {
            peerConnectionsRef.current.forEach(pc => pc.close());
            peerConnectionsRef.current.clear();
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
                localStreamRef.current = null;
            }
        };
    }, [isDrawer, roomId]);

    // Guesser WebRTC: receive offer, create answer, handle ICE, display remote video
    useEffect(() => {
        if (isDrawer) {
            // Cleanup guesser connection if switching to drawer
            setRemoteStream(null);
            return;
        }

        let guesserPC = null;
        let drawerSid = null; // Captured from the offer

        const setupGuesserWebRTC = () => {
            // Join signaling room as guesser (always re-join to register correct role)
            joinSignalingRoom(roomId, 'guesser');

            // Listen for offer from drawer
            onOffer(async (data) => {
                try {
                    console.log('[WebRTC Guesser] Received offer from', data.from);
                    drawerSid = data.from; // Remember drawer's SID

                    // Close old connection if exists
                    if (guesserPC) guesserPC.close();

                    // Create peer connection
                    guesserPC = new RTCPeerConnection(ICE_SERVERS);

                    // Handle ICE candidates — send to drawer's SID
                    guesserPC.onicecandidate = (event) => {
                        if (event.candidate && drawerSid) {
                            sendIceCandidate(roomId, event.candidate, drawerSid);
                        }
                    };

                    guesserPC.oniceconnectionstatechange = () => {
                        console.log('[WebRTC Guesser] ICE state:', guesserPC.iceConnectionState);
                    };

                    // Handle remote stream (drawer's video)
                    guesserPC.ontrack = (event) => {
                        console.log('[WebRTC Guesser] Received remote track');
                        if (event.streams && event.streams[0]) {
                            setRemoteStream(event.streams[0]);
                        }
                    };

                    // Set remote description (offer)
                    await guesserPC.setRemoteDescription(new RTCSessionDescription(data.offer));

                    // Create and send answer
                    const answer = await guesserPC.createAnswer();
                    await guesserPC.setLocalDescription(answer);
                    sendAnswer(roomId, answer);
                    console.log('[WebRTC Guesser] Answer sent');

                } catch (err) {
                    console.error('[WebRTC Guesser] Error:', err);
                }
            });

            // Listen for ICE candidates from drawer
            onIceCandidate((data) => {
                if (guesserPC && guesserPC.signalingState !== 'closed' && data.candidate) {
                    guesserPC.addIceCandidate(new RTCIceCandidate(data.candidate))
                        .catch(err => console.error('[WebRTC Guesser] ICE error:', err));
                }
            });
        };

        setupGuesserWebRTC();

        return () => {
            if (guesserPC) {
                guesserPC.close();
                guesserPC = null;
            }
            setRemoteStream(null);
        };
    }, [isDrawer, roomId]);

    // Poll game state
    useEffect(() => {
        const interval = setInterval(async () => {
            const state = await getState();
            if (state && state[roomId]) {
                const roomData = state[roomId];
                setGameState(roomData);

                const currentlyDrawer = roomData.drawer === playerName;
                setIsDrawer(currentlyDrawer);

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

    // Keyboard shortcut: G=gesture, M=mouse
    useEffect(() => {
        const handleKey = (e) => {
            if (!isDrawer) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'g' || e.key === 'G') {
                setDrawMode('gesture');
                console.log('[Mode] Switched to GESTURE');
            } else if (e.key === 'm' || e.key === 'M') {
                setDrawMode('mouse');
                console.log('[Mode] Switched to MOUSE');
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isDrawer]);

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
                isRoundActive={gameState.round_active}
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
                        remoteStream={remoteStream}
                        roomId={roomId}
                        playerName={playerName}
                        onSendStroke={handleSendStroke}
                        strokesFromServer={newStrokes}
                        drawMode={drawMode}
                        localStream={localStreamRef.current}
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
