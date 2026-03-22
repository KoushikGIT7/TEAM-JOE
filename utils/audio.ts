/**
 * JOE Audio Engine — Professional Sound Synthesis
 * Generates signature chimes using Web Audio API (No external files needed)
 */

class SoundService {
    private ctx: AudioContext | null = null;

    private init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    /**
     * Play the "JOE Success" Chime
     * A signature three-tone rising sequence that feels premium and clean.
     */
    public playSuccess() {
        try {
            this.init();
            if (!this.ctx) return;

            const now = this.ctx.currentTime;
            this.playTone(440, now, 0.1);      // A4
            this.playTone(554.37, now + 0.1, 0.1); // C#5
            this.playTone(659.25, now + 0.2, 0.3); // E5

            // 🤖 [VOICE ENGINE]
            this.speak("JOE: Order Confirmed");
        } catch (e) {
            console.warn('Audio play blocked:', e);
        }
    }

    /**
     * Play the "Order Ready" Alert
     * A sharp, dual-tone notification that cuts through kitchen noise.
     */
    public playAlert() {
        try {
            this.init();
            if (!this.ctx) return;
            
            const now = this.ctx.currentTime;
            this.playTone(880, now, 0.1, 'square'); 
            this.playTone(880, now + 0.15, 0.2, 'square');

            // 🤖 [VOICE ENGINE]
            this.speak("JOE: Dinner is ready!");
        } catch (e) {
            console.warn('Audio play blocked:', e);
        }
    }

    private speak(text: string) {
        if (!window.speechSynthesis) return;
        const msg = new SpeechSynthesisUtterance(text);
        msg.rate = 1.1;
        msg.pitch = 1.1;
        msg.volume = 0.5;
        window.speechSynthesis.speak(msg);
    }

    private playTone(freq: number, start: number, duration: number, type: OscillatorType = 'sine') {
        if (!this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, start + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + duration);
    }
}

export const joeSounds = new SoundService();
