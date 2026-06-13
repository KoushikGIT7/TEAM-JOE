/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const joeSounds = {
  playServerScanSuccess: () => {
    // 1. Device vibration
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]);
    }

    // 2. Web Audio synthesis
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      
      // Tone 1: High crisp chime 523.25Hz (C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0.08, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.12);
      
      // Tone 2: Higher chime 659.25Hz (E5) played with slight shift
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.08);
      osc2.stop(ctx.currentTime + 0.22);
    } catch (e) {
      console.warn('Audio feedback context block:', e);
    }
  },

  playErrorBuzzer: () => {
    // 1. Devicce vibration
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    // 2. Web Audio synthesis
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      
      // Tone: Harsh low-frequency sawtooth 130Hz down to 80Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.35);
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn('Audio feedback error block:', e);
    }
  }
};
