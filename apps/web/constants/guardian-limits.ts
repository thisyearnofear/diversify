/**
 * Guardian limit constants — one source for the setup modal, the Limits &
 * controls sheet, the journal copy and the instrument hook. Kept free of
 * React/wallet imports so any surface (and its tests) can read them.
 */

import { GUARDIAN_LIMIT_CHAIN_IDS } from '@diversifi/shared/src/config/chain-capabilities';

/** Below this stable balance Guardian has nothing to propose with. */
export const MIN_AUTO_SAVER_FUNDS_USD = 5;

export const CELO_CHAIN_ID = 42220;
export const ARBITRUM_CHAIN_ID = 42161;

/** Chains where a daily limit can be signed (Celo, Celo Sepolia, Arbitrum) —
 *  from the chain-capability matrix (was a hand list naming retired Alfajores). */
export const SUPPORTED_AUTO_SAVER_CHAINS: readonly number[] = GUARDIAN_LIMIT_CHAIN_IDS;

/** Daily-limit chips, smallest first — "start small" is the default posture. */
export const DAILY_LIMIT_PRESETS = [5, 10, 25, 50, 100] as const;
export const DEFAULT_DAILY_LIMIT_USD = 10;
