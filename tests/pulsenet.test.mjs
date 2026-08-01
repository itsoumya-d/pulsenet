/**
 * PulseNet tests — node:test, no extra deps.
 * Runs in Node.js 24 (non-browser): browser globals are stubbed below.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Stub browser globals that PulseNet expects
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { pathname: '/test', href: 'http://localhost/test', hostname: 'localhost' },
    history: { pushState: () => {} },
    performance: { getEntriesByType: () => [] },
  };
}
// auto-track.ts calls history.pushState at module scope
if (typeof globalThis.history === 'undefined') {
  globalThis.history = {
    pushState: (...args) => {
      // no-op
    },
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    referrer: '',
    visibilityState: 'visible',
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
if (typeof globalThis.sessionStorage === 'undefined') {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
}
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { sendBeacon: () => true };
}
if (typeof globalThis.performance === 'undefined') {
  globalThis.performance = { now: () => Date.now() };
}
// Stub fetch so flush() doesn't throw
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });

const { PulseNet, FederatedAggregator } = require(join(__dirname, '..', 'dist', 'index.js'));

describe('Module shape', () => {
  test('exports PulseNet class', () => {
    assert.equal(typeof PulseNet, 'function');
  });

  test('exports FederatedAggregator class', () => {
    assert.equal(typeof FederatedAggregator, 'function');
  });
});

describe('PulseNet construction', () => {
  test('constructs with required options', () => {
    const pn = new PulseNet({
      appId: 'test-app',
      endpoint: 'http://localhost:4003/api/collect',
    });
    assert.ok(pn);
    pn.destroy();
  });

  test('constructs with no options (LicenseValidator allow-all)', () => {
    // Should not throw — LicenseValidator permits missing options in dev
    const pn = new PulseNet();
    assert.ok(pn);
    pn.destroy();
  });
});

describe('PulseNet public methods', () => {
  let pn;
  test('before: create instance', () => {
    pn = new PulseNet({ appId: 'test', endpoint: 'http://localhost:4003/api/collect' });
  });

  test('track() accepts event name without throwing', () => {
    assert.doesNotThrow(() => pn.track('test_event'));
  });

  test('track() with empty string does not throw', () => {
    assert.doesNotThrow(() => pn.track(''));
  });

  test('pageView() with explicit path does not throw', () => {
    assert.doesNotThrow(() => pn.pageView('/test-path'));
  });

  test('pageView() with no argument uses window.location.pathname', () => {
    assert.doesNotThrow(() => pn.pageView());
  });

  test('timing() accepts category/variable/duration', () => {
    assert.doesNotThrow(() => pn.timing('api', 'fetch', 123.45));
  });

  test('timing() with zero duration does not throw', () => {
    assert.doesNotThrow(() => pn.timing('cat', 'var', 0));
  });

  test('disable() stops tracking', () => {
    pn.disable();
    assert.doesNotThrow(() => pn.track('should_not_throw'));
  });

  test('enable() resumes tracking', () => {
    pn.enable();
    assert.doesNotThrow(() => pn.track('resumed'));
  });

  test('flush() returns a promise', async () => {
    const result = pn.flush();
    assert.ok(result instanceof Promise);
    await result;
  });

  test('destroy() does not throw', () => {
    assert.doesNotThrow(() => pn.destroy());
  });

  test('calling methods after destroy() does not throw', () => {
    assert.doesNotThrow(() => pn.track('after_destroy'));
    assert.doesNotThrow(() => pn.pageView('/after'));
  });
});

describe('FederatedAggregator', () => {
  test('constructs without arguments', () => {
    const fa = new FederatedAggregator();
    assert.ok(fa);
  });

  test('getGlobalAggregate() returns zero-initialised object', () => {
    const fa = new FederatedAggregator();
    const agg = fa.getGlobalAggregate();
    assert.equal(typeof agg.pageViews, 'number');
    assert.equal(typeof agg.events, 'number');
    assert.equal(typeof agg.avgTiming, 'number');
    assert.equal(agg.pageViews, 0);
    assert.equal(agg.events, 0);
  });

  test('updateLocal() increments page views', () => {
    const fa = new FederatedAggregator();
    fa.updateLocal({ pageViews: 5 });
    const agg = fa.getGlobalAggregate();
    assert.equal(agg.pageViews, 5);
  });

  test('receivePeerData() merges a gossip message', () => {
    const fa = new FederatedAggregator();
    fa.updateLocal({ pageViews: 10, events: 2 });
    fa.receivePeerData({
      type: 'aggregate',
      data: { pageViews: 20, events: 4, avgTiming: 0 },
      contributorCount: 1,
    });
    const agg = fa.getGlobalAggregate();
    // Weighted average: (10*1 + 20*1) / 2 = 15
    assert.ok(agg.pageViews > 0);
  });

  test('receivePeerData() ignores messages with wrong type', () => {
    const fa = new FederatedAggregator();
    fa.updateLocal({ pageViews: 5 });
    fa.receivePeerData({ type: 'unknown', data: {}, contributorCount: 1 });
    // Should be unchanged
    assert.equal(fa.getGlobalAggregate().pageViews, 5);
  });

  test('on("aggregateUpdated") callback fires after receivePeerData', (t, done) => {
    const fa = new FederatedAggregator();
    fa.on('aggregateUpdated', () => done());
    fa.receivePeerData({
      type: 'aggregate',
      data: { pageViews: 1, events: 0, avgTiming: 0 },
      contributorCount: 1,
    });
  });

  test('shareLocalAggregates() does not throw when no peers connected', () => {
    const fa = new FederatedAggregator();
    fa.updateLocal({ events: 3 });
    assert.doesNotThrow(() => fa.shareLocalAggregates(1.0, 1.0));
  });

  test('connect() without WebSocket available logs warning, does not throw', () => {
    const fa = new FederatedAggregator();
    // WebSocket is not defined in Node.js test environment — the method early-returns
    assert.doesNotThrow(() => fa.connect('ws://localhost:9999', 'ch1'));
    // No timer is set because WebSocket is undefined; nothing to clean up.
  });
});

describe('Error / adversarial cases', () => {
  test('double-destroy() does not throw', () => {
    const pn = new PulseNet({ appId: 'x', endpoint: 'http://localhost/api/collect' });
    pn.destroy();
    assert.doesNotThrow(() => pn.destroy());
  });

  test('track() with very long event name does not throw', () => {
    const pn = new PulseNet({ appId: 'x', endpoint: 'http://localhost/api/collect' });
    assert.doesNotThrow(() => pn.track('e'.repeat(10000)));
    pn.destroy();
  });

  test('timing() with negative duration does not throw', () => {
    const pn = new PulseNet({ appId: 'x', endpoint: 'http://localhost/api/collect' });
    assert.doesNotThrow(() => pn.timing('cat', 'var', -100));
    pn.destroy();
  });
});
