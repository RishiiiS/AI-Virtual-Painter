import React, { useState } from 'react';

const NicknameInput = () => {
    const [name, setName] = useState('');

    return (
        <div style={{ marginBottom: '20px' }}>
            <input
                type="text"
                placeholder="ENTER YOUR NICKNAME"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                    width: '100%',
                    padding: '15px',
                    fontSize: '1.2rem',
                    fontFamily: '"Titan One", sans-serif',
                    textAlign: 'center',
                    border: '3px solid #333',
                    outline: 'none',
                    backgroundColor: '#fff',
                    boxShadow: '4px 4px 0 rgba(0,0,0,0.2)',
                    textTransform: 'uppercase'
                }}
            />
        </div>
    );
};

export default NicknameInput;
