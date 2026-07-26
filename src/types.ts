// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

export interface PulseNetOptions {
  endpoint: string;
  appId: string;
  flushInterval?: number;
  debug?: boolean;
}

export interface PulseNetPayload {
  appId: string;
  period: { start: number; end: number };
  pageViews: Record<string, number>;
  events: Record<string, number>;
  sessions: { count: number; avgDurationSec: number; bounceRate: number };
  timing: Record<string, { p50: number; p95: number; p99: number }>;
  referrers: Record<string, number>;
  devices: Record<string, number>;
  noiseLevel: number;
}
