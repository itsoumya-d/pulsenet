// Copyright (c) 2024-2026 Soumya Debnath. All Rights Reserved.
// Licensed under the Business Source License 1.1 (BSL 1.1).
// See LICENSE file for details. Production use requires a paid license.
// Contact: soumyadebnath1661@gmail.com | +91 7031648617

import { addLaplaceNoise } from './privacy';

export interface AggregateData {
  pageViews: number;
  events: number;
  avgTiming: number;
}

export interface GossipMessage {
  type: 'aggregate';
  data: AggregateData;
  contributorCount: number;
}

export class FederatedAggregator {
  private localAggregate: AggregateData = { pageViews: 0, events: 0, avgTiming: 0 };
  private globalAggregate: AggregateData = { pageViews: 0, events: 0, avgTiming: 0 };
  private contributorCount: number = 1;
  private peers: Set<RTCDataChannel> = new Set();
  private eventTarget = new EventTarget();

  public updateLocal(data: Partial<AggregateData>) {
    if (data.pageViews) this.localAggregate.pageViews += data.pageViews;
    if (data.events) this.localAggregate.events += data.events;
    if (data.avgTiming) {
      if (this.localAggregate.avgTiming === 0) {
        this.localAggregate.avgTiming = data.avgTiming;
      } else {
        this.localAggregate.avgTiming = (this.localAggregate.avgTiming + data.avgTiming) / 2;
      }
    }
    this.recomputeGlobal();
  }

  private recomputeGlobal() {
    this.globalAggregate = { ...this.localAggregate };
    this.contributorCount = 1;
  }

  public getGlobalAggregate(): AggregateData {
    return { ...this.globalAggregate };
  }

  public on(event: 'aggregateUpdated', callback: () => void) {
    this.eventTarget.addEventListener(event, callback);
  }

  public connect(signalingUrl: string, channelId: string) {
    if (typeof WebSocket === 'undefined') {
      console.warn('PulseNet: WebSocket not available, P2P aggregation disabled');
      return;
    }
    const ws = new WebSocket(signalingUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', channelId }));
    };
    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'peer_channel') {
          // Peer channels are added externally via addPeer()
          // This is a signal that a peer is available
          this.eventTarget.dispatchEvent(new CustomEvent('peerAvailable', { detail: msg.peerId }));
        }
      } catch {}
    };
    ws.onclose = () => {
      // Auto-reconnect after 5 seconds
      setTimeout(() => this.connect(signalingUrl, channelId), 5000);
    };
  }

  public onPeerAvailable(callback: (peerId: string) => void) {
    this.eventTarget.addEventListener('peerAvailable', ((e: CustomEvent) => callback(e.detail)) as EventListener);
  }

  public shareLocalAggregates(epsilon: number = 1.0, sensitivity: number = 1.0) {
    const noisedData: AggregateData = {
      pageViews: addLaplaceNoise(this.localAggregate.pageViews, sensitivity, epsilon),
      events: addLaplaceNoise(this.localAggregate.events, sensitivity, epsilon),
      avgTiming: addLaplaceNoise(this.localAggregate.avgTiming, sensitivity, epsilon * 10),
    };
    
    const message: GossipMessage = {
      type: 'aggregate',
      data: noisedData,
      contributorCount: 1,
    };
    
    const msgStr = JSON.stringify(message);
    this.peers.forEach(peer => {
      if (peer.readyState === 'open') {
        peer.send(msgStr);
      }
    });
  }

  public receivePeerData(peerMessage: GossipMessage) {
    if (peerMessage.type !== 'aggregate') return;

    const remote = peerMessage.data;
    const remoteCount = peerMessage.contributorCount;
    const totalCount = this.contributorCount + remoteCount;

    this.globalAggregate.pageViews = 
      ((this.globalAggregate.pageViews * this.contributorCount) + (remote.pageViews * remoteCount)) / totalCount;
    
    this.globalAggregate.events = 
      ((this.globalAggregate.events * this.contributorCount) + (remote.events * remoteCount)) / totalCount;

    this.globalAggregate.avgTiming = 
      ((this.globalAggregate.avgTiming * this.contributorCount) + (remote.avgTiming * remoteCount)) / totalCount;

    this.contributorCount = totalCount;
    this.eventTarget.dispatchEvent(new Event('aggregateUpdated'));
  }

  public addPeer(channel: RTCDataChannel) {
    this.peers.add(channel);
    channel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as GossipMessage;
        this.receivePeerData(msg);
      } catch (err) {
        console.error('Failed to parse peer message', err);
      }
    };
    channel.onclose = () => {
      this.peers.delete(channel);
    };
  }
}
