// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

import { PulseNetPayload } from './types';
import { addLaplaceNoise } from './privacy';

export class Aggregator {
  private startTime: number = Date.now();
  private pageViews: Record<string, number> = {};
  private events: Record<string, number> = {};
  private referrers: Record<string, number> = {};
  private timing: Record<string, number[]> = {};
  private sessionDurations: number[] = [];
  private totalSessions: number = 0;
  private bouncedSessions: number = 0;
  private epsilon: number = 1.0;

  recordPageView(path: string, referrer: string) {
    this.pageViews[path] = (this.pageViews[path] || 0) + 1;
    if (referrer) {
      try {
        const hostname = new URL(referrer).hostname;
        this.referrers[hostname] = (this.referrers[hostname] || 0) + 1;
      } catch (e) {
        // ignore invalid urls
      }
    }
  }

  recordEvent(event: string) {
    this.events[event] = (this.events[event] || 0) + 1;
  }

  recordTiming(category: string, durationMs: number) {
    if (!this.timing[category]) this.timing[category] = [];
    this.timing[category].push(durationMs);
  }

  recordSession(durationSec: number, pageCount: number) {
    this.totalSessions++;
    this.sessionDurations.push(durationSec);
    if (pageCount <= 1) this.bouncedSessions++;
  }

  getDeviceCategory(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent || '';
    if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
    if (/Tablet|iPad/i.test(ua)) return 'tablet';
    return 'desktop';
  }

  private calculatePercentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    arr.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(arr.length - 1, index))];
  }

  getPayload(appId: string): PulseNetPayload {
    const end = Date.now();
    const start = this.startTime;
    this.startTime = end;

    const avgDuration = this.sessionDurations.length > 0 
      ? this.sessionDurations.reduce((a, b) => a + b, 0) / this.sessionDurations.length 
      : 0;
      
    const bounceRate = this.totalSessions > 0 ? this.bouncedSessions / this.totalSessions : 0;

    const noisyPageViews: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.pageViews)) {
      noisyPageViews[k] = addLaplaceNoise(v, 1, this.epsilon);
    }

    const noisyEvents: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.events)) {
      noisyEvents[k] = addLaplaceNoise(v, 1, this.epsilon);
    }

    const computedTiming: Record<string, { p50: number; p95: number; p99: number }> = {};
    for (const [k, v] of Object.entries(this.timing)) {
      computedTiming[k] = {
        p50: this.calculatePercentile(v, 50),
        p95: this.calculatePercentile(v, 95),
        p99: this.calculatePercentile(v, 99),
      };
    }

    const payload: PulseNetPayload = {
      appId,
      period: { start: Math.floor(start / 1000), end: Math.floor(end / 1000) },
      pageViews: noisyPageViews,
      events: noisyEvents,
      sessions: {
        count: addLaplaceNoise(this.totalSessions, 1, this.epsilon),
        avgDurationSec: Math.round(avgDuration),
        bounceRate: Number(bounceRate.toFixed(2))
      },
      timing: computedTiming,
      referrers: this.referrers,
      devices: { [this.getDeviceCategory()]: 1 },
      noiseLevel: this.epsilon
    };

    this.reset();
    return payload;
  }

  private reset() {
    this.pageViews = {};
    this.events = {};
    this.referrers = {};
    this.timing = {};
    this.sessionDurations = [];
    this.totalSessions = 0;
    this.bouncedSessions = 0;
  }
}
