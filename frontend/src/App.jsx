
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
import HowToPlay from './components/HowToPlay'
import { checkRoom, createRoom } from './api';
import SoundManager from './utils/SoundManager'; // Import SoundManager

function App() {
  const [isInitializing, setIsInitializing] = useState(true);

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

  const [view, setView] = useState(() => sessionStorage.getItem('dd_view') || 'landing'); // 'landing' | 'lobby' | 'join' | 'game' | 'settings' | 'howtoplay'
  const [nickname, setNickname] = useState(() => sessionStorage.getItem('dd_nickname') || '');
  const [roomId, setRoomId] = useState(() => sessionStorage.getItem('dd_roomId') || 'room1');
  const [isHost, setIsHost] = useState(() => sessionStorage.getItem('dd_isHost') === 'true');
  const [selectedAvatar, setSelectedAvatar] = useState(() => parseInt(sessionStorage.getItem('dd_avatar')) || 1);

  React.useEffect(() => {
    sessionStorage.setItem('dd_view', view);
    sessionStorage.setItem('dd_nickname', nickname);
    sessionStorage.setItem('dd_roomId', roomId);
    sessionStorage.setItem('dd_isHost', String(isHost));
    sessionStorage.setItem('dd_avatar', String(selectedAvatar));
  }, [view, nickname, roomId, isHost, selectedAvatar]);

  // Handle reload routing: force user back to 'game' or 'lobby' depending on backend state
  React.useEffect(() => {
    const verifyState = async () => {
      if ((view === 'lobby' || view === 'game') && roomId) {
        try {
          const res = await checkRoom(roomId);
          if (res && res.exists) {
            // If backend says round is active, force 'game' view
            if (res.round_active) {
              setView('game');
            }
            // If backend says round isn't active but we were in 'game', force 'lobby'
            else if (view === 'game') {
              setView('lobby');
            }
          } else {
            // Room doesn't exist anymore, reset
            setView('landing');
          }
        } catch (e) {
          console.error("Failed to verify room state on load", e);
        }
      }
      setIsInitializing(false);
    };
    verifyState();
  }, []); // Run ONLY on mount — handles page refresh recovery, not new room navigation


  const [nicknameError, setNicknameError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const returnToHome = React.useCallback(() => {
    setIsHost(false);
    setView('landing');
  }, []);

  if (isInitializing) {
    return <div style={{
      backgroundColor: '#F7EDE2', height: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Titan One", sans-serif', color: '#333'
    }}>LOADING...</div>;
  }

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
          onEndGame={returnToHome}
          onHostStatusChange={setIsHost}
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
          onRoomEnded={returnToHome}
          onHostStatusChange={setIsHost}
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
          ) : view === 'howtoplay' ? (
            <HowToPlay onBack={() => setView('landing')} />
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
                  if (isCreating) return;
                  setIsCreating(true);
                  try {
                    const res = await createRoom();
                    if (res.room_id) {
                      setRoomId(res.room_id);
                      setIsHost(true);
                      setView('lobby');
                    } else {
                      setNicknameError("Failed to create room: " + (res.error || "Unknown error"));
                    }
                  } finally {
                    setIsCreating(false);
                  }
                }}
                isCreating={isCreating}

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

        <Footer onSettings={() => setView('settings')} onHowToPlay={() => setView('howtoplay')} />
      </div >
    </>
  )
}

export default App
