class Protocol:
    # Actions
    JOIN = "join"
    STROKE = "stroke"
    CHAT = "chat"
    GAME_START = "game_start"
    GAME_END = "game_end"
    WORD_SELECT = "word_select"
    UPDATE_SCORES = "update_scores"
    START_GAME = "start_game" # Host triggers this
    DRAWER_ASSIGN = "drawer_assign"
    YOUR_WORD = "your_word"
    ROUND_OVER = "round_over"
    CLEAR_CANVAS = "clear_canvas"
    VIDEO_FRAME = "video_frame"
    READY = "ready"
    
    # Keys
    ACTION = "action"
    ROOM_ID = "room_id"
    PAYLOAD = "payload"
    SENDER = "sender"
    PLAYER_NAME = "player_name"
