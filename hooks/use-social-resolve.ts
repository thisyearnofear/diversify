/**
 * useSocialResolve - Resolve social identifiers to wallet addresses
 * 
 * Core Principles:
 * - DRY: Centralized social resolution logic
 * - MODULAR: Uses ArcAgent's resolveSocialIdentifier
 * - RESILIENT: Handles errors gracefully
 */

import { useCallback } from 'react';

export interface SocialResolveResult {
  success: boolean;
  address?: string;
  error?: string;
}

export function useSocialResolve() {
  const resolveIdentifier = useCallback(async (
    identifier: string,
    type: 'phone' | 'email' | 'twitter'
  ): Promise<string | null> => {
    try {
      const response = await fetch('/api/agent/social-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, type }),
      });

      if (!response.ok) {
        throw new Error('Resolution failed');
      }

      const data = await response.json();
      
      if (data.success && data.address) {
        return data.address;
      }
      
      return null;
    } catch (err) {
      console.error('[SocialResolve] Error:', err);
      return null;
    }
  }, []);

  const sendToContact = useCallback(async (params: {
    identifier: string;
    type: 'phone' | 'email';
    amount: string;
  }): Promise<SocialResolveResult> => {
    try {
      const response = await fetch('/api/agent/social-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Transfer failed');
      }

      const data = await response.json();
      
      return {
        success: data.success,
        address: data.resolvedAddress,
        error: data.error,
      };
    } catch (err) {
      console.error('[SocialResolve] Transfer error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Transfer failed',
      };
    }
  }, []);

  return {
    resolveIdentifier,
    sendToContact,
  };
}
