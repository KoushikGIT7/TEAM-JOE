/**
 * ============================================================
 * JOE Audio Engine — Industrial Fintech Sound System
 * ============================================================
 * Each stage of the order lifecycle has a unique, professional
 * audio signature. Designed to feel like Zomato / Google Pay
 * level quality — clean, crisp, non-intrusive.
 * ============================================================
 */
class SoundService {
  private ctx: AudioContext | null = null;

  // ─────────────────────────────────────────────────────────
  // INIT — Wake up the AudioContext (must be after user gesture)
  // ─────────────────────────────────────────────────────────
  public async init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // ─────────────────────────────────────────────────────────
  // CORE TONE — Precise, musical, clean
  // ─────────────────────────────────────────────────────────
  private tone(
    freq: number,
    start: number,
    duration: number,
    volume = 0.18,
    type: OscillatorType = 'sine',
    fadein = 0.02
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + fadein);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  // ─────────────────────────────────────────────────────────
  // SAY — Clean TTS with studio-quality settings
  // ─────────────────────────────────────────────────────────
  private say(text: string, rate = 0.85, pitch = 1.1, volume = 1.0) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    window.speechSynthesis.speak(u);
  }

  // ═══════════════════════════════════════════════════════
  // 1. JOE HALLMARK — Played on app entry / marketing pulse
  //    Sound: Warm "JOE" voice + rising C-E-G crystal chime
  // ═══════════════════════════════════════════════════════
  public async playAlert() {
    try {
      await this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Rising crystal chime (C5 → E5 → G5)
      setTimeout(() => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.tone(523.25, t,        0.18, 0.15, 'sine'); // C5
        this.tone(659.25, t + 0.16, 0.22, 0.15, 'sine'); // E5
        this.tone(783.99, t + 0.35, 0.55, 0.12, 'sine'); // G5
      }, 400);
      this.say('JOE', 0.5, 0.95, 1.0);
    } catch (e) {
      console.warn('[JOE Audio] Hallmark blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 2. ORDER PLACED — Student just submitted their order
  //    Sound: Soft double-tap + warm ascending phrase
  // ═══════════════════════════════════════════════════════
  public async playOrderPlaced() {
    try {
      await this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Soft double tap feel
      this.tone(440.00, now,        0.08, 0.12, 'sine');  // A4
      this.tone(523.25, now + 0.1,  0.08, 0.14, 'sine');  // C5
      // Warm ascending finish
      this.tone(659.25, now + 0.25, 0.3,  0.12, 'sine');  // E5
      this.tone(783.99, now + 0.45, 0.45, 0.10, 'sine');  // G5
    } catch (e) {
      console.warn('[JOE Audio] Order placed sound blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 3. CASHIER CONFIRMED — Payment approved by cashier
  //    Sound: Google-Pay-style bright success chord
  // ═══════════════════════════════════════════════════════
  public async playPaymentConfirmed() {
    try {
      await this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Bright C major arpeggio — instantly recognisable "success"
      this.tone(523.25, now,        0.12, 0.16, 'sine');  // C5
      this.tone(659.25, now + 0.10, 0.14, 0.16, 'sine');  // E5
      this.tone(783.99, now + 0.20, 0.18, 0.16, 'sine');  // G5
      this.tone(1046.5, now + 0.32, 0.55, 0.13, 'sine');  // C6 — high bright finish
      // Subtle "JOE" brand voice overlay
      setTimeout(() => this.say('JOE: Confirmed', 0.85, 1.1, 0.9), 100);
    } catch (e) {
      console.warn('[JOE Audio] Confirmed sound blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 4. FOOD READY — Order is ready for collection
  //    Sound: Celebratory up-sweep — feels like "Ding!"
  // ═══════════════════════════════════════════════════════
  public async playFoodReady() {
    try {
      await this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Triumphant two-note "ding-dong"
      this.tone(880.00, now,        0.15, 0.20, 'sine');  // A5 — punch
      this.tone(1174.66, now + 0.18, 0.65, 0.16, 'sine'); // D6 — bright ring-out
      // Harmonic shimmer underneath
      this.tone(587.33, now,        0.80, 0.07, 'sine');  // D5 — soft body
      setTimeout(() => this.say('Ready!', 1.0, 1.2, 0.9), 200);
    } catch (e) {
      console.warn('[JOE Audio] Food ready sound blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 5. ORDER REJECTED — Gentle, non-harsh descending tone
  //    Sound: Soft descend — professional, not alarming
  // ═══════════════════════════════════════════════════════
  public async playRejected() {
    try {
      await this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Gentle descending — not a harsh buzzer
      this.tone(440.00, now,        0.25, 0.12, 'sine');  // A4
      this.tone(349.23, now + 0.22, 0.35, 0.10, 'sine');  // F4
      this.tone(293.66, now + 0.50, 0.55, 0.08, 'sine');  // D4 — fade out low
    } catch (e) {
      console.warn('[JOE Audio] Rejected sound blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 6. SUCCESS — Generic positive confirmation
  // ═══════════════════════════════════════════════════════
  public async playSuccess() {
    try {
      await this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.tone(523.25, now,        0.10, 0.14, 'sine');
      this.tone(659.25, now + 0.10, 0.18, 0.14, 'sine');
      this.tone(783.99, now + 0.22, 0.40, 0.12, 'sine');
    } catch (e) {
      console.warn('[JOE Audio] Success sound blocked:', e);
    }
  }
}

export const joeSounds = new SoundService();
