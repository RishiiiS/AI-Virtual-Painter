import React from 'react';

const Header = () => {
    return (
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{
                fontFamily: '"Titan One", sans-serif',
                fontSize: '5rem',
                color: '#EBC334',
                textShadow: '4px 4px 0 #333, -2px -2px 0 #333, 2px -2px 0 #333, -2px 2px 0 #333, 4px 4px 0 #333',
                letterSpacing: '5px',
                margin: '0',
                lineHeight: '1',
                textTransform: 'uppercase'
            }}>
                DOODLEDASH
            </h1>
            <h2 style={{
                fontFamily: '"Pacifico", cursive',
                fontSize: '2rem',
                color: '#333',
                margin: '10px 0 0 0',
                transform: 'rotate(-3deg)'
            }}>
                Multiplayer Mayhem!
            </h2>
        </div>
    );
};

export default Header;
