/**
 * OFFLINE DETECTION & NETWORK STATUS MONITORING
 * 
 * Provides real-time network status detection and callbacks
 * for production fail-safe behavior.
 */

export type NetworkStatus = 'online' | 'offline' | 'slow';

export interface NetworkStatusListener {
  (status: NetworkStatus): void;
}

class OfflineDetector {
  private status: NetworkStatus = navigator.onLine ? 'online' : 'offline';
  private listeners: Set<NetworkStatusListener> = new Set();
  private lastPingTime: number = Date.now();
  private slowThreshold: number = 30000; // 30 seconds = slow connection

  constructor() {
    this.setupEventListeners();
    this.startPingMonitor();
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.updateStatus('online');
    });

    window.addEventListener('offline', () => {
      this.updateStatus('offline');
    });
  }

  private startPingMonitor(): void {
    // Monitor Firestore connection health
    setInterval(() => {
      if (this.status === 'online') {
        const timeSinceLastPing = Date.now() - this.lastPingTime;
        if (timeSinceLastPing > this.slowThreshold) {
          this.updateStatus('slow');
        }
      }
    }, 1000);
  }

  private updateStatus(newStatus: NetworkStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.status);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }

  /**
   * Register a listener for network status changes
   */
  onStatusChange(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current status
    listener(this.status);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return this.status;
  }

  /**
   * Check if network is available
   */
  isOnline(): boolean {
    return this.status !== 'offline';
  }

  /**
   * Check if network is slow
   */
  isSlow(): boolean {
    return this.status === 'slow';
  }

  /**
   * Update ping time (call this when Firestore operations succeed)
   */
  recordPing(): void {
    this.lastPingTime = Date.now();
    if (this.status === 'slow') {
      this.updateStatus('online');
    }
  }

  /**
   * Force status update (for testing)
   */
  setStatus(status: NetworkStatus): void {
    this.updateStatus(status);
  }
}

// Singleton instance
export const offlineDetector = new OfflineDetector();
