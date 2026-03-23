import React from 'react';
import { AVATAR_KEYS } from './AvatarIcon';
import AvatarIcon from './AvatarIcon';

const AvatarSelector = ({ selected = 1, onSelect }) => {
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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
                {AVATAR_KEYS.map((key, idx) => (
                    <div
                        key={key}
                        onClick={() => onSelect && onSelect(idx)}
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
                        <AvatarIcon avatarKey={key} size={32} strokeWidth={2.5} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AvatarSelector;
