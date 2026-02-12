/**
 * Backward-compatible wallet provider exports.
 * Wallet internals now live in modules/wallet for cleaner separation of concerns.
 */

export {
  getWalletEnvironment,
  getWalletProvider,
  isFarcasterProvider,
  isWalletProviderAvailable,
  resetWalletProviderCache,
  setupWalletEventListenersForProvider,
} from '../modules/wallet/core/provider-registry';
