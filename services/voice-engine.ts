/**
 * 🎙️ [SONIC-VOICE] HD Speech Engine
 * Uses Web Speech API for high-fidelity, HD clear broadcasting.
 */

class VoiceEngine {
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private maleVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (this.synth) {
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    // Prefer Google UK English Male or similar high-quality voices
    this.maleVoice = voices.find(v => v.name.includes('Google') && v.name.includes('Male')) || 
                     voices.find(v => v.name.includes('Male')) || 
                     voices[0];
  }

  public speak(text: string, priority: 'HIGH' | 'NORMAL' = 'NORMAL') {
    if (!this.synth) return;

    if (priority === 'HIGH') {
      this.synth.cancel(); // Interrupt currently playing audio
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.maleVoice) {
      utterance.voice = this.maleVoice;
    }
    
    utterance.pitch = 1.0;
    utterance.rate = 0.95; // Slightly slower for HD clarity
    utterance.volume = 1.0;

    this.synth.speak(utterance);
    console.log(`🎙️ [VOICE] Broadcasting: "${text}"`);
  }

  /** 🍔 Meal Ready Broadcast */
  public announceMealReady() {
    this.speak(`Meal ready! Counter.`, 'HIGH');
  }

  /** ✅ Order Completed Broadcast */
  public announceOrderComplete() {
    this.speak(`Order done. Thanks!`, 'NORMAL');
  }
}

export const sonicVoice = new VoiceEngine();
