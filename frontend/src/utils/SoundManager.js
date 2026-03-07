import clickSound from '../assets/sounds/clicks.wav';
import timerSound from '../assets/sounds/freesound_community-ticking-timer-65220.mp3';

class SoundManager {
    constructor() {
        this.clickAudio = new Audio(clickSound);
        this.timerAudio = new Audio(timerSound);
        this.isRoundActive = false;

        // Configure audio
        this.clickAudio.volume = 0.5;
        this.timerAudio.volume = 0.6;
    }

    setRoundActive(active) {
        this.isRoundActive = active;
    }

    playClick() {
        // Only play if round is NOT active
        if (!this.isRoundActive) {
            // Clone node to allow overlapping clicks or reset current time
            this.clickAudio.currentTime = 0;
            this.clickAudio.play().catch(e => {
                // Ignore autoplay errors (user hasn't interacted yet)
            });
        }
    }

    playTimer() {
        // Only play if not already playing to avoid stuttering
        if (this.timerAudio.paused) {
            this.timerAudio.play().catch(e => {
                // Ignore errors
            });
        }
    }

    stopTimer() {
        if (!this.timerAudio.paused) {
            this.timerAudio.pause();
            this.timerAudio.currentTime = 0;
        }
    }
}

export default new SoundManager();
