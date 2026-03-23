import React, { useState } from 'react';
import { Paintbrush, Eraser, PaintBucket, Undo2, Trash2, Settings as SettingsIcon } from 'lucide-react';
import Settings from './Settings';

const TOOLS = [
    { id: 'brush', icon: <Paintbrush size={28} strokeWidth={2.5} /> },
    { id: 'eraser', icon: <Eraser size={28} strokeWidth={2.5} /> },
    { id: 'fill', icon: <PaintBucket size={28} strokeWidth={2.5} /> },
    { id: 'undo', icon: <Undo2 size={28} strokeWidth={2.5} /> },
    { id: 'clear', icon: <Trash2 size={28} strokeWidth={2.5} /> },
];

const Toolbar = ({ selectedTool, onSelectTool, brushSize, onSelectSize, inGame, isHost, isDrawer, onLeaveGame, onEndGameAll }) => {
    const [showSettings, setShowSettings] = useState(false);

    return (
        <>
            <div className="toolbar-container">
                {/* Tools locked for non-drawers */}
                <div className="toolbar-tools" style={{
                    pointerEvents: isDrawer ? 'auto' : 'none',
                    opacity: isDrawer ? 1 : 0.5,
                }}>
                    {TOOLS.map((tool) => (
                        <button
                            key={tool.id}
                            onClick={() => onSelectTool(tool.id)}
                            className="toolbar-btn"
                            style={{
                                backgroundColor: selectedTool === tool.id ? '#EBC334' : 'white',
                                boxShadow: selectedTool === tool.id ? '2px 2px 0 #333' : '4px 4px 0 rgba(0,0,0,0.2)',
                                transform: selectedTool === tool.id ? 'translate(2px, 2px)' : 'none',
                            }}
                        >
                            {tool.icon}
                        </button>
                    ))}

                    {/* Brush Size Selector */}
                    <div className="toolbar-brush-sizes">
                        {[5, 10, 20].map((size) => (
                            <div
                                key={size}
                                onClick={() => onSelectSize && onSelectSize(size)}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{
                                    width: `${size + 4}px`,
                                    height: `${size + 4}px`,
                                    borderRadius: '50%',
                                    backgroundColor: '#333',
                                    border: brushSize === size ? '3px solid #EBC334' : 'none',
                                    boxShadow: brushSize === size ? '0 0 0 2px #333' : 'none',
                                }} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Settings Button */}
                <button
                    onClick={() => setShowSettings(true)}
                    className="toolbar-btn"
                    style={{
                        backgroundColor: '#EBC334',
                        boxShadow: '4px 4px 0 rgba(0,0,0,0.2)',
                        color: '#333',
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'translate(2px, 2px)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'translate(0, 0)'}
                >
                    <SettingsIcon size={28} strokeWidth={2.5} />
                </button>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
                >
                    <div style={{
                        backgroundColor: '#fff',
                        padding: '30px',
                        width: '450px',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        border: '4px solid #333',
                        boxShadow: '8px 8px 0 rgba(0,0,0,0.8)',
                    }}>
                        <Settings
                            onBack={() => setShowSettings(false)}
                            inGame={inGame}
                            isHost={isHost}
                            onLeave={onLeaveGame}
                            onEndGame={onEndGameAll}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

export default Toolbar;
