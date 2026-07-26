// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

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
