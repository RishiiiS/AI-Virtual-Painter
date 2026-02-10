import random

WORDS = {
    "easy": ["apple", "dog", "ball"],
    "medium": ["rocket", "pencil", "mountain"],
    "hard": ["architecture", "microscope", "astronaut"]
}

def get_random_word(difficulty):
    return random.choice(WORDS[difficulty])
