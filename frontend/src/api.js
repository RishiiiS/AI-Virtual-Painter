import { getSocket } from './signaling';
const BACKEND_ORIGIN = (
    import.meta.env.VITE_BACKEND_ORIGIN ||
    (import.meta.env.DEV ? 'http://localhost:5001' : window.location.origin)
).replace(/\/$/, '');

const API_URL = `${BACKEND_ORIGIN}/api`;

export const getState = async () => {
    try {
        const res = await fetch(`${API_URL}/state`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        return data;
    } catch (e) {
        console.error("Fetch state error:", e);
        return null;
    }
};

export const sendChat = (roomId, message, sender) => {
    try {
        getSocket().emit('chat_message', { room_id: roomId, message, sender });
    } catch (e) {
        console.error("Send chat error:", e);
    }
};

export const startGame = (roomId, duration = 60) => {
    console.log("Starting game for room:", roomId, "duration:", duration);
    try {
        getSocket().emit('start_game', { room_id: roomId, duration });
    } catch (e) {
        console.error("Start game error:", e);
    }
};

export const getVideoFrame = async (roomId) => {
    try {
        const res = await fetch(`${API_URL}/video/${roomId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.frame;
    } catch (e) {
        return null;
    }
};

export const checkRoom = async (roomId) => {
    try {
        const res = await fetch(`${API_URL}/check_room/${roomId}`);
        if (!res.ok) return { exists: false, error: 'Network error' };
        return await res.json();
    } catch (e) {
        return { exists: false, error: e.message };
    }
};

export const sendReady = (roomId, isReady, playerName) => {
    try {
        getSocket().emit('ready_up', { room_id: roomId, is_ready: isReady, sender: playerName });
    } catch (e) {
        console.error("Send ready error:", e);
    }
};

export const createRoom = async () => {
    try {
        const res = await fetch(`${API_URL}/create_room`, { method: 'POST' });
        if (!res.ok) throw new Error("Failed to create room");
        return await res.json();
    } catch (e) {
        return { error: e.message };
    }
};

export const joinRoom = async (roomId, playerName, avatar = 'star') => {
    try {
        const res = await fetch(`${API_URL}/join_room`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id: roomId, player_name: playerName, avatar })
        });
        return await res.json();
    } catch (e) {
        console.error("Join room error:", e);
        return { error: e.message };
    }
};

export const sendStroke = (roomId, playerName, stroke) => {
    try {
        getSocket().emit('draw_stroke', { room_id: roomId, player_name: playerName, stroke });
    } catch (e) {
        // Silent fail for high-frequency calls
    }
};

export const getStrokes = async (roomId, since = 0) => {
    try {
        const res = await fetch(`${API_URL}/strokes/${roomId}?since=${since}`);
        if (!res.ok) return { strokes: [], total: since };
        return await res.json();
    } catch (e) {
        return { strokes: [], total: since };
    }
};

export const clearCanvas = (roomId) => {
    try {
        getSocket().emit('clear_canvas', { room_id: roomId });
    } catch (e) {
        console.error("Clear canvas error:", e);
    }
};

export const leaveRoom = async (roomId, playerName) => {
    try {
        await fetch(`${API_URL}/leave_room`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id: roomId, player_name: playerName }),
            keepalive: true
        });
    } catch (e) {
        // Silent — we're leaving anyway
    }
};

export const endRoom = async (roomId, playerName) => {
    try {
        await fetch(`${API_URL}/end_room`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id: roomId, player_name: playerName })
        });
    } catch (e) {
        console.error("End room error:", e);
    }
};
