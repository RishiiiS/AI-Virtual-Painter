const API_URL = 'http://localhost:5001/api';
import { getSocket } from './signaling';

export const getState = async () => {
    try {
        const res = await fetch(`${API_URL}/state`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        // console.log("State fetched:", data); 
        return data;
    } catch (e) {
        console.error("Fetch state error:", e);
        return null; // Return null on error
    }
};

export const sendChat = async (roomId, message, sender) => {
    getSocket().emit('chat_message', { room_id: roomId, message, sender });
};

export const startGame = (roomId, duration = 60) => {
    console.log("Found roomId for start:", roomId, "duration:", duration);
    getSocket().emit('start_game', { room_id: roomId, duration });
};

export const getVideoFrame = async (roomId) => {
    // Legacy HTTP fetch, keep for now or remove if video is also WebRTC
    try {
        const res = await fetch(`${API_URL}/video/${roomId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.frame; // base64 string
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

export const sendReady = async (roomId, isReady, playerName) => {
    getSocket().emit('ready_up', { room_id: roomId, is_ready: isReady, sender: playerName });
};

export const createRoom = async () => {
    try {
        const res = await fetch(`${API_URL}/create_room`, {
            method: 'POST'
        });
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
            body: JSON.stringify({ room_id: roomId, player_name: playerName, avatar: avatar })
        });
        return await res.json();
    } catch (e) {
        console.error("Join room error:", e);
        return { error: e.message };
    }
};

export const sendStroke = (roomId, playerName, stroke) => {
    getSocket().emit('draw_stroke', { room_id: roomId, player_name: playerName, stroke });
};

export const clearCanvas = (roomId) => {
    getSocket().emit('clear_canvas', { room_id: roomId });
};

export const leaveRoom = async (roomId, playerName) => {
    try {
        await fetch(`${API_URL}/leave_room`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id: roomId, player_name: playerName }),
            keepalive: true // Ensures request completes even if page is unloading
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
