import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PulseNet } from '../dist/index.mjs';

function harness(t, options = {}) {
  // All events are synthetic; no request leaves this process. Near-zero noise
  // makes counts deterministic without changing the production privacy code.
  const descriptors = new Map();
  const stub = (key, value) => {
    if (!descriptors.has(key)) descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  stub('crypto', { getRandomValues: array => array.fill(0x80000000) });
  stub('navigator', { userAgent: 'synthetic-test' });
  stub('fetch', async () => ({ ok: true, status: 204 }));
  t.after(() => {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { pn: new PulseNet({ appId: 'synthetic', endpoint: 'https://collector.invalid/api/collect', ...options }), stub };
}

for (const failure of ['network', 'http']) {
  test(`retries the identical snapshot after ${failure} failure and preserves newer events`, async t => {
    const { pn, stub } = harness(t);
    const requests = [];
    stub('fetch', async (_url, options) => {
      requests.push(options.body);
      if (requests.length === 1) {
        if (failure === 'network') throw new Error('synthetic offline');
        return { ok: false, status: 503 };
      }
      return { ok: true, status: 204 };
    });
    pn.track('before_failure');
    await pn.flush();
    pn.track('during_recovery');
    await pn.flush();
    assert.equal(requests[1], requests[0], 'the first failed noised snapshot must be retried byte-for-byte');
    assert.deepEqual(JSON.parse(requests[2]).events, { during_recovery: 1 });
    assert.equal(requests.length, 3);
    await pn.flush();
    assert.equal(requests.length, 3, 'acknowledged snapshots must not be sent again');
  });
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function started() {
  // Allow enqueue, drain and mocked fetch to start without a real clock delay.
  await Promise.resolve();
  await Promise.resolve();
}

test('overlapping flushes are single-flight, FIFO and keep in-flight data separate', async t => {
  const { pn, stub } = harness(t);
  const first = deferred();
  const requests = [];
  let active = 0, maxActive = 0;
  stub('fetch', async (_url, options) => {
    requests.push(options.body);
    maxActive = Math.max(maxActive, ++active);
    const result = requests.length === 1 ? await first.promise : { ok: true, status: 204 };
    active--;
    return result;
  });
  pn.track('first');
  const a = pn.flush();
  await started();
  pn.track('second');
  const b = pn.flush();
  const c = pn.flush();
  assert.equal(requests.length, 1);
  first.resolve({ ok: true, status: 204 });
  await Promise.all([a, b, c]);
  assert.equal(maxActive, 1);
  assert.deepEqual(requests.map(data => JSON.parse(data).events), [{ first: 1 }, { second: 1 }]);
  assert.deepEqual(pn.getDeliveryStatus(), { pendingPayloads: 0, acknowledgedPayloads: 2, beaconQueuedPayloads: 0, droppedPayloads: 0 });
});

test('overlapping flushes do not immediately retry a failed request', async t => {
  const { pn, stub } = harness(t);
  const first = deferred();
  let calls = 0;
  stub('fetch', () => { calls++; return first.promise; });
  pn.track('one');
  const a = pn.flush();
  await started();
  pn.track('two');
  const b = pn.flush();
  first.reject(new Error('synthetic offline'));
  await Promise.all([a, b]);
  assert.equal(calls, 1);
  assert.equal(pn.getDeliveryStatus().pendingPayloads, 2);
});

test('three failed attempts exhaust a snapshot, then a later flush can recover', async t => {
  const { pn, stub } = harness(t);
  const requests = [];
  stub('fetch', async (_url, options) => { requests.push(options.body); return { ok: false, status: 429 }; });
  pn.track('expires');
  for (let n = 0; n < 3; n++) await pn.flush();
  assert.equal(requests.length, 3);
  assert.ok(requests.every(body => body === requests[0]));
  assert.deepEqual(pn.getDeliveryStatus(), { pendingPayloads: 0, acknowledgedPayloads: 0, beaconQueuedPayloads: 0, droppedPayloads: 1 });
  await pn.flush();
  assert.equal(requests.length, 3);
  stub('fetch', async () => ({ ok: true, status: 200 }));
  pn.track('recovers');
  await pn.flush();
  assert.equal(pn.getDeliveryStatus().acknowledgedPayloads, 1);
});

test('queue limit includes in-flight payload and drops newest snapshots visibly', async t => {
  const { pn, stub } = harness(t);
  const first = deferred();
  const requests = [];
  stub('fetch', (_url, options) => {
    requests.push(JSON.parse(options.body).events);
    return requests.length === 1 ? first.promise : Promise.resolve({ ok: true, status: 200 });
  });
  const flushes = [];
  for (let n = 0; n < 12; n++) {
    pn.track(`event_${n}`);
    flushes.push(pn.flush());
    await started();
  }
  assert.equal(requests.length, 1);
  assert.deepEqual(pn.getDeliveryStatus(), { pendingPayloads: 10, acknowledgedPayloads: 0, beaconQueuedPayloads: 0, droppedPayloads: 2 });
  first.resolve({ ok: true, status: 200 });
  await Promise.all(flushes);
  assert.deepEqual(requests, Array.from({ length: 10 }, (_, n) => ({ [`event_${n}`]: 1 })));
  assert.equal(pn.getDeliveryStatus().pendingPayloads, 0);
  assert.equal(pn.getDeliveryStatus().acknowledgedPayloads, 10);
});

test('oversized UTF-8 snapshots are dropped and small subsequent activity still sends', async t => {
  const { pn, stub } = harness(t);
  const requests = [];
  stub('fetch', async (_url, options) => { requests.push(options.body); return { ok: true, status: 200 }; });
  pn.track('😀'.repeat(16000));
  await pn.flush();
  assert.equal(requests.length, 0);
  assert.equal(pn.getDeliveryStatus().droppedPayloads, 1);
  pn.track('small');
  await pn.flush();
  assert.deepEqual(JSON.parse(requests[0]).events, { small: 1 });
});

test('idle flushes do not sample noise and timing-only activity is sent', async t => {
  const { pn, stub } = harness(t);
  let samples = 0;
  const requests = [];
  stub('crypto', { getRandomValues: array => { samples++; return array.fill(0x80000000); } });
  stub('fetch', async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, status: 200 }; });
  await pn.flush();
  assert.equal(samples, 0);
  assert.equal(requests.length, 0);
  pn.timing('synthetic', 'latency', 123);
  await pn.flush();
  assert.deepEqual(requests[0].timing, { 'synthetic:latency': { p50: 123, p95: 123, p99: 123 } });
  await pn.flush();
  assert.equal(requests.length, 1);
});

test('retry does not sample noise again or change the original interval', async t => {
  const { pn, stub } = harness(t);
  let samples = 0;
  const requests = [];
  stub('crypto', { getRandomValues: array => { samples++; return array.fill(0x80000000); } });
  t.mock.method(Date, 'now', () => 100000);
  stub('fetch', async (_url, options) => { requests.push(options.body); return { ok: requests.length > 1, status: 503 }; });
  pn.pageView('/synthetic');
  await pn.flush();
  const originalSamples = samples;
  t.mock.method(Date, 'now', () => 200000);
  await pn.flush();
  assert.equal(samples, originalSamples);
  assert.equal(requests[0], requests[1]);
});

test('a timed-out request aborts and releases the queue; a late result cannot acknowledge its retry', async t => {
  const { pn, stub } = harness(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const oldRequest = deferred();
  const retry = deferred();
  const requests = [];
  stub('fetch', (_url, options) => {
    requests.push(options);
    return requests.length === 1 ? oldRequest.promise : retry.promise;
  });
  pn.track('timeout');
  const flush = pn.flush();
  await started();
  t.mock.timers.tick(10000);
  await flush;
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(pn.getDeliveryStatus().pendingPayloads, 1);
  const second = pn.flush();
  await started();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body, requests[1].body);
  oldRequest.resolve({ ok: true, status: 200 });
  await started();
  assert.equal(pn.getDeliveryStatus().acknowledgedPayloads, 0);
  retry.resolve({ ok: true, status: 200 });
  await second;
  assert.equal(pn.getDeliveryStatus().acknowledgedPayloads, 1);
});

test('missing fetch retains the snapshot until transport recovers', async t => {
  const { pn, stub } = harness(t);
  stub('fetch', undefined);
  pn.track('missing_transport');
  await pn.flush();
  assert.equal(pn.getDeliveryStatus().pendingPayloads, 1);
  const requests = [];
  stub('fetch', async (_url, options) => { requests.push(options.body); return { ok: true, status: 200 }; });
  await pn.flush();
  assert.deepEqual(JSON.parse(requests[0]).events, { missing_transport: 1 });
  assert.equal(pn.getDeliveryStatus().pendingPayloads, 0);
});

test('disabled tracking pauses pending retries and enable resumes them', async t => {
  const { pn, stub } = harness(t);
  const first = deferred();
  let calls = 0;
  stub('fetch', async () => { calls++; return calls === 1 ? first.promise : { ok: true, status: 200 }; });
  pn.track('one');
  const a = pn.flush();
  await started();
  pn.track('two');
  const b = pn.flush();
  pn.disable();
  first.resolve({ ok: true, status: 200 });
  await Promise.all([a, b]);
  await pn.flush();
  pn.track('ignored');
  assert.equal(calls, 1);
  assert.equal(pn.getDeliveryStatus().pendingPayloads, 1);
  pn.enable();
  await pn.flush();
  assert.equal(calls, 2);
  assert.equal(pn.getDeliveryStatus().pendingPayloads, 0);
});

function browser(t, stub) {
  const listeners = new Map();
  stub('window', {
    location: { hostname: 'localhost', pathname: '/synthetic' },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
  });
  stub('history', { pushState() {} });
  stub('document', { referrer: '', visibilityState: 'visible' });
  const pn = new PulseNet({ appId: 'synthetic', endpoint: 'https://collector.invalid/api/collect' });
  t.after(() => { pn.disable(); pn.destroy(); });
  return { pn, listeners };
}

test('regular flush uses acknowledged fetch even when beacon is available', async t => {
  const { pn, stub } = harness(t);
  let beacons = 0, fetches = 0;
  stub('navigator', { sendBeacon: () => { beacons++; return true; } });
  stub('fetch', async () => { fetches++; return { ok: true, status: 204 }; });
  pn.track('normal');
  await pn.flush();
  assert.equal(beacons, 0);
  assert.equal(fetches, 1);
  assert.equal(pn.getDeliveryStatus().acknowledgedPayloads, 1);
});

for (const beaconMode of ['accepted', 'refused', 'throws']) {
  test(`lifecycle beacon ${beaconMode} has truthful outcomes and fetch fallback`, async t => {
    const { stub } = harness(t);
    const { pn, listeners } = browser(t, stub);
    let fetches = 0;
    const beacons = [];
    stub('navigator', { sendBeacon: (_url, body) => {
      beacons.push(body);
      if (beaconMode === 'throws') throw new Error('synthetic beacon rejection');
      return beaconMode === 'accepted';
    } });
    stub('fetch', async () => { fetches++; return { ok: true, status: 204 }; });
    document.visibilityState = 'hidden';
    listeners.get('visibilitychange')();
    await pn.flush();
    assert.equal(beacons.length, 1);
    assert.equal(fetches, beaconMode === 'accepted' ? 0 : 1);
    assert.deepEqual(JSON.parse(await beacons[0].text()).pageViews, { '/synthetic': 1 });
    const status = pn.getDeliveryStatus();
    assert.equal(status.beaconQueuedPayloads, beaconMode === 'accepted' ? 1 : 0);
    assert.equal(status.acknowledgedPayloads, beaconMode === 'accepted' ? 0 : 1);
    assert.equal(status.pendingPayloads, 0);
    await pn.flush();
    assert.equal(beacons.length, 1, 'browser-queued snapshot is not blindly retried');
  });
}

test('pagehide queues session-only activity even when noised session count is zero', async t => {
  const { stub } = harness(t);
  const { pn, listeners } = browser(t, stub);
  await pn.flush();
  stub('crypto', { getRandomValues: array => array.fill(0xf0000000) });
  const beacons = [];
  stub('navigator', { sendBeacon: (_url, body) => { beacons.push(body); return true; } });
  listeners.get('pagehide')();
  await pn.flush();
  assert.equal(beacons.length, 1);
  const payload = JSON.parse(await beacons[0].text());
  assert.equal(payload.sessions.count, 0);
  assert.deepEqual(payload.events, {});
});

test('a failed lifecycle attempt retries via acknowledged fetch on the next manual flush', async t => {
  const { stub } = harness(t);
  const { pn, listeners } = browser(t, stub);
  let beacons = 0;
  const requests = [];
  stub('navigator', { sendBeacon: () => { beacons++; return false; } });
  stub('fetch', async (_url, options) => {
    requests.push(options.body);
    return { ok: requests.length > 1, status: requests.length > 1 ? 204 : 503 };
  });
  document.visibilityState = 'hidden';
  listeners.get('visibilitychange')();
  await pn.flush();
  assert.equal(pn.getDeliveryStatus().pendingPayloads, 1);
  document.visibilityState = 'visible';
  await pn.flush();
  assert.equal(beacons, 1);
  assert.equal(requests[0], requests[1]);
  assert.equal(pn.getDeliveryStatus().acknowledgedPayloads, 1);
});

test('interval retries retained snapshots and successful sends clear their timeout', async t => {
  const { stub } = harness(t);
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { pn } = browser(t, stub);
  const requests = [];
  stub('fetch', async (_url, options) => {
    requests.push(options);
    return { ok: requests.length > 1, status: requests.length > 1 ? 204 : 503 };
  });
  await pn.flush();
  assert.equal(requests.length, 1);
  t.mock.timers.tick(60000);
  await pn.flush();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body, requests[1].body);
  t.mock.timers.tick(10000);
  assert.equal(requests[1].signal.aborted, false);
});

test('disabled pagehide does not record a session that leaks into a later flush', async t => {
  const { stub } = harness(t);
  const { pn, listeners } = browser(t, stub);
  let requests = 0;
  stub('fetch', async () => { requests++; return { ok: true, status: 204 }; });
  await pn.flush();
  pn.disable();
  listeners.get('pagehide')();
  pn.enable();
  await pn.flush();
  assert.equal(requests, 1);
});

test('hide during an in-flight failure does not force a later visible retry onto beacon', async t => {
  const { stub } = harness(t);
  const { pn, listeners } = browser(t, stub);
  const first = deferred();
  const requests = [];
  let beacons = 0;
  stub('navigator', { sendBeacon: () => { beacons++; return true; } });
  stub('fetch', (_url, options) => {
    requests.push(options.body);
    return requests.length === 1 ? first.promise : Promise.resolve({ ok: true, status: 204 });
  });
  const a = pn.flush();
  await started();
  document.visibilityState = 'hidden';
  listeners.get('visibilitychange')();
  first.reject(new Error('synthetic offline'));
  await a;
  document.visibilityState = 'visible';
  await pn.flush();
  assert.equal(beacons, 0);
  assert.equal(requests.length, 2);
  assert.equal(requests[0], requests[1]);
  assert.equal(pn.getDeliveryStatus().acknowledgedPayloads, 1);
});
