// Fiat On-Ramp Components
// Mt Pelerin (default) - embedded widget, prefills address + chain,
//   no credentials required
// Guardarian - real partner integration via /api/onramp/guardarian-url:
//   RSA-signed Calculator v2 widget (embedded) or a payments checkout
//   link, both prefilled with the intent's asset/amount/address.
//   Offered only when NEXT_PUBLIC_GUARDARIAN_PARTNER_ID is set.

// Primary exports - Smart network-optimized approach
export {
  UnifiedOnramp,
  SmartBuyCryptoButton,
  SmartSellCryptoButton
} from './UnifiedOnramp';

// Guardarian direct exports
export {
  GuardarianOnramp,
  BuyCryptoButtonGuardarian,
  SellCryptoButtonGuardarian
} from './GuardarianOnramp';

// Mt Pelerin direct exports (legacy/fallback)
export {
  MtPelerinOnramp,
  BuyCryptoButton,
  SellCryptoButton,
  MtPelerinWidget
} from './MtPelerinOnramp';

// Type exports
export type { UnifiedOnrampProps } from './UnifiedOnramp';
export type { GuardarianOnrampProps } from './GuardarianOnramp';
export type { MtPelerinOnrampProps } from './MtPelerinOnramp';
