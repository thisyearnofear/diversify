import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOperationMode,
  areMockFallbacksAllowed,
  shouldFailLoudly,
  getZeroGStorageSignerKey,
} from '../environment';

describe('environment utils', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getZeroGStorageSignerKey', () => {
    it('prefers VAULT_PRIVATE_KEY when both are set', () => {
      vi.stubEnv('VAULT_PRIVATE_KEY', 'vault-key');
      vi.stubEnv('LEDGER_PRIVATE_KEY', 'ledger-key');
      expect(getZeroGStorageSignerKey()).toBe('vault-key');
    });

    it('falls back to LEDGER_PRIVATE_KEY when VAULT_PRIVATE_KEY is unset', () => {
      vi.stubEnv('VAULT_PRIVATE_KEY', '');
      vi.stubEnv('LEDGER_PRIVATE_KEY', 'ledger-key');
      expect(getZeroGStorageSignerKey()).toBe('ledger-key');
    });

    it('returns a falsy value when neither is set', () => {
      vi.stubEnv('VAULT_PRIVATE_KEY', '');
      vi.stubEnv('LEDGER_PRIVATE_KEY', '');
      // Callers check falsiness (`if (!privateKey)`), so an empty string
      // and undefined are equivalent for this contract.
      expect(getZeroGStorageSignerKey()).toBeFalsy();
    });
  });

  describe('getOperationMode / areMockFallbacksAllowed / shouldFailLoudly', () => {
    it('returns ci when CI=true regardless of NODE_ENV', () => {
      vi.stubEnv('CI', 'true');
      vi.stubEnv('NODE_ENV', 'production');
      expect(getOperationMode()).toBe('ci');
      expect(shouldFailLoudly()).toBe(true);
      expect(areMockFallbacksAllowed()).toBe(false);
    });

    it('DIVERSIFI_DEV_FALLBACK=enabled overrides to development', () => {
      vi.stubEnv('CI', '');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DIVERSIFI_DEV_FALLBACK', 'enabled');
      expect(getOperationMode()).toBe('development');
      expect(areMockFallbacksAllowed()).toBe(true);
    });

    it('DIVERSIFI_DEV_FALLBACK=disabled overrides to production', () => {
      vi.stubEnv('CI', '');
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('DIVERSIFI_DEV_FALLBACK', 'disabled');
      expect(getOperationMode()).toBe('production');
      expect(areMockFallbacksAllowed()).toBe(false);
    });

    it('defaults to development when NODE_ENV is unset', () => {
      vi.stubEnv('CI', '');
      vi.stubEnv('NODE_ENV', '');
      vi.stubEnv('DIVERSIFI_DEV_FALLBACK', '');
      expect(getOperationMode()).toBe('development');
      expect(areMockFallbacksAllowed()).toBe(true);
    });

    it('returns production for a real production NODE_ENV', () => {
      vi.stubEnv('CI', '');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DIVERSIFI_DEV_FALLBACK', '');
      expect(getOperationMode()).toBe('production');
      expect(areMockFallbacksAllowed()).toBe(false);
      expect(shouldFailLoudly()).toBe(false);
    });
  });
});
