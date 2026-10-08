interface PulseNetOptions {
    endpoint: string;
    appId: string;
    flushInterval?: number;
    debug?: boolean;
}
/** Cumulative per-instance outcomes. Beacon acceptance is not delivery proof. */
interface DeliveryStatus {
    pendingPayloads: number;
    acknowledgedPayloads: number;
    beaconQueuedPayloads: number;
    droppedPayloads: number;
}

declare class PulseNet {
    private options;
    private aggregator;
    private sessionTracker;
    private transport;
    private timer;
    private enabled;
    private pending;
    private draining?;
    private acknowledgedPayloads;
    private beaconQueuedPayloads;
    private droppedPayloads;
    private boundVisibilityHandler;
    private boundPagehideHandler;
    constructor(options?: any);
    enable(): void;
    disable(): void;
    track(event: string, properties?: Record<string, any>): void;
    pageView(path?: string): void;
    timing(category: string, variable: string, durationMs: number): void;
    flush(): Promise<void>;
    getDeliveryStatus(): DeliveryStatus;
    private enqueueAndFlush;
    private drain;
    destroy(): void;
}

interface AggregateData {
    pageViews: number;
    events: number;
    avgTiming: number;
}
interface GossipMessage {
    type: 'aggregate';
    data: AggregateData;
    contributorCount: number;
}
declare class FederatedAggregator {
    private localAggregate;
    private globalAggregate;
    private contributorCount;
    private peers;
    private eventTarget;
    updateLocal(data: Partial<AggregateData>): void;
    private recomputeGlobal;
    getGlobalAggregate(): AggregateData;
    on(event: 'aggregateUpdated', callback: () => void): void;
    connect(signalingUrl: string, channelId: string): void;
    onPeerAvailable(callback: (peerId: string) => void): void;
    shareLocalAggregates(epsilon?: number, sensitivity?: number): void;
    receivePeerData(peerMessage: GossipMessage): void;
    addPeer(channel: RTCDataChannel): void;
}

export { type DeliveryStatus, FederatedAggregator, PulseNet, type PulseNetOptions };
