
import React from 'react';

const ChatPanel = ({ messages = [], onSendMessage, currentUser }) => {
  const [input, setInput] = React.useState('');

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      border: '4px solid #333',
      backgroundColor: 'white',
      boxShadow: '8px 8px 0 rgba(0,0,0,0.1)',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#2A8C86',
        padding: '15px',
        borderBottom: '4px solid #333',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span style={{ color: 'white', fontSize: '1.2rem' }}>💬</span>
        <span style={{
          fontFamily: '"Titan One", sans-serif',
          color: 'white',
          fontSize: '1.2rem',
          textTransform: 'uppercase'
        }}>
          LOBBY CHAT
        </span>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        padding: '15px',
        overflowY: 'auto',
        fontFamily: '"Fredoka", sans-serif',
        fontSize: '0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        backgroundColor: '#F4F4F4'
      }}>
        {messages.map((msgStr, i) => {
          // Primitive parsing of "[Name]: Msg" format from backend
          let sender = "System";
          let content = msgStr;
          let color = '#333';
          let isSystem = false;

          // Check if message format is [Name]: Msg
          const match = msgStr.match(/^\[(.*?)]: (.*)/);
          if (match) {
            sender = match[1];
            content = match[2];
            // Simple color logic hash
            const hash = sender.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const colors = ['#EBC334', '#2A8C86', '#D96C2C', '#69B578', '#CC444B'];
            color = colors[hash % colors.length];
            if (sender === 'ADMIN' || sender === 'System') color = '#888';
          } else {
            isSystem = true;
          }

          return (
            <div key={i} style={{ lineHeight: '1.4' }}>
              <span style={{ color: color, fontWeight: 'bold' }}>{sender !== 'System' ? `[${sender}]` : ''}</span>
              <span style={{ fontWeight: 'bold' }}>{sender !== 'System' ? ': ' : ''}</span>
              <span style={{ color: isSystem ? '#888' : '#333', fontStyle: isSystem ? 'italic' : 'normal' }}>{content}</span>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div style={{
        padding: '15px',
        borderTop: '4px solid #333',
        display: 'flex',
        gap: '10px',
        backgroundColor: 'white'
      }}>
        <input
          type="text"
          placeholder="SAY SOMETHING..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontFamily: '"Fredoka", sans-serif',
            fontSize: '1rem',
            fontWeight: 'bold',
            color: '#333'
          }}
        />
        <button
          onClick={handleSend}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '1.5rem',
            transform: 'rotate(-90deg)' // Placeholder arrow logic
          }}>
          ➤
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;

