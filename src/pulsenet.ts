import { LicenseValidator } from "./license-validator";
// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1619@gmail.com

import { PulseNetOptions, DeliveryStatus } from './types';
import { Aggregator } from './aggregator';
import { SessionTracker } from './session-tracker';
import { TransportLayer } from './transport';
import { setupAutoTrack } from './auto-track';

// Bound retained serialized snapshots, including the in-flight snapshot.
const MAX_PENDING_PAYLOADS = 10;
const MAX_PAYLOAD_BYTES = 60 * 1024;
const MAX_SEND_ATTEMPTS = 3;

interface PendingPayload {
  data: string;
  attempts: number;
  useBeacon: boolean;
}

export class PulseNet {
  private options: PulseNetOptions;
  private aggregator: Aggregator;
  private sessionTracker: SessionTracker;
  private transport: TransportLayer;
  private timer: any;
  private enabled: boolean = true;
  private pending: PendingPayload[] = [];
  private draining?: Promise<void>;
  private acknowledgedPayloads = 0;
  private beaconQueuedPayloads = 0;
  private droppedPayloads = 0;
  private boundVisibilityHandler = () => { if (document.visibilityState === 'hidden') void this.enqueueAndFlush(true); };
  private boundPagehideHandler = () => { if (!this.enabled) return; const stats = this.sessionTracker.getSessionStats(); this.aggregator.recordSession(stats.durationSec, stats.pageCount); void this.enqueueAndFlush(true); };

  constructor(options?: any) {
    LicenseValidator.validate(options);
    // constructor(options: PulseNetOptions) {
    this.options = { flushInterval: 60000, debug: false, ...options };
    this.aggregator = new Aggregator();
    this.sessionTracker = new SessionTracker();
    this.transport = new TransportLayer(this.options.endpoint);

    if (typeof window !== 'undefined') {
      this.timer = setInterval(() => this.flush(), this.options.flushInterval);
      
      window.addEventListener('visibilitychange', this.boundVisibilityHandler);
      window.addEventListener('pagehide', this.boundPagehideHandler);

      setupAutoTrack(this);
      this.pageView(); // track initial page load
    }
  }

  enable() { this.enabled = true; }
  disable() { this.enabled = false; }

  track(event: string, properties?: Record<string, any>) {
    if (!this.enabled) return;
    this.sessionTracker.recordActivity();
    this.aggregator.recordEvent(event);
    if (this.options.debug) console.log(`[PulseNet] Track: ${event}`);
  }

  pageView(path?: string) {
    if (!this.enabled) return;
    const currentPath = path || (typeof window !== 'undefined' ? window.location.pathname : '/');
    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    
    this.sessionTracker.recordPageView();
    this.aggregator.recordPageView(currentPath, referrer);
    if (this.options.debug) console.log(`[PulseNet] PageView: ${currentPath}`);
  }

  timing(category: string, variable: string, durationMs: number) {
    if (!this.enabled) return;
    this.aggregator.recordTiming(`${category}:${variable}`, durationMs);
  }

  async flush(): Promise<void> {
    await this.enqueueAndFlush(false);
  }

  getDeliveryStatus(): DeliveryStatus {
    return {
      pendingPayloads: this.pending.length,
      acknowledgedPayloads: this.acknowledgedPayloads,
      beaconQueuedPayloads: this.beaconQueuedPayloads,
      droppedPayloads: this.droppedPayloads,
    };
  }

  private async enqueueAndFlush(useBeacon: boolean): Promise<void> {
    if (!this.enabled) return;
    if (this.aggregator.hasData()) {
      // Freeze the noised wire representation once. Retry never re-noises or
      // merges newer activity into a previously attempted snapshot.
      const data = JSON.stringify(this.aggregator.getPayload(this.options.appId));
      if (this.pending.length >= MAX_PENDING_PAYLOADS ||
          new TextEncoder().encode(data).byteLength > MAX_PAYLOAD_BYTES) {
        this.droppedPayloads++;
        if (this.options.debug) console.warn('[PulseNet] Dropped snapshot: delivery queue or payload limit');
      } else {
        this.pending.push({ data, attempts: 0, useBeacon });
      }
    }
    if (useBeacon) {
      for (const snapshot of this.pending) snapshot.useBeacon = true;
    }
    if (!this.draining) {
      // Lifecycle promotion applies to the current drain only. A later regular
      // retry must seek an HTTP acknowledgement, even after an interrupted hide.
      if (!useBeacon) {
        for (const snapshot of this.pending) snapshot.useBeacon = false;
      }
      // Install the single-flight latch before invoking user/browser transport.
      this.draining = Promise.resolve().then(() => this.drain());
    }
    await this.draining;
  }

  private async drain(): Promise<void> {
    try {
      while (this.enabled && this.pending.length > 0) {
        const snapshot = this.pending[0];
        snapshot.attempts++;
        const useBeacon = snapshot.useBeacon;
        snapshot.useBeacon = false;
        try {
          const outcome = await this.transport.send(snapshot.data, useBeacon);
          this.pending.shift();
          if (outcome === 'acknowledged') this.acknowledgedPayloads++;
          else this.beaconQueuedPayloads++;
        } catch (err) {
          if (snapshot.attempts >= MAX_SEND_ATTEMPTS) {
            this.pending.shift();
            this.droppedPayloads++;
          }
          // One attempt per failed drain; the next manual/interval/lifecycle
          // flush retries. No immediate retry loop and no additional timers.
          if (this.options.debug) console.warn('[PulseNet] Flush failed', err);
          break;
        }
      }
    } finally {
      // Release before completing this promise, so a new flush at the drain
      // boundary starts another drain rather than joining an already-done one.
      this.draining = undefined;
    }
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      window.removeEventListener('pagehide', this.boundPagehideHandler);
    }
    this.flush();
  }
}
