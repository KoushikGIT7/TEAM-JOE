/**
 * ============================================================
 * CSE Audio Engine — Industrial Fintech Sound System
 * ============================================================
 * Each stage of the order lifecycle has a unique, professional
 * audio signature. Designed to feel like Zomato / Google Pay
 * level quality — clean, crisp, non-intrusive.
 * ============================================================
 */
class SoundService {
  public CHIME: string | undefined = undefined;
  private ctx: AudioContext | null = null;
  private activeOscillators: OscillatorNode[] = [];
  
  private isMuted = false;
  private listeners: Array<() => void> = [];

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach(cb => {
      try { cb(); } catch (_) {}
    });
  }

  public getMutedState(): 'Connected' | 'Muted' | 'Silent' {
    if (this.isMuted) return 'Muted';
    if (!this.ctx) return 'Silent';
    if (this.ctx.state === 'suspended') return 'Silent';
    return 'Connected';
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopAll();
    }
    this.notify();
  }

  // ─────────────────────────────────────────────────────────
  // INIT — Wake up the AudioContext (must be after user gesture)
  // ─────────────────────────────────────────────────────────
  public async init() {
    if (this.isMuted) return;
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      
      // 🚀 PRELOAD: Fetch background buffers immediately so playback has 0ms latency
      this.loadAudioBuffer('/sounds/deep_gravelly_success.mp3').then(b => this.serverSuccessBuffer = b);
      this.loadAudioBuffer('/sounds/deep_gravelly_success.mp3').then(b => this.studentSuccessBuffer = b);
      this.notify();
    }
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
      this.notify();
    }
  }

  /** 🛡️ [SILENCE-PROTOCOL] Kill all active tones and speech */
  public stopAll() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this.activeOscillators.forEach(osc => {
      try { osc.stop(); osc.disconnect(); } catch (_) {}
    });
    this.activeOscillators = [];
    this.notify();
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
    if (this.isMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + fadein);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    this.activeOscillators.push(osc);
    osc.start(start);
    osc.stop(start + duration + 0.05);

    // Clean up reference after it stops
    setTimeout(() => {
      this.activeOscillators = this.activeOscillators.filter(o => o !== osc);
    }, (duration + 0.1) * 1000);
  }

  // ─────────────────────────────────────────────────────────
  // SAY — Clean TTS with studio-quality settings
  // ─────────────────────────────────────────────────────────
  private say(text: string, rate = 0.85, pitch = 1.1, volume = 1.0) {
    if (this.isMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    window.speechSynthesis.speak(u);
  }

  // ═══════════════════════════════════════════════════════
  // 1. CSE HALLMARK — Played on app entry / marketing pulse
  //    Sound: Warm "CSE" voice + rising C-E-G crystal chime
  // ═══════════════════════════════════════════════════════
  public async playAlert() {
    if (this.isMuted) return;
    try {
      await this.init();
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      // Rising crystal chime (C5 → E5 → G5)
      setTimeout(() => {
        if (!this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        this.tone(523.25, t,        0.18, 0.15, 'sine'); // C5
        this.tone(659.25, t + 0.16, 0.22, 0.15, 'sine'); // E5
        this.tone(783.99, t + 0.35, 0.55, 0.12, 'sine'); // G5
      }, 400);
      this.say('CSE', 0.5, 0.95, 1.0);
    } catch (e) {
      console.warn('[CSE Audio] Hallmark blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 2. ORDER PLACED — Student just submitted their order
  //    Sound: Soft double-tap + warm ascending phrase
  // ═══════════════════════════════════════════════════════
  public async playOrderPlaced() {
    if (this.isMuted) return;
    try {
      await this.init();
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      // Soft double tap feel
      this.tone(440.00, now,        0.08, 0.12, 'sine');  // A4
      this.tone(523.25, now + 0.1,  0.08, 0.14, 'sine');  // C5
      // Warm ascending finish
      this.tone(659.25, now + 0.25, 0.3,  0.12, 'sine');  // E5
      this.tone(783.99, now + 0.45, 0.45, 0.10, 'sine');  // G5
    } catch (e) {
      console.warn('[CSE Audio] Order placed sound blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 3. CASHIER CONFIRMED — Payment approved by cashier
  //    Sound: Google-Pay-style bright success chord
  // ═══════════════════════════════════════════════════════
  public async playPaymentConfirmed() {
    if (this.isMuted) return;
    try {
      await this.init();
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      // Bright C major arpeggio — instantly recognisable "success"
      this.tone(523.25, now,        0.12, 0.16, 'sine');  // C5
      this.tone(659.25, now + 0.10, 0.14, 0.16, 'sine');  // E5
      this.tone(783.99, now + 0.20, 0.18, 0.16, 'sine');  // G5
      this.tone(1046.5, now + 0.32, 0.55, 0.13, 'sine');  // C6 — high bright finish
      // Subtle "CSE" brand voice overlay
      setTimeout(() => this.say('Confirmed', 0.85, 1.1, 0.9), 100);
    } catch (e) {
      console.warn('[CSE Audio] Confirmed sound blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 4. FOOD READY — Order is ready for collection
  //    Sound: Celebratory up-sweep — feels like "Ding!"
  // ═══════════════════════════════════════════════════════
  public async playFoodReady() {
    if (this.isMuted) return;
    try {
      await this.init();
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      // High-pitched celebratory ping (F5 -> A5)
      this.tone(698.46, now,        0.15, 0.15, 'sine'); // F5
      this.tone(880.00, now + 0.12, 0.35, 0.12, 'sine'); // A5
    } catch (e) {
      console.warn('[CSE Audio] Food ready sound blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 4.5. INCOMING ALERT — Played on supervisor dashboard when a new order is received
  //    Sound: Double bright alert chime (G5 -> E5)
  // ═══════════════════════════════════════════════════════
  public async playIncomingAlert() {
    if (this.isMuted) return;
    try {
      await this.init();
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      this.tone(783.99, now,        0.12, 0.15, 'sine'); // G5
      this.tone(659.25, now + 0.12, 0.35, 0.15, 'sine'); // E5
    } catch (e) {
      console.warn('[CSE Audio] Incoming alert sound blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 5. ORDER REJECTED — Gentle, non-harsh descending tone
  //    Sound: Soft descend — professional, not alarming
  // ═══════════════════════════════════════════════════════
  public async playRejected() {
    if (this.isMuted) return;
    try {
      await this.init();
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      // Gentle descending — not a harsh buzzer
      this.tone(440.00, now,        0.25, 0.12, 'sine');  // A4
      this.tone(349.23, now + 0.22, 0.35, 0.10, 'sine');  // F4
      this.tone(293.66, now + 0.50, 0.55, 0.08, 'sine');  // D4 — fade out low
    } catch (e) {
      console.warn('[CSE Audio] Rejected sound blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 5.5. ERROR BUZZER — Loud, clear, distinct failure tone
  //    Sound: Double low buzz — impossible to ignore
  // ═══════════════════════════════════════════════════════
  public async playErrorBuzzer() {
    if (this.isMuted) return;
    try {
      await this.init();
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      // Harsh low double-buzz
      this.tone(150, now,        0.2, 0.3, 'square');
      this.tone(150, now + 0.3,  0.4, 0.3, 'square');
      setTimeout(() => this.say('Error', 1.0, 0.8, 1.0), 100);
    } catch (e) {
      console.warn('[CSE Audio] Error buzzer blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 6. SUCCESS — Generic positive confirmation
  // ═══════════════════════════════════════════════════════
  public async playSuccess() {
    if (this.isMuted) return;
    try {
      await this.init();
      if (!this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
    } catch (e) {
      console.warn('[CSE Audio] Success sound blocked:', e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // 6.5. THANK YOU BOSS — Custom Voice Alert
  // ═══════════════════════════════════════════════════════
  public async playThankYouBoss() {
    if (this.isMuted) return;
    try {
      await this.init();
      if (!this.ctx || this.isMuted) return;
      this.say('Thank you, Boss!', 0.9, 1.1, 1.0);
    } catch (e) {
      console.warn('[CSE Audio] Thank You Boss sound blocked:', e);
    }
  }
  // ═══════════════════════════════════════════════════════
  // 7. CUSTOM VOICE ALERTS (MP3 Files - Web Audio API)
  // ═══════════════════════════════════════════════════════
  private serverSuccessBuffer: AudioBuffer | null = null;
  private studentSuccessBuffer: AudioBuffer | null = null;

  private async loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
    try {
      if (this.isMuted) return null;
      await this.init();
      if (!this.ctx) return null;
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await this.ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.warn(`[CSE Audio] Failed to load buffer for ${url}:`, e);
      return null;
    }
  }

  private playBuffer(buffer: AudioBuffer | null) {
    if (this.isMuted || !this.ctx || !buffer) return false;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    source.start(0);
    this.activeOscillators.push(source as any); // Track it so stopAll() can silence it if needed
    
    // Clean up reference
    setTimeout(() => {
      this.activeOscillators = this.activeOscillators.filter(o => o !== (source as any));
    }, (buffer.duration + 0.1) * 1000);
    
    return true;
  }

  public async playServerScanSuccess() {
    if (this.isMuted) return;
    try {
      if (typeof window === 'undefined') return;
      await this.init();
      if (!this.serverSuccessBuffer) {
        this.serverSuccessBuffer = await this.loadAudioBuffer('/sounds/deep_gravelly_success.mp3');
      }
      const played = this.playBuffer(this.serverSuccessBuffer);
      if (!played) this.playSuccess(); // Fallback
    } catch (e) {
      console.warn('[CSE Audio] Server MP3 blocked:', e);
      this.playSuccess();
    }
  }

  public async playStudentScanComplete() {
    if (this.isMuted) return;
    try {
      if (typeof window === 'undefined') return;
      await this.init();
      if (!this.studentSuccessBuffer) {
        this.studentSuccessBuffer = await this.loadAudioBuffer('/sounds/deep_gravelly_success.mp3');
      }
      const played = this.playBuffer(this.studentSuccessBuffer);
      if (!played) this.playFoodReady(); // Fallback
    } catch (e) {
      console.warn('[CSE Audio] Student MP3 blocked:', e);
      this.playFoodReady();
    }
  }
}

export const cseSounds = new SoundService();
