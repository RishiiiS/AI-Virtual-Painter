import React, { useState, useEffect, useRef } from 'react';
import LobbyHeader from './components/LobbyHeader';
import PlayerList from './components/PlayerList';
import SettingsPanel from './components/SettingsPanel';
import ChatPanel from './components/ChatPanel';
import { getState, sendChat, startGame, joinRoom } from './api';
import { getSocket, joinSignalingRoom } from './signaling';

const Lobby = ({
  playerName = "WebPlayer",
  roomId = 'room1',
  setRoomId,
  isHost = false,
  avatarKey = 'star',
  onGameStart,
  onRoomEnded,
  onHostStatusChange
}) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [players, setPlayers] = useState([]);
  const joinedRef = useRef(false);
  const hasSeenRoomRef = useRef(false);

  // Register web player on mount AND join the signaling room
  useEffect(() => {
    if (!joinedRef.current) {
      joinedRef.current = true;
      joinRoom(roomId, playerName, avatarKey).then(res => {
        console.log("Lobby: Joined room", res);
      });
      // Join socket signaling room so ready_up and chat events reach server
      joinSignalingRoom(roomId, 'guesser');
    }
  }, [roomId, playerName, avatarKey]);

  // Listen to real-time chat_message events via Socket.IO
  useEffect(() => {
    const socket = getSocket();

    const handleChatMessage = (rawMsg) => {
      try {
        // Backend emits either a string or JSON object with a payload field
        let text = rawMsg;
        if (typeof rawMsg === 'string') {
          try {
            const parsed = JSON.parse(rawMsg);
            text = parsed.payload || parsed.message || rawMsg;
          } catch {
            text = rawMsg;
          }
        } else if (rawMsg && rawMsg.payload) {
          text = rawMsg.payload;
        }
        setChatHistory(prev => [...prev, text]);
      } catch (e) {
        console.error('Chat parse error:', e);
      }
    };

    const handleGameStart = (data) => {
      console.log('socket game_start event received:', data);
      if (onGameStart) onGameStart();
    };
    const handleRoomEnded = () => {
      if (onRoomEnded) onRoomEnded();
    };

    socket.on('chat_message', handleChatMessage);
    socket.on('game_start', handleGameStart);
    socket.on('room_ended', handleRoomEnded);

    return () => {
      socket.off('chat_message', handleChatMessage);
      socket.off('game_start', handleGameStart);
      socket.off('room_ended', handleRoomEnded);
    };
  }, [onGameStart, onRoomEnded]);

  // Poll game state every 1s for players list and game start detection
  useEffect(() => {
    const interval = setInterval(async () => {
      const state = await getState();
      if (state && state[roomId]) {
        hasSeenRoomRef.current = true;
        // Check for Game Start
        if (state[roomId].round_active && onGameStart) {
          onGameStart();
        }

        // Only load chat_history from poll on first render (before any socket messages)
        // After that, trust realtime socket events
        setChatHistory(prev => {
          if (prev.length === 0) {
            return state[roomId].chat_history || [];
          }
          return prev;
        });

        const backendPlayers = state[roomId].players || [];
        const me = backendPlayers.find(p => p.name === playerName);
        if (onHostStatusChange && me) {
          onHostStatusChange(Boolean(me.is_host));
        }
        const mappedPlayers = backendPlayers.map(p => ({
          name: p.name,
          avatar: p.avatar || 'ghost',
          status: p.is_ready ? 'READY' : 'WAITING',
          isHost: p.is_host,
          color: '#EBC334'
        }));
        setPlayers(mappedPlayers);
      } else if (hasSeenRoomRef.current && onRoomEnded) {
        onRoomEnded();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [roomId, onGameStart, onRoomEnded, onHostStatusChange, playerName]);

  const handleSendMessage = (msg) => {
    sendChat(roomId, msg, playerName);
  };

  const handleStartGame = (duration) => {
    startGame(roomId, duration);
  };

  return (
    <div style={{
      width: '100%',
      maxWidth: '1200px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      height: '90vh',
      position: 'relative',
      zIndex: 10
    }}>
      <LobbyHeader roomId={roomId} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr 1fr',
        gap: '20px',
        flex: 1,
        minHeight: 0
      }}>

        {/* Left: Players */}
        <div style={{ minWidth: 0 }}>
          <PlayerList players={players} />
        </div>

        {/* Center: Settings */}
        <div style={{ minWidth: 0 }}>
          <SettingsPanel onStartGame={handleStartGame} isHost={isHost} roomId={roomId} setRoomId={setRoomId} players={players} playerName={playerName} />
        </div>

        {/* Right: Chat */}
        <div style={{ minWidth: 0 }}>
          <ChatPanel
            messages={chatHistory}
            onSendMessage={handleSendMessage}
            currentUser={playerName}
          />
        </div>

      </div>
    </div>
  );
};

export default Lobby;
