/**
 * Guardian event bus — in-process pub/sub for SSE subscribers.
 *
 * Used by `pages/api/agent/guardian-events.ts` to stream real-time
 * anchor + execution updates to the client. Producers (guardian-loop,
 * firecrawl-webhook) call `publish()` after they write to GuardianState.
 * Consumers (the SSE handler) call `subscribe(userAddress)` and receive
 * a disposer that removes their listener.
 *
 * Scope: SINGLE NODE PROCESS ONLY. The bus is a per-runtime singleton.
 * If/when the runtime is sharded to multiple Node instances, this
 * needs to be replaced with a cross-process pub/sub (Redis pub/sub,
 * NATS, etc.) — the consumer side does not need to change.
 *
 * The bus is a thin wrapper over Node's built-in `EventEmitter` and
 * exposes only what we need: a per-user address-keyed topic with
 * typed payloads.
 */

import { EventEmitter } from 'node:events';
import type { GuardianAnchorRecord } from '../vault/_guardian-state';

export type GuardianStreamEvent =
    | { type: 'hello'; address: string; capturedAt: string }
    | { type: 'anchor'; address: string; anchor: GuardianAnchorRecord }
    | { type: 'recommendation'; address: string; capturedAt: string }
    | { type: 'execution'; address: string; txHash: string; status: string };

type GuardianStreamListener = (event: GuardianStreamEvent) => void;

class GuardianEventBus {
    private readonly emitter = new EventEmitter();

    constructor() {
        // The default of 10 listeners per emitter is too low for SSE
        // when many browser tabs are connected to the same address.
        this.emitter.setMaxListeners(0);
    }

    /**
     * Subscribe to events for a specific user address. Returns a
     * disposer the caller MUST call on disconnect to avoid leaks.
     */
    subscribe(address: string, listener: GuardianStreamListener): () => void {
        const topic = this.topicFor(address);
        this.emitter.on(topic, listener);
        return () => this.emitter.off(topic, listener);
    }

    /**
     * Publish an event. Routes by address so subscribers only see
     * events for the user they care about.
     */
    publish(event: GuardianStreamEvent): void {
        this.emitter.emit(this.topicFor(event.address), event);
    }

    /**
     * Test helper: number of listeners currently subscribed to an
     * address. Exported so the SSE handler can include a diagnostic
     * header in dev. Not used in production.
     */
    listenerCount(address: string): number {
        return this.emitter.listenerCount(this.topicFor(address));
    }

    private topicFor(address: string): string {
        return `guardian:${address.trim().toLowerCase()}`;
    }
}

const globalForGuardianBus = globalThis as unknown as {
    __guardianEventBus?: GuardianEventBus;
};

/**
 * Singleton across HMR / Next.js dev mode module re-evaluations.
 */
export const guardianEventBus: GuardianEventBus =
    globalForGuardianBus.__guardianEventBus ??
    (globalForGuardianBus.__guardianEventBus = new GuardianEventBus());
