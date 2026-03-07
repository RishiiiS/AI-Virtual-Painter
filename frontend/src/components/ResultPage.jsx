import React from 'react';
import AvatarIcon from './AvatarIcon';

const ResultPage = ({ word, results = [], roomId, onNextRound, timeRemaining }) => {
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
            <div style={{
                width: '90%',
                maxWidth: '900px',
                minHeight: '650px',
                position: 'relative',
                zIndex: 10,
                border: '4px solid #333',
                backgroundColor: 'transparent',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '10px 10px 0 rgba(0,0,0,0.1)'
            }}>

                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '30px 40px 0 40px', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ textAlign: 'left' }}>
                        <h1 style={{ fontSize: '3.5rem', margin: 0, color: '#EBC334', textShadow: '-2px -2px 0 #333, 2px -2px 0 #333, -2px 2px 0 #333, 2px 2px 0 #333, 4px 4px 0 rgba(0,0,0,0.3)', letterSpacing: '2px', textTransform: 'uppercase' }}>
                            ROUND OVER!
                        </h1>
                        <p style={{ fontFamily: '"Fredoka", sans-serif', fontSize: '1.2rem', fontWeight: 'bold', margin: '5px 0 0 0', color: '#111' }}>
                            <span style={{ fontStyle: 'italic', fontWeight: 600 }}>The word was: </span>
                            <span style={{ color: '#D96C2C', fontSize: '1.5rem', textTransform: 'uppercase', textDecoration: 'underline' }}>{word || '????'}</span>
                        </p>
                    </div>
                    <div style={{ backgroundColor: '#fff', border: '4px solid #333', padding: '8px 20px', zIndex: 10, boxShadow: '4px 4px 0 #333', alignSelf: 'flex-start' }}>
                        <span style={{ fontFamily: '"Fredoka", sans-serif', fontWeight: 'bold', fontSize: '1rem', color: '#333' }}>ROOM: </span>
                        <span style={{ color: '#D96C2C', fontSize: '1.1rem', textTransform: 'uppercase', fontWeight: 'bold' }}>{roomId}</span>
                    </div>
                </div>

                {/* Podium Row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: '15px',
                    flex: 1,
                    minHeight: '280px',
                    padding: '20px 0'
                }}>

                    {/* 2nd Place */}
                    {secondPlace && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.7rem', backgroundColor: '#fff', border: '3px solid #333', padding: '2px 8px', marginBottom: '8px' }}>2ND</div>
                            <div style={{ width: '70px', height: '70px', backgroundColor: '#2A8C86', border: '4px solid #333', boxShadow: '4px 4px 0 #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'white' }}>
                                <AvatarIcon avatarKey={secondPlace.avatar || 'ghost'} size={36} strokeWidth={2.5} />
                            </div>
                            <div style={{ fontFamily: '"Titan One", sans-serif', color: '#333', marginTop: '10px', fontSize: '1rem', marginBottom: '10px', textShadow: '1px 1px 0 rgba(0,0,0,0.2)' }}>{secondPlace.name}</div>

                            <div style={{ width: '130px', height: '140px', backgroundColor: '#8DBEAF', border: '4px solid #333', boxShadow: '6px 6px 0 #333', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: '#222' }}>{secondPlace.score}</div>
                                <div style={{ fontSize: '0.8rem', color: '#444' }}>POINTS</div>
                            </div>
                        </div>
                    )}

                    {/* 1st Place */}
                    {firstPlace && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 5, marginBottom: '20px' }}>
                            <div style={{ fontSize: '0.7rem', backgroundColor: '#333', color: 'white', border: '3px solid #333', padding: '4px 12px', marginBottom: '8px', transform: 'rotate(-5deg)' }}>WINNER</div>
                            <div style={{ width: '90px', height: '90px', backgroundColor: '#EBC334', border: '4px solid #333', boxShadow: '5px 5px 0 #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>
                                <AvatarIcon avatarKey={firstPlace.avatar || 'ghost'} size={48} strokeWidth={2.5} />
                            </div>
                            <div style={{ fontFamily: '"Titan One", sans-serif', color: '#D96C2C', marginTop: '10px', fontSize: '1.3rem', marginBottom: '10px', textShadow: '1px 1px 0 rgba(0,0,0,0.2)' }}>{firstPlace.name}</div>

                            <div style={{ width: '170px', height: '200px', backgroundColor: '#D1AC2C', border: '4px solid #333', boxShadow: '8px 8px 0 #333', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                <div style={{ fontSize: '3.5rem', color: '#222' }}>{firstPlace.score}</div>
                                <div style={{ fontSize: '0.9rem', color: '#444' }}>POINTS</div>
                            </div>
                        </div>
                    )}

                    {/* 3rd Place */}
                    {thirdPlace && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.7rem', backgroundColor: '#fff', border: '3px solid #333', padding: '2px 8px', marginBottom: '8px' }}>3RD</div>
                            <div style={{ width: '70px', height: '70px', backgroundColor: '#D96C2C', border: '4px solid #333', boxShadow: '4px 4px 0 #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'white' }}>
                                <AvatarIcon avatarKey={thirdPlace.avatar || 'ghost'} size={36} strokeWidth={2.5} />
                            </div>
                            <div style={{ fontFamily: '"Titan One", sans-serif', color: '#333', marginTop: '10px', fontSize: '1rem', marginBottom: '10px', textShadow: '1px 1px 0 rgba(0,0,0,0.2)' }}>{thirdPlace.name}</div>

                            <div style={{ width: '130px', height: '100px', backgroundColor: '#E3B28A', border: '4px solid #333', boxShadow: '6px 6px 0 #333', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: '#222' }}>{thirdPlace.score}</div>
                                <div style={{ fontSize: '0.8rem', color: '#444' }}>POINTS</div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Performance Table Row */}
                <div style={{ width: '85%', alignSelf: 'center', marginBottom: '50px', display: 'flex', flexDirection: 'column' }}>
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
                    <div style={{
                        backgroundColor: '#EBC334',
                        border: '4px solid #333',
                        boxShadow: '6px 6px 0 #333',
                        padding: '12px 35px',
                        fontSize: '1.6rem',
                        fontFamily: '"Titan One", sans-serif',
                        color: '#333',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '12px',
                        whiteSpace: 'nowrap'
                    }}>
                        NEXT ROUND
                        <span style={{ fontFamily: '"Fredoka", sans-serif', fontSize: '1.1rem', color: '#666', fontWeight: 'bold' }}>({timeRemaining}s)</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ResultPage;
