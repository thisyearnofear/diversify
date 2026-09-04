/**
 * Chain-agnostic trust constants — docs/design-language.md §7.
 *
 * Single source of truth for the trust surface (VerifiedEvidence). Both
 * addresses are env-overridable so a different deployment shows its own
 * facts — the trust UI must never be able to lie about where the ledger
 * or the Guardian identity lives.
 *
 * The RecommendationLedger is deployed at the same address on all 5
 * settlement networks (0G, Arbitrum, Celo, HashKey, Robinhood). We read
 * the Celo (home rail) override the same way caribbean-rail.ts does.
 */

export const LEDGER_ADDRESS =
  process.env.NEXT_PUBLIC_CELO_MAINNET_LEDGER_CONTRACT ||
  '0x3BCf7dFd68ce98880618c89A351168960724369C';

export const AGENTIC_ID_ADDRESS =
  process.env.NEXT_PUBLIC_AGENTIC_ID_CONTRACT ||
  '0x68156dbFFaE56e0b3417993c3465741917A33D60';

/** The 5 settlement networks sharing the one ledger (feed order). */
export const TRUST_CHAINS = [
  { label: '0G', color: '#1e293b' },
  { label: 'Arbitrum', color: '#28a0f0' },
  { label: 'Celo', color: '#35d07f' },
  { label: 'HashKey', color: '#ff6b35' },
  { label: 'Robinhood', color: '#ccff00' },
] as const;

/** Full EVM transaction hash — what ?verify= accepts. */
export const VERIFY_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

/** GET route that runs verifyLedgerTx (chain RPC receipt, not explorer). */
export const LEDGER_VERIFY_PATH = '/api/agent/zero-g-ledger';
