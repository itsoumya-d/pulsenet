// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com

import type { PulseNet } from './pulsenet';

export function setupAutoTrack(pulsenet: PulseNet) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Auto track page views on History API changes (SPA support)
  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    pulsenet.pageView();
  };

  window.addEventListener('popstate', () => {
    pulsenet.pageView();
  });

  // Track initial page load performance
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (window.performance && window.performance.getEntriesByType) {
        const navEntries = window.performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          const navEntry = navEntries[0] as PerformanceNavigationTiming;
          pulsenet.timing('performance', 'page_load', navEntry.loadEventEnd - navEntry.startTime);
        }
      }
    }, 0);
  });
}
