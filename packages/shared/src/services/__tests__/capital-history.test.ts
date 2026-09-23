import { describe, it, expect } from 'vitest';
import {
    deriveCapitalHistory,
    type BlockscoutTransfer,
} from '../capital-history';

const WALLET = '0xAbC0000000000000000000000000000000000001';
const OTHER = '0x00000000000000000000000000000000000000bb';

// On-chain USDm reports symbol "CUSD" — mapping is by address only.
const USDm_ADDR = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
const KESm_ADDR = '0x456a3D042C0DbD3fb53D5489D98dE8FDDee5Be16';
const EURm_ADDR = '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73';
const SPAM_ADDR = '0x0000000000000000000000000000000000000bad';

const tokenByAddress = {
    [USDm_ADDR.toLowerCase()]: 'USDm',
    [KESm_ADDR.toLowerCase()]: 'KESm',
    [EURm_ADDR.toLowerCase()]: 'EURm',
    [SPAM_ADDR.toLowerCase()]: 'SPAM',
};

const isCurrency = (s: string) => s !== 'SPAM';

function xfer(over: Partial<BlockscoutTransfer> = {}): BlockscoutTransfer {
    return {
        transaction_hash: '0xtx1',
        timestamp: '2024-01-01T00:00:00.000000Z',
        from: { hash: OTHER },
        to: { hash: WALLET },
        token: { address_hash: USDm_ADDR },
        total: { value: '1000000', decimals: '6' },
        ...over,
    };
}

const derive = (
    transfers: BlockscoutTransfer[],
    over: Record<string, unknown> = {},
) =>
    deriveCapitalHistory({
        wallet: WALLET,
        transfers,
        tokenByAddress,
        isCurrency,
        complete: true,
        now: '2026-09-23T00:00:00.000Z',
        ...over,
    });

describe('deriveCapitalHistory', () => {
    it('matches the wallet address case-insensitively', () => {
        const h = derive([
            xfer({
                from: { hash: WALLET.toLowerCase() }, // lowercase out
                to: { hash: OTHER },
                token: { address_hash: KESm_ADDR.toUpperCase().replace('0X', '0x') },
            }),
            xfer({
                to: { hash: WALLET.toLowerCase() },
                token: { address_hash: USDm_ADDR.toLowerCase() },
            }),
        ]);
        expect(h.stations.map((s) => s.symbol)).toEqual(['USDm']);
    });

    it('maps the on-chain CUSD contract to USDm by address', () => {
        const h = derive([xfer()]);
        expect(h.stations[0].symbol).toBe('USDm');
    });

    it('ignores transfers whose token is unknown or not a currency', () => {
        const h = derive([
            xfer({ token: { address_hash: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' } }),
            xfer({ token: { address_hash: SPAM_ADDR } }),
            xfer(),
        ]);
        expect(h.stations).toHaveLength(1);
        expect(h.stations[0].symbol).toBe('USDm');
    });

    it('orders stations by firstSeen and keeps first/last seen', () => {
        const h = derive([
            xfer({
                token: { address_hash: USDm_ADDR },
                timestamp: '2024-06-01T00:00:00.000000Z',
            }),
            xfer({
                token: { address_hash: KESm_ADDR },
                timestamp: '2024-03-01T00:00:00.000000Z',
                transaction_hash: '0xtx2',
            }),
            xfer({
                token: { address_hash: USDm_ADDR },
                timestamp: '2025-01-01T00:00:00.000000Z',
                transaction_hash: '0xtx3',
            }),
        ]);
        expect(h.stations.map((s) => s.symbol)).toEqual(['KESm', 'USDm']);
        expect(h.stations[1]).toMatchObject({
            firstSeen: '2024-06-01T00:00:00.000000Z',
            lastSeen: '2025-01-01T00:00:00.000000Z',
        });
    });

    it('detects a one-out/one-in swap leg in a single tx', () => {
        const h = derive([
            xfer({
                transaction_hash: '0xswap',
                from: { hash: WALLET },
                to: { hash: OTHER },
                token: { address_hash: USDm_ADDR },
                total: { value: '5000000', decimals: '6' },
            }),
            xfer({
                transaction_hash: '0xswap',
                to: { hash: WALLET },
                token: { address_hash: KESm_ADDR },
                total: { value: '645000000000000000000', decimals: '18' },
            }),
        ]);
        expect(h.legs).toHaveLength(1);
        expect(h.legs[0]).toMatchObject({
            from: 'USDm',
            to: 'KESm',
            txHash: '0xswap',
            amountIn: '5',
            amountOut: '645',
        });
    });

    it('skips multi-token txs — never guesses', () => {
        const h = derive([
            xfer({
                transaction_hash: '0xmulti',
                from: { hash: WALLET },
                to: { hash: OTHER },
                token: { address_hash: USDm_ADDR },
            }),
            xfer({
                transaction_hash: '0xmulti',
                from: { hash: WALLET },
                to: { hash: OTHER },
                token: { address_hash: EURm_ADDR },
            }),
            xfer({
                transaction_hash: '0xmulti',
                to: { hash: WALLET },
                token: { address_hash: KESm_ADDR },
            }),
        ]);
        expect(h.legs).toHaveLength(0);
    });

    it('a plain send is not a leg', () => {
        const h = derive([
            xfer({
                from: { hash: WALLET },
                to: { hash: OTHER },
            }),
        ]);
        expect(h.legs).toHaveLength(0);
        // …but it also isn't a station — nothing was received.
        expect(h.stations).toHaveLength(0);
    });

    it('keeps exact decimal precision across 6- and 18-decimal tokens', () => {
        const h = derive([
            xfer({
                transaction_hash: '0xprec',
                from: { hash: WALLET },
                to: { hash: OTHER },
                token: { address_hash: USDm_ADDR },
                total: { value: '1234567', decimals: '6' },
            }),
            xfer({
                transaction_hash: '0xprec',
                to: { hash: WALLET },
                token: { address_hash: EURm_ADDR },
                total: { value: '1234567890123456789', decimals: '18' },
            }),
        ]);
        expect(h.legs[0].amountIn).toBe('1.234567');
        expect(h.legs[0].amountOut).toBe('1.234567890123456789');
    });

    it('sums split legs within one tx', () => {
        const h = derive([
            xfer({
                transaction_hash: '0xsplit',
                from: { hash: WALLET },
                to: { hash: OTHER },
                total: { value: '3000000', decimals: '6' },
            }),
            xfer({
                transaction_hash: '0xsplit',
                from: { hash: WALLET },
                to: { hash: OTHER },
                total: { value: '2000000', decimals: '6' },
            }),
            xfer({
                transaction_hash: '0xsplit',
                to: { hash: WALLET },
                token: { address_hash: KESm_ADDR },
                total: { value: '1000000000000000000000', decimals: '18' },
            }),
        ]);
        expect(h.legs[0].amountIn).toBe('5');
    });

    it('passes complete through unchanged', () => {
        expect(derive([], { complete: false }).complete).toBe(false);
        expect(derive([], { complete: true }).complete).toBe(true);
    });
});
