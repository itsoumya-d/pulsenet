import { PulseNetPayload } from './types';

export class TransportLayer {
  private endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async send(payload: PulseNetPayload): Promise<void> {
    const data = JSON.stringify(payload);
    
    // Try beacon first for page unloads
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([data], { type: 'application/json' });
      if (navigator.sendBeacon(this.endpoint, blob)) {
        return;
      }
    }

    // Fallback to fetch
    if (typeof fetch !== 'undefined') {
      try {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true
        });
      } catch (e) {
        console.error('[PulseNet] Failed to send analytics payload', e);
      }
    }
  }
}
