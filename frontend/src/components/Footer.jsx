import React from 'react';

const Footer = ({ onSettings }) => {
    return (
        <div style={{
            marginTop: '50px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            fontFamily: '"Titan One", sans-serif',
            fontSize: '0.9rem',
            color: '#555',
            letterSpacing: '1px'
        }}>
            <a href="#" style={{ color: '#333', textDecoration: 'none', borderBottom: '3px solid #EBC334' }}>HOW TO PLAY</a>
            <a
                href="#"
                onClick={(e) => { e.preventDefault(); onSettings && onSettings(); }}
                style={{ color: '#333', textDecoration: 'none', borderBottom: '3px solid #D96C2C' }}
            >
                SETTINGS
            </a>
        </div>
    );
};

export default Footer;
