import { PulseNetOptions } from './types';
import { Aggregator } from './aggregator';
import { SessionTracker } from './session-tracker';
import { TransportLayer } from './transport';
import { setupAutoTrack } from './auto-track';

export class PulseNet {
  private options: PulseNetOptions;
  private aggregator: Aggregator;
  private sessionTracker: SessionTracker;
  private transport: TransportLayer;
  private timer: any;
  private enabled: boolean = true;

  constructor(options: PulseNetOptions) {
    this.options = { flushInterval: 60000, debug: false, ...options };
    this.aggregator = new Aggregator();
    this.sessionTracker = new SessionTracker();
    this.transport = new TransportLayer(this.options.endpoint);

    if (typeof window !== 'undefined') {
      this.timer = setInterval(() => this.flush(), this.options.flushInterval);
      
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });
      
      window.addEventListener('pagehide', () => {
        const stats = this.sessionTracker.getSessionStats();
        this.aggregator.recordSession(stats.durationSec, stats.pageCount);
        this.flush();
      });

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

  async flush() {
    if (!this.enabled) return;
    const payload = this.aggregator.getPayload(this.options.appId);
    
    // Only send if there is data
    if (Object.keys(payload.pageViews).length > 0 || 
        Object.keys(payload.events).length > 0 || 
        payload.sessions.count > 0) {
      if (this.options.debug) console.log('[PulseNet] Flushing payload', payload);
      await this.transport.send(payload);
    }
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.flush();
  }
}
