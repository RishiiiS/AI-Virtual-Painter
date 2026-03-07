import React from 'react';
import { Crown, Pencil, Eye } from 'lucide-react';
import AvatarIcon from './AvatarIcon';

const getStatusStyle = (status) => {
    switch (status) {
        case 'DRAWING':
            return { backgroundColor: '#D96C2C', color: 'white' };
        case 'GUESSING':
            return { backgroundColor: '#2A8C86', color: 'white' };
        case 'READY':
            return { backgroundColor: '#333', color: 'white' };
        default:
            return { backgroundColor: '#ccc', color: 'white' };
    }
};

const PlayerList = ({ players: initialPlayers = [] }) => {
    let players = initialPlayers;
    if (players.length === 0) {
        players = [
            { name: 'Waiting...', avatar: 'ghost', status: '...', isHost: false, color: '#ccc' }
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
            flexDirection: 'column',
            overflow: 'auto'
        }}>
            <h3 style={{
                fontFamily: '"Titan One", sans-serif',
                fontSize: '1.2rem',
                borderBottom: '4px solid #333',
                paddingBottom: '10px',
                margin: '0 0 15px 0',
                textTransform: 'uppercase'
            }}>
                PLAYERS ({players.length}/8)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {players.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Avatar Box */}
                        <div style={{
                            width: '45px',
                            height: '45px',
                            backgroundColor: p.color,
                            border: '3px solid #333',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <AvatarIcon avatarKey={p.avatar || 'ghost'} size={24} strokeWidth={2} />
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontFamily: '"Titan One", sans-serif',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                {p.isHost && <span title="Host" style={{ display: 'flex', alignItems: 'center', color: '#EBC334', flexShrink: 0 }}><Crown size={14} strokeWidth={2.5} /></span>}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                <div style={{
                                    ...getStatusStyle(p.status),
                                    padding: '2px 8px',
                                    fontSize: '0.65rem',
                                    fontFamily: '"Fredoka", sans-serif',
                                    fontWeight: 'bold',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    borderRadius: '2px'
                                }}>
                                    {p.status === 'DRAWING' && <Pencil size={10} strokeWidth={2.5} />}
                                    {p.status === 'GUESSING' && <Eye size={10} strokeWidth={2.5} />}
                                    {p.status}
                                </div>
                            </div>
                        </div>

                        {/* Score */}
                        {p.score !== undefined && (
                            <div style={{
                                fontFamily: '"Titan One", sans-serif',
                                fontSize: '0.9rem',
                                color: '#333',
                                flexShrink: 0
                            }}>
                                {p.score}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlayerList;
