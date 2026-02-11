
import React, { useState } from 'react'
import './App.css'
import Header from './components/Header'
import AvatarSelector from './components/AvatarSelector'
import NicknameInput from './components/NicknameInput'
import ActionButtons from './components/ActionButtons'
import Footer from './components/Footer'
import Lobby from './Lobby'

import JoinRoom from './components/JoinRoom'

function App() {
  const [view, setView] = useState('landing'); // 'landing' | 'lobby' | 'join'
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState('room1'); // Default
  const [isHost, setIsHost] = useState(false);

  if (view === 'lobby') {
    return (
      <div className="app-container" style={{ maxWidth: '100%', height: '100vh', justifyContent: 'flex-start' }}>
        {/* Same background shapes as Landing Page */}
        <div className="shape shape-triangle-tl"></div>
        <div className="shape shape-rect-br"></div>
        <div className="shape shape-circle-br"></div>
        <div className="shape shape-rect-bl"></div>
        <Lobby playerName={nickname || "WebPlayer"} roomId={roomId} setRoomId={setRoomId} isHost={isHost} />
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

          {view === 'landing' ? (
            <>
              <AvatarSelector />
              <NicknameInput value={nickname} onChange={setNickname} />
              <ActionButtons
                onCreate={() => {
                  setRoomId('room1'); // For now static, later random
                  setIsHost(true);
                  setView('lobby');
                }}
                onJoin={() => setView('join')}
              />
            </>
          ) : (
            <JoinRoom
              onJoin={(code) => {
                setRoomId(code);
                setIsHost(false);
                setView('lobby');
              }}
              onBack={() => setView('landing')}
            />
          )}

        </div>

        <Footer />
      </div>
    </>
  )
}

export default App
