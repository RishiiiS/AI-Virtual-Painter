import React, { useState, useEffect } from 'react';
import AvatarIcon from './AvatarIcon';

const ResultPage = ({ word, results = [], roomId, onNextRound }) => {
    // Local countdown timer (10 seconds)
    const [countdown, setCountdown] = useState(10);

    useEffect(() => {
        setCountdown(10); // Reset on mount
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);
    // Top 3 players logic
    const topPlayers = results.slice(0, 3);

    // Fallbacks if fewer players exist
    const firstPlace = topPlayers[0];
    const secondPlace = topPlayers[1];
    const thirdPlace = topPlayers[2];

    return (
        <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#F5ECCD',
            backgroundImage: `linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            fontFamily: '"Titan One", sans-serif',
        }}>
            {/* Background geometric shapes */}
            {/* Top Left Yellow Triangle */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '500px', height: '500px', backgroundColor: '#EBC334', clipPath: 'polygon(0 0, 100% 0, 0 100%)', borderRight: '4px solid #333', borderBottom: '4px solid #333', zIndex: 0 }}></div>
            {/* Bottom Left Yellow Diamond */}
            <div style={{ position: 'absolute', bottom: '20px', left: '100px', width: '150px', height: '150px', backgroundColor: '#EBC334', transform: 'rotate(45deg)', border: '4px solid #333', zIndex: 0 }}></div>
            {/* Bottom Right Orange Polygons */}
            <div style={{ position: 'absolute', bottom: -100, right: '-50px', width: '400px', height: '500px', backgroundColor: '#D96C2C', clipPath: 'polygon(100% 0, 0 80%, 0 100%, 100% 100%)', borderLeft: '4px solid #333', borderTop: '4px solid #333', zIndex: 0 }}></div>
            {/* Bottom Right Teal Circle */}
            <div style={{ position: 'absolute', bottom: '-80px', right: '180px', width: '300px', height: '300px', backgroundColor: '#2A8C86', borderRadius: '50%', border: '4px solid #333', zIndex: 0 }}></div>

            {/* Inner Content Border Canvas (like UI box) */}
            <div className="result-inner-canvas">

                {/* Header Row */}
                <div className="result-header-row">
                    <div style={{ textAlign: 'left' }}>
                        <h1 className="result-title">
                            ROUND OVER!
                        </h1>
                        <p style={{ fontFamily: '"Fredoka", sans-serif', fontSize: '1.2rem', fontWeight: 'bold', margin: '5px 0 0 0', color: '#111' }}>
                            <span style={{ fontStyle: 'italic', fontWeight: 600 }}>The word was: </span>
                            <span className="result-word">{word || '????'}</span>
                        </p>
                    </div>
                    <div className="room-badge" style={{ backgroundColor: '#fff', border: '4px solid #333', padding: '8px 20px', zIndex: 10, boxShadow: '4px 4px 0 #333', alignSelf: 'flex-start' }}>
                        <span style={{ fontFamily: '"Fredoka", sans-serif', fontWeight: 'bold', fontSize: '1rem', color: '#333' }}>ROOM: </span>
                        <span style={{ color: '#D96C2C', fontSize: '1.1rem', textTransform: 'uppercase', fontWeight: 'bold' }}>{roomId}</span>
                    </div>
                </div>

                {/* Podium Row */}
                <div className="result-podium-row">

                    {/* 2nd Place */}
                    {secondPlace && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.7rem', backgroundColor: '#fff', border: '3px solid #333', padding: '2px 8px', marginBottom: '8px' }}>2ND</div>
                            <div className="podium-avatar-2">
                                <AvatarIcon avatarKey={secondPlace.avatar || 'ghost'} size={36} strokeWidth={2.5} />
                            </div>
                            <div className="podium-name">{secondPlace.name}</div>

                            <div className="podium-box-2">
                                <div className="score-text">{secondPlace.score}</div>
                                <div style={{ fontSize: '0.8rem', color: '#444' }}>POINTS</div>
                            </div>
                        </div>
                    )}

                    {/* 1st Place */}
                    {firstPlace && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 5, marginBottom: '20px' }}>
                            <div style={{ fontSize: '0.7rem', backgroundColor: '#333', color: 'white', border: '3px solid #333', padding: '4px 12px', marginBottom: '8px', transform: 'rotate(-5deg)' }}>WINNER</div>
                            <div className="podium-avatar-1">
                                <AvatarIcon avatarKey={firstPlace.avatar || 'ghost'} size={48} strokeWidth={2.5} />
                            </div>
                            <div className="podium-name" style={{ color: '#D96C2C', fontSize: '1.3rem' }}>{firstPlace.name}</div>

                            <div className="podium-box-1">
                                <div className="score-text-1">{firstPlace.score}</div>
                                <div style={{ fontSize: '0.9rem', color: '#444' }}>POINTS</div>
                            </div>
                        </div>
                    )}

                    {/* 3rd Place */}
                    {thirdPlace && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.7rem', backgroundColor: '#fff', border: '3px solid #333', padding: '2px 8px', marginBottom: '8px' }}>3RD</div>
                            <div className="podium-avatar-3">
                                <AvatarIcon avatarKey={thirdPlace.avatar || 'ghost'} size={36} strokeWidth={2.5} />
                            </div>
                            <div className="podium-name">{thirdPlace.name}</div>

                            <div className="podium-box-3">
                                <div className="score-text">{thirdPlace.score}</div>
                                <div style={{ fontSize: '0.8rem', color: '#444' }}>POINTS</div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Performance Table Row */}
                <div className="result-table-container">
                    <div style={{ backgroundColor: '#44423e', color: '#EAE6D6', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontFamily: '"Titan One", sans-serif', borderTop: '4px solid #333', borderRight: '4px solid #333', borderLeft: '4px solid #333' }}>
                        <span>PLAYER PERFORMANCE</span>
                        <span>ROUND BONUS</span>
                    </div>
                    {results.slice(3, 5).map((player, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', backgroundColor: '#FDFBF7', borderRight: '4px solid #333', borderLeft: '4px solid #333', borderBottom: '4px solid #333', fontFamily: '"Fredoka", sans-serif', fontWeight: 'bold' }}>
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                <span style={{ color: '#aaa', minWidth: '35px' }}>#{idx + 4}</span>
                                <span style={{ color: '#333', textTransform: 'uppercase', letterSpacing: '1px' }}>{player.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                                <span style={{ color: '#2A8C86' }}>+{player.round_score || 0}</span>
                                <span style={{ color: '#333', fontSize: '1.4rem', fontFamily: '"Titan One", sans-serif' }}>{player.score}</span>
                            </div>
                        </div>
                    ))}
                    {/* Fallback empty box if no players rank 4+ */}
                    {results.length <= 3 && (
                        <div style={{ padding: '15px 20px', backgroundColor: '#FDFBF7', borderRight: '4px solid #333', borderLeft: '4px solid #333', borderBottom: '4px solid #333', fontFamily: '"Fredoka", sans-serif', fontWeight: 'bold', color: '#aaa', textAlign: 'center' }}>
                            No more players...
                        </div>
                    )}
                </div>

                {/* Next Round Button/Timer */}
                <div style={{ position: 'absolute', bottom: '-28px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                    <div className="result-next-btn">
                        NEXT ROUND
                        <span style={{ fontFamily: '"Fredoka", sans-serif', fontSize: '1.1rem', color: '#666', fontWeight: 'bold' }}>({countdown}s)</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ResultPage;
