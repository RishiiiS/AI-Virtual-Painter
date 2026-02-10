import React, { useState } from 'react';

const AvatarSelector = () => {
    const [selected, setSelected] = useState(1);

    // Placeholder avatars (simple emoji/icon style)
    const avatars = ['👦', '👩', '👴', '👵', '👽'];

    return (
        <div style={{ marginBottom: '30px' }}>
            <h3 style={{
                marginTop: 0,
                borderBottom: '4px solid #333',
                display: 'inline-block',
                paddingBottom: '5px',
                fontFamily: '"Titan One", sans-serif',
                textTransform: 'uppercase',
                fontSize: '1.2rem'
            }}>Select Your Artist</h3>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
                {avatars.map((av, idx) => (
                    <div
                        key={idx}
                        onClick={() => setSelected(idx)}
                        style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            border: '3px solid #333',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                            backgroundColor: selected === idx ? '#EBC334' : 'white',
                            cursor: 'pointer',
                            transform: selected === idx ? 'scale(1.1)' : 'scale(1)',
                            boxShadow: selected === idx ? '4px 4px 0 rgba(0,0,0,0.8)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        {av}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AvatarSelector;
