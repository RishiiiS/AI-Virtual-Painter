
import React, { useState } from 'react'
import './App.css'
import Header from './components/Header'
import AvatarSelector from './components/AvatarSelector'
import { AVATAR_KEYS } from './components/AvatarIcon'
import NicknameInput from './components/NicknameInput'
import ActionButtons from './components/ActionButtons'
import Footer from './components/Footer'
import Game from './Game'
import Lobby from './Lobby'
import JoinRoom from './components/JoinRoom'
import Settings from './components/Settings'
import { checkRoom, createRoom } from './api';
import SoundManager from './utils/SoundManager'; // Import SoundManager

function App() {
  // Global click sound
  React.useEffect(() => {
    const handleGlobalClick = (e) => {
      // Strict check: Play only for elements explicitly marked with 'btn-sound' class
      if (e.target.closest('.btn-sound')) {
        SoundManager.playClick();
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const [view, setView] = useState('landing'); // 'landing' | 'lobby' | 'join' | 'game' | 'settings'
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState('room1'); // Default
  const [isHost, setIsHost] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(1);

  const [nicknameError, setNicknameError] = useState('');

  if (view === 'game') {
    return (
      <div className="app-container" style={{ maxWidth: '100%', height: '100vh', justifyContent: 'flex-start' }}>
        {/* Same background shapes */}
        <div className="shape shape-triangle-tl"></div>
        <div className="shape shape-rect-br"></div>
        <div className="shape shape-circle-br"></div>
        <div className="shape shape-rect-bl"></div>
        <Game
          playerName={nickname || "WebPlayer"}
          roomId={roomId}
          isHost={isHost}
          avatarKey={AVATAR_KEYS[selectedAvatar] || 'star'}
          onEndGame={() => setView('landing')}
        />
      </div>
    );
  }

  if (view === 'lobby') {
    return (
      <div className="app-container" style={{ maxWidth: '100%', height: '100vh', justifyContent: 'center' }}>
        {/* Same background shapes as Landing Page */}
        <div className="shape shape-triangle-tl"></div>
        <div className="shape shape-rect-br"></div>
        <div className="shape shape-circle-br"></div>
        <div className="shape shape-rect-bl"></div>
        <Lobby
          playerName={nickname || "WebPlayer"}
          roomId={roomId}
          setRoomId={setRoomId}
          isHost={isHost}
          avatarKey={AVATAR_KEYS[selectedAvatar] || 'star'}
          onGameStart={() => setView('game')}
        />
      </div>
    );
  }

  return (
    <>
      {/* Background Shapes */}
      <div className="shape shape-triangle-tl"></div>
      <div className="shape shape-rect-br"></div>
      <div className="shape shape-circle-br"></div>
      <div className="shape shape-rect-bl"></div>

      <div className="app-container">
        <Header />

        {/* Main Card */}
        <div style={{
          backgroundColor: '#fff',
          padding: '40px',
          width: '500px',
          border: '4px solid #333',
          boxShadow: '8px 8px 0 rgba(0,0,0,0.8)',
          position: 'relative',
          zIndex: 10,
          textAlign: 'center'
        }}>
          {/* Version Sticker */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            backgroundColor: '#2A8C86',
            color: 'white',
            padding: '10px 15px',
            border: '3px solid #333',
            fontFamily: '"Titan One", sans-serif',
            transform: 'rotate(10deg)',
            boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
            zIndex: 10
          }}>
            V.1
          </div>

          {view === 'settings' ? (
            <Settings onBack={() => setView('landing')} />
          ) : view === 'landing' ? (
            <>
              <AvatarSelector selected={selectedAvatar} onSelect={setSelectedAvatar} />
              <NicknameInput value={nickname} onChange={(val) => { setNickname(val); setNicknameError(''); }} />
              {nicknameError && (
                <div style={{
                  color: '#D96C2C',
                  fontFamily: '"Fredoka", sans-serif',
                  fontWeight: 'bold',
                  marginBottom: '15px',
                  fontSize: '1.1rem'
                }}>
                  {nicknameError}
                </div>
              )}
              <ActionButtons
                onCreate={async () => {
                  if (!nickname.trim()) {
                    setNicknameError("PLEASE ENTER A NICKNAME FIRST!");
                    return;
                  }
                  const res = await createRoom();
                  if (res.room_id) {
                    setRoomId(res.room_id);
                    setIsHost(true);
                    setView('lobby');
                  } else {
                    setNicknameError("Failed to create room: " + (res.error || "Unknown error"));
                  }
                }}
                onJoin={() => {
                  if (!nickname.trim()) {
                    setNicknameError("PLEASE ENTER A NICKNAME FIRST!");
                    return;
                  }
                  setView('join');
                }}
              />
            </>
          ) : (
            <JoinRoom
              onJoin={(code) => {
                if (!nickname.trim()) {
                  setNicknameError("PLEASE ENTER A NICKNAME FIRST!");
                  return;
                }
                setRoomId(code);
                setIsHost(false);
                setView('lobby');
              }}
              onBack={() => setView('landing')}
            />
          )}

        </div>

        <Footer onSettings={() => setView('settings')} />
      </div >
    </>
  )
}

export default App
