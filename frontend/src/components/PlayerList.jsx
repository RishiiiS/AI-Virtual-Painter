import React from 'react';

const PlayerList = ({ players: initialPlayers = [] }) => {
    let players = initialPlayers;
    // Fallback if empty (e.g. backend not running yet)
    if (players.length === 0) {
        players = [
            { name: 'Waiting...', avatar: 'alien', status: '...', isHost: false, color: '#ccc' }
        ];
    }

    return (
        <div style={{
            backgroundColor: 'white',
            border: '4px solid #333',
            padding: '20px',
            boxShadow: '8px 8px 0 rgba(0,0,0,0.1)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <h3 style={{
                fontFamily: '"Titan One", sans-serif',
                fontSize: '1.2rem',
                borderBottom: '4px solid #333',
                paddingBottom: '10px',
                margin: '0 0 20px 0',
                textTransform: 'uppercase'
            }}>
                PLAYERS (4/8)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {players.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {/* Avatar Box */}
                        <div style={{
                            width: '50px',
                            height: '50px',
                            backgroundColor: p.color,
                            border: '3px solid #333',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem'
                        }}>
                            {p.avatar === 'alien' ? '👾' : p.avatar}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontFamily: '"Titan One", sans-serif',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}>
                                {p.name}
                                {p.isHost && <span title="Host">👑</span>}
                                {p.isHost && <span style={{ fontSize: '0.8rem', color: '#666' }}>(HOST)</span>}
                            </div>

                            <div style={{
                                marginTop: '5px',
                                backgroundColor: p.status === 'READY' ? '#333' : '#ccc',
                                color: 'white',
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                fontFamily: '"Fredoka", sans-serif',
                                fontWeight: 'bold',
                                display: 'inline-block',
                                borderRadius: '2px'
                            }}>
                                {p.status}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlayerList;
