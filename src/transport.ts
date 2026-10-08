// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1619@gmail.com

export type TransportResult = 'acknowledged' | 'beacon-queued';

export class TransportLayer {
  constructor(private endpoint: string) {}

  async send(data: string, useBeacon = false): Promise<TransportResult> {
    // A true return means browser-queued, never an acknowledgement from the server.
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon(this.endpoint, new Blob([data], { type: 'application/json' }))) {
          return 'beacon-queued';
        }
      } catch {
        // A throwing or refused beacon may still recover through fetch.
      }
    }

    if (typeof fetch === 'undefined') throw new Error('Fetch is unavailable');

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Bound the wait even if a transport ignores abort; late results cannot
      // acknowledge another attempt. Ambiguous network outcomes may duplicate.
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Analytics request timed out'));
          controller.abort();
        }, 10000);
      });
      const response = await Promise.race([
        fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true,
          signal: controller.signal,
        }),
        timeout,
      ]);
      if (!response.ok) throw new Error(`Analytics request failed with HTTP ${response.status}`);
      return 'acknowledged';
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
