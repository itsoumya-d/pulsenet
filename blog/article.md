# PulseNet Protocol: Zero-Cookie Web Analytics Powered by Client-Side Differential Privacy

## The Privacy Paradigm Shift
Web analytics traditionally relies on a central server hoarding user data, exposing organizations to GDPR fines and data breaches. **PulseNet** shifts this paradigm by moving aggregation to the edge and adding cryptographically seeded noise *before* data ever leaves the user's device.

## The Mathematics of Privacy
At the core of PulseNet is a Laplace mechanism, the standard building block of Differential Privacy (DP). The goal is that the presence or absence of any single user in the dataset should not significantly affect the final analytics output.

We inject Laplace noise directly into the client-side event payload, on-device, before transmission:

$$ \text{Noise} \sim \text{Laplace}(0, \Delta f / \epsilon) $$

Where:
- **$\Delta f$** is the sensitivity of the function (e.g., a single page view has a sensitivity of 1).
- **$\epsilon$** is the privacy parameter. PulseNet uses $\epsilon = 1.0$.

The sampler itself is correctly calibrated: the noise scale genuinely tracks `sensitivity / epsilon`, it is
seeded from `crypto.getRandomValues()`, and the noise is genuinely applied on the device rather than on the
server. The final value is clamped to a non-negative integer:

```
noised_value = Math.max(0, Math.round(true_value + Laplace(0, sensitivity / epsilon)))
```

### What PulseNet Does *Not* Currently Guarantee

A correctly calibrated Laplace sampler is necessary for an $\epsilon$-DP claim, but it is not sufficient. Three
gaps in the current implementation mean **you should not describe a PulseNet deployment as providing an
end-to-end $\epsilon$-differential-privacy guarantee**:

- **There is no privacy budget accounting, and no budget decay.** `src/privacy.ts` defines a
  `PrivacyBudgetTracker`, but no code path calls it, and it is not exported from `src/index.ts`. Nothing
  decrements a budget, nothing halts tracking when a budget is exhausted, and nothing composes the privacy
  loss across successive releases. Each flush draws fresh independent noise, so repeated releases of the same
  underlying statistic do not compose the way $\epsilon$-DP requires.
- **Sensitivity is assumed, not enforced.** $\Delta f = 1$ is passed to the noise function, but there is no
  per-client contribution clipping anywhere. A client that records $N$ events against one key has that count
  released with noise sized for a change of 1, so the effective loss for that client is $N \cdot \epsilon$.
- **Epsilon is not configurable.** It is a hardcoded private field with no `PulseNetOptions` entry and no
  setter.

There is also an accuracy consequence worth stating plainly: the `Math.max(0, …)` clamp truncates the negative
half of the noise distribution, so every reported count is biased **upward**, and because the collector sums
per-client payloads that bias accumulates linearly rather than cancelling out. Ten thousand clients
contributing one page view each report roughly 11,800, not 10,000. Treat PulseNet counts as directional trend
indicators, not as accurate totals.

Only `pageViews`, `events` and `sessions.count` receive noise. `timing` percentiles, `referrers`, `devices`,
`sessions.avgDurationSec` and `sessions.bounceRate` are transmitted verbatim.

## Federated Aggregation: An Unfinished Experiment
PulseNet exports a `FederatedAggregator` class. It is **not** enabled when you instantiate `PulseNet`, and it
is considerably less than its name suggests. Stated precisely, so that nobody builds on a promise that is not
in the repository:

1. **It creates no peer connections.** There is no `RTCPeerConnection`, no `iceServers`/STUN/TURN
   configuration, and no NAT-traversal logic anywhere in this codebase. You must construct the
   `RTCPeerConnection` and `RTCDataChannel` yourself and hand the open channel to `addPeer(channel)`.
2. **There is no secure aggregation and no cryptographic combination of payloads.** Merging is a plaintext
   weighted average. Peers exchange noised aggregates as ordinary JSON over whatever channel you supply.
3. **It trusts peer-supplied weights.** `receivePeerData()` uses the peer's own `contributorCount` as the merge
   weight with no validation, so a single dishonest peer can dominate the aggregate.
4. **Merged peer state is discarded.** The next call to `updateLocal()` recomputes the global aggregate from
   the local one, throwing away previously merged contributions.
5. **`connect()` only opens a WebSocket** to a signaling URL and re-dials every 5 seconds indefinitely, with no
   backoff, no cap and no cancellation handle.

Treat it as a sketch of a direction, not as a working privacy mechanism.

## Cost Comparison
Building an enterprise-scale analytics engine usually requires expensive cloud infrastructure (Kafka, ClickHouse, Redis). PulseNet's collector is a single Go binary writing to SQLite, which is what removes the cloud SaaS overhead — the SDK aggregates on-device so the collector only ever receives per-flush-window summaries.

| Platform | Privacy Setup | Starting Cost |
| :--- | :--- | :--- |
| **Google Analytics 360** | Complex (Requires Consent) | $150,000 / yr |
| **Mixpanel (Enterprise)** | Requires Engineering | $2,289 / mo |
| **PulseNet** | Built-in (Zero Cookies) | $0 (BSL 1.1) |

## Quickstart: AI Agent Integration
For AI coding assistants and developers, this is the **verified** integration path. Note that PulseNet is not
published on npm — the package names `@pulsenet/core`, `@pulsenet/browser` and `@pulsenet/sdk` do not exist.
Import from the jsDelivr CDN or build from source.

```typescript
// pulsenet-integration.ts
import { PulseNet } from 'https://cdn.jsdelivr.net/gh/itsoumya-d/pulsenet@main/dist/index.mjs';

const analytics = new PulseNet({
  appId: 'my-app',                                          // required
  endpoint: 'https://analytics.example.com/api/collect',    // required — your self-hosted collector
  flushInterval: 60000,                                     // optional, default 60000 ms
  debug: false                                              // optional
});

// Track a page view. Auto-tracking is already on by default;
// call this explicitly for routes your router does not emit.
analytics.pageView('/dashboard');

// Track a custom event. NOTE: the optional second `properties` argument
// is accepted by the signature but silently discarded — only the event
// name is counted, so encode any dimension you need into the name itself.
analytics.track('button_clicked');

// Track timing
const start = performance.now();
// ... work ...
analytics.timing('api', 'fetch_users', performance.now() - start);

// Flush and clean up
analytics.destroy();
```

`appId` and `endpoint` are the only required options, and there is currently **no constructor validation** — a
missing or misspelled `endpoint` will POST to the relative URL `undefined` and swallow the failure unless
`debug: true` is set. There is no `projectId`, no `privacyBudget` and no `gossipInterval` option; epsilon
cannot be configured at all.

For a classic `<script>` tag, `dist/index.global.js` attaches a **namespace object** to `window.PulseNet`, so
the constructor is `new PulseNet.PulseNet({ ... })`.
