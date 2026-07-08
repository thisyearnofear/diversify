import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateApiKey } from '../enterprise-auth.service';

describe('validateApiKey', () => {
  afterEach(() => { delete process.env.ENTERPRISE_API_KEYS; });

  it('returns null when no keys configured', () => {
    delete process.env.ENTERPRISE_API_KEYS;
    expect(validateApiKey('x')).toBeNull();
  });
  it('returns tenant config for a valid key', () => {
    process.env['ENTERPRISE_API_KEYS'] = '[' + '{"key":"abc","tenantId":"acme","tier":"enterprise","rateLimit":100,"quotaUsd":5000,"audit":true}' + ']';
    const r = validateApiKey('abc');
    expect(r).not.toBeNull();
    expect(r?.tenantId).toBe('acme');
    expect(r?.rateLimit).toBe(100);
  });
  it('returns null for an unknown key', () => {
    process.env['ENTERPRISE_API_KEYS'] = '[' + '{"key":"abc","tenantId":"acme","tier":"enterprise","rateLimit":100,"quotaUsd":5000,"audit":true}' + ']';
    expect(validateApiKey('nope')).toBeNull();
  });
  it('returns null for a missing header', () => {
    process.env['ENTERPRISE_API_KEYS'] = '[' + '{"key":"abc","tenantId":"acme","tier":"enterprise","rateLimit":100,"quotaUsd":5000,"audit":true}' + ']';
    expect(validateApiKey(undefined)).toBeNull();
  });
});