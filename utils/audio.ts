/**
 * JOE Audio Engine
 * Provides the signature JOE Sonic Logo (Professional Fintech-style Hallmark).
 * Hardened for a smooth, high-quality, and deliberate 0.5 rate pulse.
 */
class SoundService {
    private ctx: AudioContext | null = null;
  
    private async init() {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
    }
  
    /**
     * 🚀 [SONIC-PULSE] The Hallmark Sequence
     * 1. Smooth, Deliberate "JOE" (0.5 Rate)
     * 2. Overlapping Crystal Chime (Post-Peak)
     */
    public async playAlert() {
      try {
        await this.init();
        if (!this.ctx) return;
        
        // 🎙️ [HALLMARK-TRADEMARK] High-Quality, Smooth "JOE"
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          
          const trademark = new SpeechSynthesisUtterance("JOE");
          trademark.rate = 0.5;    // Deliberate and smooth
          trademark.pitch = 0.95;  // Warm and premium resonance
          trademark.volume = 1.0; 
          
          // 🔥 [TIMED-OVERLAP] Trigger the chime while the voice is still resonating
          // This creates a professional, high-fidelity "Handshake" effect.
          setTimeout(() => {
             this.playSignatureTune();
          }, 450); 

          window.speechSynthesis.speak(trademark);
        } else {
          this.playSignatureTune();
        }
      } catch (e) {
        console.warn('Audio blocked by browser policy:', e);
      }
    }

    private playSignatureTune() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        
        // 🎼 [SONIC-TUNE] High-Fidelity Harmonic Confirmation (Rising Triplet)
        this.playTone(523.25, now, 0.1, 'sine', 0.25); // C5
        this.playTone(659.25, now + 0.15, 0.15, 'sine', 0.25); // E5
        this.playTone(783.99, now + 0.35, 0.45, 'sine', 0.2); // G5 (Melodic Finish)
    }

    public async playSuccess() {
        try {
          await this.init();
          const now = this.ctx?.currentTime || 0;
          this.playTone(523.25, now, 0.1, 'sine', 0.25); 
          this.playTone(659.25, now + 0.1, 0.2, 'sine', 0.25); 
          this.speak("JOE: Confirmed");
        } catch (e) {
          console.warn('Audio blocked by browser policy:', e);
        }
    }
  
    private playTone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.2) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
  
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  
      osc.connect(gain);
      gain.connect(this.ctx.destination);
  
      osc.start(start);
      osc.stop(start + duration);
    }
  
    private speak(text: string) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.0;
        utter.pitch = 1.0;
        utter.volume = 0.8;
        window.speechSynthesis.speak(utter);
      }
    }
  }
  
  export const joeSounds = new SoundService();
