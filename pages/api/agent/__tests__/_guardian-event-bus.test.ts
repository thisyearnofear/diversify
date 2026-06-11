/**
 * Tests for the in-process Guardian event bus.
 *
 * The bus is a thin singleton wrapper over Node's EventEmitter. The
 * point of the test is to lock the per-user routing contract: a
 * subscriber for address A never sees events for address B.
 */

import { describe, it, expect, vi } from 'vitest';
import { guardianEventBus } from '../_guardian-event-bus';

describe('guardianEventBus', () => {
    it('routes events to subscribers of the same address only', () => {
        const aliceListener = vi.fn();
        const bobListener = vi.fn();

        const offAlice = guardianEventBus.subscribe(
            '0x' + '11'.repeat(20),
            aliceListener,
        );
        const offBob = guardianEventBus.subscribe(
            '0x' + '22'.repeat(20),
            bobListener,
        );

        try {
            guardianEventBus.publish({
                type: 'execution',
                address: '0x' + '11'.repeat(20),
                txHash: '0xabc',
                status: 'confirmed',
            });

            expect(aliceListener).toHaveBeenCalledTimes(1);
            expect(bobListener).not.toHaveBeenCalled();
        } finally {
            offAlice();
            offBob();
        }
    });

    it('normalizes address casing (subscribe and publish both lowercase)', () => {
        const listener = vi.fn();
        const off = guardianEventBus.subscribe(
            '0x' + 'AA'.repeat(20),
            listener,
        );

        try {
            guardianEventBus.publish({
                type: 'execution',
                address: '0x' + 'aa'.repeat(20),
                txHash: '0xabc',
                status: 'confirmed',
            });
            expect(listener).toHaveBeenCalledTimes(1);
        } finally {
            off();
        }
    });

    it('unsubscribe stops further events', () => {
        const listener = vi.fn();
        const off = guardianEventBus.subscribe(
            '0x' + '33'.repeat(20),
            listener,
        );

        guardianEventBus.publish({
            type: 'execution',
            address: '0x' + '33'.repeat(20),
            txHash: '0xabc',
            status: 'confirmed',
        });
        expect(listener).toHaveBeenCalledTimes(1);

        off();

        guardianEventBus.publish({
            type: 'execution',
            address: '0x' + '33'.repeat(20),
            txHash: '0xdef',
            status: 'confirmed',
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('listenerCount reflects active subscribers', () => {
        const address = '0x' + '44'.repeat(20);
        const off1 = guardianEventBus.subscribe(address, () => {});
        expect(guardianEventBus.listenerCount(address)).toBe(1);
        const off2 = guardianEventBus.subscribe(address, () => {});
        expect(guardianEventBus.listenerCount(address)).toBe(2);
        off1();
        expect(guardianEventBus.listenerCount(address)).toBe(1);
        off2();
        expect(guardianEventBus.listenerCount(address)).toBe(0);
    });
});
