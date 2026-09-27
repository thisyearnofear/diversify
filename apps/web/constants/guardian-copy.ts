/**
 * User-facing Guardian copy — single agent identity.
 *
 * Vocabulary (docs/product.md § Vocabulary): Guardian is the only agent
 * name; Shield / Home / Exchange / Guardian / Learn are the only tab names;
 * "Protection plan" is the only plan noun. Internal services may still say
 * "advisor"/"agent"/"strategy"; UI must not. Tripwire:
 * apps/web/lib/__tests__/vocabulary.test.ts.
 */

export const GUARDIAN_PRODUCT_NAME = 'Guardian';

export const ASK_GUARDIAN_LABEL = 'Ask Guardian';

export const GUARDIAN_TAB_LABEL = 'Guardian';

export const GUARDIAN_DRAWER_SUBTITLE = 'Your protection companion';

/** The permission Guardian runs under. Proposal-only: you approve each move. */
export const DAILY_LIMIT_LABEL = 'Daily limit';

/** Optional ERC-7715 grant — the wallet enforces the same cap on-chain. */
export const WALLET_ENFORCED_LIMIT_LABEL = 'Wallet-enforced limit';

export const PROTECTION_PLAN_LABEL = 'Protection plan';

export const GUARDIAN_TIMELINE_LABEL = 'Guardian timeline';

export const GUARDIAN_UPDATES_LABEL = 'Guardian updates';

/** Drawer is for explanation — not the primary agent surface. */
export const GUARDIAN_DRAWER_PROMPTS = [
  'Why is my currency exposed?',
  'Explain this recommendation',
  'Review my protection plan',
  'What would happen if I enabled Guardian?',
  'Show me the evidence',
] as const;
