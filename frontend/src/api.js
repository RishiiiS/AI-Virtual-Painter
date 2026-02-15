const API_URL = 'http://localhost:5001/api';

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
    try {
        await fetch(`${API_URL}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'send_chat',
                room_id: roomId,
                message: message,
                sender: sender
            })
        });
    } catch (e) {
        console.error("Send chat error:", e);
    }
};

export const startGame = async (roomId) => {
    console.log("Found roomId for start:", roomId);
    try {
        const res = await fetch(`${API_URL}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'start_game',
                room_id: roomId
            })
        });
        const json = await res.json();
        console.log("Start Game Response:", json);
    } catch (e) {
        console.error("Start game error:", e);
    }
};

export const getVideoFrame = async (roomId) => {
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
    try {
        await fetch(`${API_URL}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'ready_up',
                room_id: roomId,
                is_ready: isReady,
                sender: playerName
            })
        });
    } catch (e) {
        console.error("Send ready error:", e);
    }
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

export const joinRoom = async (roomId, playerName) => {
    try {
        const res = await fetch(`${API_URL}/join_room`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id: roomId, player_name: playerName })
        });
        return await res.json();
    } catch (e) {
        console.error("Join room error:", e);
        return { error: e.message };
    }
};

export const sendStroke = async (roomId, playerName, stroke) => {
    try {
        await fetch(`${API_URL}/send_stroke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id: roomId, player_name: playerName, stroke })
        });
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

export const clearCanvas = async (roomId) => {
    try {
        await fetch(`${API_URL}/clear_canvas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id: roomId })
        });
    } catch (e) {
        console.error("Clear canvas error:", e);
    }
};
