const API_URL = 'http://localhost:5001/api';

export const getState = async () => {
    try {
        const res = await fetch(`${API_URL}/state`);
        if (!res.ok) throw new Error('Network response was not ok');
        return await res.json();
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
    try {
        await fetch(`${API_URL}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'start_game',
                room_id: roomId
            })
        });
    } catch (e) {
        console.error("Start game error:", e);
    }
};
