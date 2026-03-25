/**
 * Smart Account Provider Registry
 *
 * Registers all available providers and provides the factory.
 * Import this file to ensure providers are registered before use.
 *
 * Configuration via env:
 *   SMART_ACCOUNT_PROVIDER=privy       → Privy Safe (production default)
 *   SMART_ACCOUNT_PROVIDER=safe4337    → Generic Safe + any signer (self-hosted)
 */

import { registerProvider } from '../smart-account-provider';
import { PrivySafeProvider } from './privy-safe-provider';
import { Safe4337Provider } from './safe-4337-provider';

// Register all providers
registerProvider('privy', () => new PrivySafeProvider());
registerProvider('safe4337', () => new Safe4337Provider());
