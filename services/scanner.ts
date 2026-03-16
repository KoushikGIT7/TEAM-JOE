
/**
 * HARDWARE SCANNER INTEGRATION
 * 
 * Supports:
 * - USB QR scanner (HID mode)
 * - POS scanner
 * - Camera-based scanner
 */

export interface ScannerConfig {
  suffixKey: string; // Usually "Enter"
  disableBeep: boolean;
  autoFocus: boolean;
}

const DEFAULT_CONFIG: ScannerConfig = {
  suffixKey: "Enter",
  disableBeep: false,
  autoFocus: true,
};

export class HardwareScanner {
  private buffer: string = "";
  private config: ScannerConfig;
  private onScanCallback?: (data: string) => void;
  private inputElement: HTMLInputElement | null = null;

  constructor(config: Partial<ScannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize scanner with hidden input field
   */
  initialize(inputId: string = "scanner-input"): void {
    // Create or get input element
    let input = document.getElementById(inputId) as HTMLInputElement;
    
    if (!input) {
      input = document.createElement("input");
      input.id = inputId;
      input.type = "text";
      input.style.position = "fixed";
      input.style.left = "-9999px";
      input.style.opacity = "0";
      input.style.pointerEvents = "none";
      input.autocomplete = "off";
      input.autocapitalize = "off";
      (input as any).autocorrect = "off";
      input.spellcheck = false;
      document.body.appendChild(input);
    }

    this.inputElement = input;

    // Set focus
    if (this.config.autoFocus) {
      input.focus();
    }

    // Handle keydown events
    input.addEventListener("keydown", (e) => {
      if (e.key === this.config.suffixKey || e.key === "Enter") {
        e.preventDefault();
        if (this.buffer.trim()) {
          this.handleScan(this.buffer.trim());
          this.buffer = "";
          input.value = "";
        }
      } else if (e.key === "Backspace") {
        this.buffer = this.buffer.slice(0, -1);
      } else if (e.key.length === 1) {
        this.buffer += e.key;
      }
    });

    // Keep focus on input
    input.addEventListener("blur", () => {
      if (this.config.autoFocus) {
        setTimeout(() => input?.focus(), 100);
      }
    });

    // Prevent manual typing (optional - can be disabled for testing)
    input.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.value.length > this.buffer.length + 5) {
        // Likely manual paste, reset
        this.buffer = "";
        target.value = "";
      }
    });
  }

  /**
   * Handle scanned data
   */
  private handleScan(data: string): void {
    if (this.onScanCallback) {
      this.onScanCallback(data);
    }
  }

  /**
   * Register scan callback
   */
  onScan(callback: (data: string) => void): void {
    this.onScanCallback = callback;
  }

  /**
   * Focus scanner input
   */
  focus(): void {
    if (this.inputElement) {
      this.inputElement.focus();
    }
  }

  /**
   * Destroy scanner
   */
  destroy(): void {
    if (this.inputElement && this.inputElement.parentNode) {
      this.inputElement.parentNode.removeChild(this.inputElement);
    }
    this.inputElement = null;
    this.onScanCallback = undefined;
  }
}

/**
 * Global scanner instance
 */
let globalScanner: HardwareScanner | null = null;

/**
 * Initialize global scanner
 */
export function initializeScanner(config?: Partial<ScannerConfig>): HardwareScanner {
  if (globalScanner) {
    globalScanner.destroy();
  }
  globalScanner = new HardwareScanner(config);
  globalScanner.initialize();
  return globalScanner;
}

/**
 * Get global scanner instance
 */
export function getScanner(): HardwareScanner | null {
  return globalScanner;
}
