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
