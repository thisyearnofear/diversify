import { OperationMode } from './environment.types';

/**
 * Determines the current operation mode of the application
 * 
 * Modes:
 * - production: Real 0G credentials required, no fallbacks
 * - development: Mock fallbacks allowed with explicit logging
 * - ci: CI environment that fails loudly on 0G failures
 */
export function getOperationMode(): OperationMode {
  // CI mode takes precedence
  if (process.env.CI === 'true' || process.env.NODE_ENV === 'test') {
    return 'ci';
  }
  
  // Explicit override via environment variable
  const devFallbackOverride = process.env.DIVERSIFI_DEV_FALLBACK;
  if (devFallbackOverride === 'enabled') {
    return 'development';
  }
  if (devFallbackOverride === 'disabled') {
    return 'production';
  }
  
  // Default based on NODE_ENV
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    return 'development';
  }
  
  return 'production';
}

/**
 * Checks if the application is running in CI mode
 */
export function isCIMode(): boolean {
  return getOperationMode() === 'ci';
}

/**
 * Checks if mock fallbacks are allowed
 */
export function areMockFallbacksAllowed(): boolean {
  const mode = getOperationMode();
  return mode === 'development';
}

/**
 * Checks if the system should fail loudly on 0G failures
 */
export function shouldFailLoudly(): boolean {
  const mode = getOperationMode();
  return mode === 'ci';
}

/**
 * Checks if the current environment is MiniPay (deprecated - kept for backward compatibility)
 */
export function isMiniPayEnvironment(): boolean {
  return typeof window !== 'undefined' && 
    (window as any).minipay !== undefined;
}