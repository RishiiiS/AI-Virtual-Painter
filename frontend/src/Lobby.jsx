
import React, { useState, useEffect } from 'react';
import LobbyHeader from './components/LobbyHeader';
import PlayerList from './components/PlayerList';
import SettingsPanel from './components/SettingsPanel';
import ChatPanel from './components/ChatPanel';
import { getState, sendChat, startGame } from './api';

const Lobby = ({ playerName = "WebPlayer", roomId = 'room1', setRoomId, isHost = false, onGameStart }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [players, setPlayers] = useState([]); // Need to update PlayerList to accept this

  useEffect(() => {
    const interval = setInterval(async () => {
      const state = await getState();
      if (state && state[roomId]) {
        // Check for Game Start
        if (state[roomId].round_active && onGameStart) {
          onGameStart();
        }

        setChatHistory(state[roomId].chat_history || []);
        // Transformation for PlayerList if formats differ
        // Backend returns: [{name, score, is_host}, ...]
        // PlayerList expects: [{name, avatar, status, isHost, color}]
        // We'll map it roughly.
        const backendPlayers = state[roomId].players || [];
        const mappedPlayers = backendPlayers.map(p => ({
          name: p.name,
          avatar: 'alien', // Placeholder
          status: 'READY',
          isHost: p.is_host,
          color: '#EBC334' // Placeholder
        }));
        setPlayers(mappedPlayers);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [roomId, onGameStart]);

  const handleSendMessage = (msg) => {
    sendChat(roomId, msg, playerName);
  };

  const handleStartGame = () => {
    startGame(roomId);
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
          <SettingsPanel onStartGame={handleStartGame} isHost={isHost} roomId={roomId} setRoomId={setRoomId} />
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

