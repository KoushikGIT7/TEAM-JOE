/**
 * HARDWARE SCANNER — HIGH THROUGHPUT EDITION
 *
 * Supports:
 * - USB QR scanner (HID mode, keyboard emulation)
 * - POS barcode scanner
 * - Camera-based scanner (via QRScanner component)
 *
 * Design goals:
 * - Zero dropped scans (window-level fallback listener)
 * - Instant re-focus after serve (no delays)
 * - Buffer auto-cleared after 200ms inactivity (prevents stale data)
 * - 50ms duplicate guard (avoids double-fire on same scan)
 */

export interface ScannerConfig {
  suffixKey?: string;
  disableBeep?: boolean;
  autoFocus?: boolean;
}

const DEFAULT_CONFIG: ScannerConfig = {
  suffixKey: 'Enter',
  disableBeep: false,
  autoFocus: true,
};

export class HardwareScanner {
  private buffer: string = '';
  private config: ScannerConfig;
  private onScanCallback?: (data: string) => void;
  private inputElement: HTMLInputElement | null = null;
  private lastScanTime: number = 0;
  private bufferTimer: ReturnType<typeof setTimeout> | null = null;

  // Window-level fallback listener — catches keystrokes even when focus drifts
  private windowKeyHandler?: (e: KeyboardEvent) => void;

  constructor(config: Partial<ScannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  initialize(inputId: string = 'scanner-input'): void {
    // Create or reuse hidden input
    let input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) {
      input = document.createElement('input');
      input.id = inputId;
      input.type = 'text';
      Object.assign(input.style, {
        position: 'fixed',
        left: '-9999px',
        opacity: '0',
        pointerEvents: 'none',
      });
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      (input as any).autocorrect = 'off';
      input.spellcheck = false;
      document.body.appendChild(input);
    }
    this.inputElement = input;

    // Primary: keydown on hidden input
    input.addEventListener('keydown', this.handleKey);

    // Re-focus INSTANTLY (no delay) on blur
    input.addEventListener('blur', () => {
      if (this.config.autoFocus && this.inputElement) {
        this.inputElement.focus();
      }
    });

    // Fallback: window-level listener catches keys when another element has focus
    this.windowKeyHandler = (e: KeyboardEvent) => {
      // Only intercept if the active element is NOT a real input/textarea
      const active = document.activeElement;
      const isTyping = active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement;
      if (isTyping && active !== this.inputElement) return;
      this.handleKey(e);
    };
    window.addEventListener('keydown', this.windowKeyHandler, true);

    if (this.config.autoFocus) input.focus();
  }

  private handleKey = (e: KeyboardEvent): void => {
    const suffix = this.config.suffixKey || 'Enter';

    if (e.key === suffix || e.key === 'Enter') {
      const data = this.buffer.trim();
      this.buffer = '';
      if (this.inputElement) this.inputElement.value = '';
      if (this.bufferTimer) { clearTimeout(this.bufferTimer); this.bufferTimer = null; }

      if (!data) return;

      // 50ms duplicate guard — hardware scanners sometimes fire twice
      const now = Date.now();
      if (now - this.lastScanTime < 50) return;
      this.lastScanTime = now;

      this.onScanCallback?.(data);
    } else if (e.key === 'Backspace') {
      this.buffer = this.buffer.slice(0, -1);
    } else if (e.key.length === 1) {
      this.buffer += e.key;

      // Auto-clear stale buffer after 200ms inactivity
      if (this.bufferTimer) clearTimeout(this.bufferTimer);
      this.bufferTimer = setTimeout(() => {
        this.buffer = '';
        if (this.inputElement) this.inputElement.value = '';
      }, 200);
    }
  };

  onScan(callback: (data: string) => void): void {
    this.onScanCallback = callback;
  }

  focus(): void {
    this.inputElement?.focus();
  }

  destroy(): void {
    if (this.windowKeyHandler) {
      window.removeEventListener('keydown', this.windowKeyHandler, true);
    }
    if (this.bufferTimer) clearTimeout(this.bufferTimer);
    if (this.inputElement?.parentNode) {
      this.inputElement.removeEventListener('keydown', this.handleKey);
      this.inputElement.parentNode.removeChild(this.inputElement);
    }
    this.inputElement = null;
    this.onScanCallback = undefined;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let globalScanner: HardwareScanner | null = null;

export function initializeScanner(config?: Partial<ScannerConfig>): HardwareScanner {
  if (globalScanner) globalScanner.destroy();
  globalScanner = new HardwareScanner(config);
  globalScanner.initialize();
  return globalScanner;
}

export function getScanner(): HardwareScanner | null {
  return globalScanner;
}
