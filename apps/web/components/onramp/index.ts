// Fiat On-Ramp Components
// Mt Pelerin (default) - embedded widget, prefills address + chain
// Guardarian (selectable) - outbound link stub until a partner
// integration lands; their no-KYC tier is up to €700

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
