# PulseNet Protocol: Zero-Cookie Web Analytics Powered by Differential Privacy and WebRTC Gossip

## The Privacy Paradigm Shift
Web analytics traditionally relies on a central server hoarding user data, exposing organizations to GDPR fines and data breaches. **PulseNet** shifts this paradigm by moving the computation to the edge and adding cryptographic noise *before* data ever leaves the user's device.

## The Mathematics of Privacy
At the core of PulseNet is Differential Privacy (DP). We ensure that the presence or absence of any single user in the dataset does not significantly affect the final analytics output. 

We achieve this by injecting Laplace noise directly into the client-side event payload:

$$ \text{Noise} \sim \text{Laplace}(0, \Delta f / \epsilon) $$

Where:
- **$\Delta f$** is the sensitivity of the function (e.g., a page view has a sensitivity of 1).
- **$\epsilon$** is the privacy budget. 

### Privacy Budget ($\epsilon$) Decay Management
A smaller $\epsilon$ provides tighter privacy but less accuracy. PulseNet implements a robust **budget decay** mechanism. For every event tracked in a session, the remaining privacy budget decreases:

$$ \epsilon_{t} = \epsilon_0 - \sum_{i=1}^{t} c_i $$

Once $\epsilon_t \le 0$, PulseNet halts tracking for that specific device until the epoch resets, ensuring mathematically guaranteed privacy upper bounds.

## WebRTC Gossip Aggregation Protocol
Instead of sending events directly to a central database, PulseNet leverages a P2P WebRTC gossip network.

1. **Client-side Injection**: Device A records an event and injects Laplace noise locally.
2. **Gossip Protocol**: Device A sends its encrypted, noisy state to Device B via WebRTC.
3. **Federated Aggregation**: Devices cryptographically combine their payloads.
4. **Final Sync**: Only the highly aggregated, anonymized data payload reaches the PulseNet collector node.

*This structure prevents any single node—including PulseNet's servers—from isolating individual behavior.*

## Cost Comparison
Building an enterprise-scale analytics engine usually requires expensive cloud infrastructure (Kafka, ClickHouse, Redis). By offloading computation to the P2P network, PulseNet destroys cloud SaaS overhead.

| Platform | Privacy Setup | Starting Cost |
| :--- | :--- | :--- |
| **Google Analytics 360** | Complex (Requires Consent) | $150,000 / yr |
| **Mixpanel (Enterprise)** | Requires Engineering | $2,289 / mo |
| **PulseNet** | Built-in (Zero Cookies) | $0 (BSL 1.1) |

## Quickstart: AI Agent Integration
For AI coding assistants and developers, integrating PulseNet takes seconds.

```typescript
// pulsenet-integration.ts
import { PulseNet } from '@pulsenet/core';

const analytics = new PulseNet({
  projectId: 'your_project_id',
  privacyBudget: 0.1, // Epsilon (ε)
  gossipInterval: 5000 // P2P sync every 5s
});

// Track page view with automatic DP noise
analytics.track('page_view', { path: window.location.pathname });
```
