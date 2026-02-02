// Fiat On-Ramp Components
// Guardarian (primary) - no-KYC up to €700, native integration
// Mt Pelerin (fallback) - Swiss regulated, higher limits

// Primary exports - Smart network-optimized approach
export {
  UnifiedOnramp,
  SmartBuyCryptoButton,
  SmartSellCryptoButton
} from './UnifiedOnramp';

export {
  NetworkOptimizedOnramp
} from './NetworkOptimizedOnramp';

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
