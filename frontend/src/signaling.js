import { io } from 'socket.io-client';

const SIGNALING_URL = 'http://localhost:5001';

// Singleton socket instance
let socket = null;

export const getSocket = () => {
    if (!socket) {
        socket = io(SIGNALING_URL, {
            transports: ['websocket', 'polling'],
            autoConnect: true
        });

        socket.on('connect', () => {
            console.log('[Signaling] Connected:', socket.id);
        });

        socket.on('disconnect', () => {
            console.log('[Signaling] Disconnected');
        });

        socket.on('connect_error', (err) => {
            console.error('[Signaling] Connection error:', err.message);
        });
    }
    return socket;
};

// Join a signaling room
export const joinSignalingRoom = (roomId, role = 'guesser') => {
    const s = getSocket();
    s.emit('join_room', { room_id: roomId, role });
    console.log(`[Signaling] Joined room ${roomId} as ${role}`);
};

// Send WebRTC offer targeted to a specific guesser
export const sendOffer = (roomId, offer, targetSid) => {
    const s = getSocket();
    s.emit('webrtc_offer', { room_id: roomId, offer, target_sid: targetSid });
};

// Send WebRTC answer (guesser → server → drawer)
export const sendAnswer = (roomId, answer) => {
    const s = getSocket();
    s.emit('webrtc_answer', { room_id: roomId, answer });
};

// Send ICE candidate targeted to a specific peer
export const sendIceCandidate = (roomId, candidate, targetSid) => {
    const s = getSocket();
    s.emit('webrtc_ice_candidate', { room_id: roomId, candidate, target_sid: targetSid });
};

// Event listeners — use .off() before .on() to prevent duplicate handlers
export const onNewGuesser = (callback) => {
    const s = getSocket();
    s.off('new_guesser');
    s.on('new_guesser', callback);
};

export const onOffer = (callback) => {
    const s = getSocket();
    s.off('webrtc_offer');
    s.on('webrtc_offer', callback);
};

export const onAnswer = (callback) => {
    const s = getSocket();
    s.off('webrtc_answer');
    s.on('webrtc_answer', callback);
};

export const onIceCandidate = (callback) => {
    const s = getSocket();
    s.off('webrtc_ice_candidate');
    s.on('webrtc_ice_candidate', callback);
};

// Cleanup
export const disconnectSignaling = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
