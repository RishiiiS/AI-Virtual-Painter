import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';

const GameChat = ({ messages = [], onSendMessage, currentUser }) => {
    const [inputValue, setInputValue] = useState("");
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    const handleSend = () => {
        if (inputValue.trim()) {
            onSendMessage(inputValue);
            setInputValue("");
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: 'white',
            border: '4px solid #333',
            boxShadow: '8px 8px 0 rgba(0,0,0,0.2)',
        }}>
            {/* Header */}
            <div style={{
                backgroundColor: '#2A8C86',
                padding: '10px',
                borderBottom: '4px solid #333',
                color: 'white',
                fontFamily: '"Titan One", sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                <MessageSquare size={20} strokeWidth={3} />
                <span>GUESSES</span>
            </div>

            {/* Messages Area */}
            <div
                ref={messagesEndRef}
                style={{
                    flex: 1,
                    padding: '10px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontFamily: '"Fredoka", sans-serif',
                    fontSize: '0.9rem'
                }}
            >
                {messages.map((msgStr, i) => {
                    let sender = "System";
                    let content = msgStr;
                    let color = '#333';
                    let isSystem = false;
                    let isCorrectGuess = false;

                    // Message Parsing
                    const match = msgStr.match(/^\[(.*?)]: (.*)/);
                    if (match) {
                        sender = match[1];
                        content = match[2];
                        const hash = sender.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                        const colors = ['#EBC334', '#2A8C86', '#D96C2C', '#69B578', '#CC444B'];
                        color = colors[hash % colors.length];

                        if (sender === 'ADMIN' || sender === 'System' || msgStr.includes("guessed correctly!")) {
                            color = '#2A8C86'; // System/Success color
                            isSystem = true;
                            if (msgStr.includes("guessed correctly")) isCorrectGuess = true;
                        }
                    } else {
                        // System message without sender bracket
                        isSystem = true;
                        color = '#2A8C86';
                    }

                    if (isCorrectGuess || content.includes("guessed the word")) {
                        return (
                            <div key={i} style={{
                                backgroundColor: '#E0F2F1',
                                border: '2px solid #2A8C86',
                                padding: '5px',
                                color: '#00695C',
                                fontWeight: 'bold'
                            }}>
                                {content}
                            </div>
                        );
                    }

                    return (
                        <div key={i} style={{ lineHeight: '1.4' }}>
                            {!isSystem && <span style={{ color: color, fontWeight: 'bold' }}>{sender}: </span>}
                            <span style={{ color: isSystem ? '#777' : '#333', fontStyle: isSystem ? 'italic' : 'normal' }}>
                                {isSystem ? msgStr.replace(/\[System\]: |SYSTEM: /, '') : content}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Input Area */}
            <div style={{
                padding: '10px',
                borderTop: '3px solid #333',
                backgroundColor: '#eee',
                display: 'flex',
                gap: '8px'
            }}>
                <input
                    type="text"
                    placeholder="TYPE GUESS..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        padding: '10px',
                        border: '3px solid #333',
                        fontFamily: '"Fredoka", sans-serif',
                        fontSize: '1rem',
                        boxSizing: 'border-box',
                        outline: 'none',
                        textTransform: 'uppercase'
                    }}
                />
                <button
                    onClick={handleSend}
                    className="btn-sound"
                    style={{
                        padding: '0 15px',
                        backgroundColor: '#EBC334',
                        color: '#333',
                        border: '3px solid #333',
                        fontFamily: '"Titan One", sans-serif',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        boxShadow: '3px 3px 0 #333',
                        transition: 'transform 0.1s'
                    }}
                    onMouseDown={(e) => e.target.style.transform = 'translate(2px, 2px)'}
                    onMouseUp={(e) => e.target.style.transform = 'translate(0, 0)'}
                >
                    SEND
                </button>
            </div>
        </div>
    );
};

export default GameChat;
