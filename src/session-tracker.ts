// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com

export class SessionTracker {
  private sessionId: string;
  private startTime: number;
  private pageCount: number = 0;
  private lastActivity: number;
  private INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor() {
    const stored = this.getStoredSession();
    const now = Date.now();
    
    if (stored && (now - stored.lastActivity < this.INACTIVITY_TIMEOUT)) {
      this.sessionId = stored.id;
      this.startTime = stored.start;
      this.pageCount = stored.pageCount;
      this.lastActivity = now;
    } else {
      this.sessionId = this.generateId();
      this.startTime = now;
      this.lastActivity = now;
      this.pageCount = 0;
    }
    
    this.saveSession();
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private getStoredSession() {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const data = sessionStorage.getItem('pulsenet_session');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  private saveSession() {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem('pulsenet_session', JSON.stringify({
        id: this.sessionId,
        start: this.startTime,
        lastActivity: this.lastActivity,
        pageCount: this.pageCount
      }));
    } catch (e) {
      // ignore
    }
  }

  recordActivity() {
    this.lastActivity = Date.now();
    this.saveSession();
  }

  recordPageView() {
    this.pageCount++;
    this.recordActivity();
  }

  getSessionStats() {
    return {
      durationSec: Math.floor((this.lastActivity - this.startTime) / 1000),
      pageCount: this.pageCount
    };
  }
}
