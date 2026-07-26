# PulseNet

PulseNet is a privacy-first analytics engine that runs entirely in the browser. It replaces Google Analytics, Mixpanel, and Amplitude at $0 cost with zero personal data leaving the device.

## Why PulseNet?

Unlike Google Analytics, which tracks users across sites and sends individual behavioral data, PulseNet aggregates everything on-device. 
- **Zero Cookies:** We use ephemeral session storage.
- **Zero PII:** No IP addresses, no user agents, no cross-site tracking.
- **Differential Privacy:** Laplacian noise is added to aggregated data to prevent reverse-engineering of user behavior.
- **GDPR/CCPA Compliant:** Because we don't collect personal data, you don't need cookie banners.

## Setup

1. Install the SDK:
```bash
npm install pulsenet
```

2. Initialize in your app:
```javascript
import { PulseNet } from 'pulsenet';

const analytics = new PulseNet({
  endpoint: 'https://your-server.com/api/collect',
  appId: 'my-app'
});

// Track events
analytics.track('signup_click');
```

3. Run the Go server:
```bash
cd server
go run .
```

## License
AGPL-3.0 - See LICENSE file for details.
For commercial use, see COMMERCIAL_LICENSE.md.


---

## 📬 Author & Enterprise Support

Created by **Soumya Debnath**.

- 📧 **Email**: [soumyadebnath1661@gmail.com](mailto:soumyadebnath1661@gmail.com)
- 📞 **Phone / WhatsApp**: [+91 7031648617](tel:+917031648617)
- 🐙 **GitHub**: [github.com/itsoumya-d](https://github.com/itsoumya-d)

## 📄 License

AGPL-3.0 (Open Source) | [Commercial License](COMMERCIAL_LICENSE.md) available for proprietary use.

