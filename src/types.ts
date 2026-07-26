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
