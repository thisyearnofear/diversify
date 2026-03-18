/**
 * SocialContactPicker - Send USDC to contacts via phone/email
 * 
 * Core Principles:
 * - MINIMAL: Clean, focused UI
 * - MODULAR: Uses ArcAgent's resolveSocialIdentifier
 * - INTEGRATED: Celo SocialConnect integration
 */

import React, { useState } from 'react';

export interface SocialContact {
  identifier: string;
  type: 'phone' | 'email';
  name?: string;
}

interface SocialContactPickerProps {
  onSelect: (contact: SocialContact) => void;
  onResolve: (identifier: string, type: 'phone' | 'email') => Promise<string | null>;
  amount?: string;
  disabled?: boolean;
}

export function SocialContactPicker({ onSelect, onResolve, amount, disabled }: SocialContactPickerProps) {
  const [identifier, setIdentifier] = useState('');
  const [type, setType] = useState<'phone' | 'email'>('email');
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async () => {
    if (!identifier.trim()) return;
    
    setIsResolving(true);
    setError(null);
    setResolvedAddress(null);

    try {
      const address = await onResolve(identifier.trim(), type);
      if (address) {
        setResolvedAddress(address);
        onSelect({ identifier: identifier.trim(), type });
      } else {
        setError('No wallet found for this contact');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolution failed');
    } finally {
      setIsResolving(false);
    }
  };

  const formatIdentifier = (value: string, contactType: 'phone' | 'email'): string => {
    if (contactType === 'phone') {
      // Basic phone formatting
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
    return value;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">👥</span>
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Send to Contact
        </span>
      </div>

      {/* Type Toggle */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
        <button
          onClick={() => { setType('email'); setIdentifier(''); setError(null); setResolvedAddress(null); }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            type === 'email' 
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          📧 Email
        </button>
        <button
          onClick={() => { setType('phone'); setIdentifier(''); setError(null); setResolvedAddress(null); }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            type === 'phone' 
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          📱 Phone
        </button>
      </div>

      {/* Input */}
      <div className="relative">
        <input
          type={type === 'email' ? 'email' : 'tel'}
          value={identifier}
          onChange={(e) => setIdentifier(formatIdentifier(e.target.value, type))}
          placeholder={type === 'email' ? 'friend@example.com' : '(555) 123-4567'}
          disabled={disabled || isResolving}
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
        />
        {type === 'phone' && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            +1
          </span>
        )}
      </div>

      {/* Resolve Button */}
      <button
        onClick={handleResolve}
        disabled={!identifier.trim() || disabled || isResolving}
        className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isResolving ? (
          <>
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Looking up...
          </>
        ) : (
          <>🔍 Find Wallet</>
        )}
      </button>

      {/* Resolved Address */}
      {resolvedAddress && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-emerald-500">✓</span>
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Wallet Found
            </span>
          </div>
          <code className="text-xs text-emerald-600 dark:text-emerald-400 break-all">
            {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}
          </code>
          {amount && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              Ready to send {amount} USDC
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs p-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Celo Branding */}
      <p className="text-xs text-gray-400 text-center">
        Powered by <span className="text-green-500 font-medium">Celo SocialConnect</span>
      </p>
    </div>
  );
}
