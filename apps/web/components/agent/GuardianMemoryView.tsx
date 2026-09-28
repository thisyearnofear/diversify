/**
 * GuardianMemoryView — the memory surface inside the Ask Guardian drawer.
 *
 * In-drawer view swap ("← Chat" returns) — modes transform, never append.
 * Three modes: Off (default) / This device / Across devices; the last picks
 * a named provider and its storage location, consent-gated on a wallet
 * signature. Facts are user-stated lines only — never transcripts — each
 * with a delete control and a forget-everything escape.
 */

import React, { useEffect, useRef, useState } from 'react';
import type {
  GuardianFact,
  GuardianMemoryMode,
  GuardianMemoryProviderId,
} from '@/lib/guardian-memory';
import type { GuardianMemoryProviderInfo } from '@/hooks/use-guardian-memory';

const MODE_OPTIONS: Array<{ id: GuardianMemoryMode; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'device', label: 'This device' },
  { id: 'cloud', label: 'Across devices' },
];

const MODE_DESCRIPTIONS: Record<GuardianMemoryMode, string> = {
  off: 'Nothing is stored. Every conversation starts fresh.',
  device: 'Stored only in this browser.',
  cloud: 'Stored under your wallet with the provider you choose.',
};

interface Props {
  pref: { mode: GuardianMemoryMode; provider?: GuardianMemoryProviderId };
  providers: GuardianMemoryProviderInfo[] | null;
  facts: GuardianFact[];
  cloudNeedsAuth: boolean;
  /** Wallet connected — cloud mode exists only with a wallet to sign for. */
  walletConnected: boolean;
  onBack: () => void;
  /** false when the cloud signature was declined. */
  chooseMode: (mode: GuardianMemoryMode, provider?: GuardianMemoryProviderId) => Promise<boolean>;
  deleteFact: (fact: { id: string }) => Promise<void>;
  forgetAll: () => Promise<boolean>;
}

export function GuardianMemoryView({
  pref,
  providers,
  facts,
  cloudNeedsAuth,
  walletConnected,
  onBack,
  chooseMode,
  deleteFact,
  forgetAll,
}: Props) {
  const options = walletConnected ? MODE_OPTIONS : MODE_OPTIONS.filter((o) => o.id !== 'cloud');
  // The mode the user has selected in this view. Selecting "Across devices"
  // doesn't commit until a provider's signature lands — so we track a draft
  // and revert to `pref.mode` when the signature is declined.
  const [draftMode, setDraftMode] = useState<GuardianMemoryMode>(pref.mode);
  const [confirmOffDelete, setConfirmOffDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftMode(pref.mode);
  }, [pref.mode]);

  const choose = async (mode: GuardianMemoryMode, provider?: GuardianMemoryProviderId) => {
    if (pending) return;
    setPending(true);
    try {
      if (mode === 'off' && facts.length > 0) {
        // Leaving memory behind while facts exist asks inline — never a modal.
        setConfirmOffDelete(true);
        setDraftMode('off');
        return;
      }
      if (mode === 'cloud' && !provider) {
        // Selecting "Across devices" only reveals the provider list — the
        // consent signature happens when a provider row is picked.
        setDraftMode('cloud');
        return;
      }
      const ok = await chooseMode(mode, provider);
      if (ok) {
        setDraftMode(mode);
        setConfirmOffDelete(false);
      } else {
        setDraftMode(pref.mode);
      }
    } finally {
      setPending(false);
    }
  };

  const confirmOff = async (deleteFacts: boolean) => {
    setPending(true);
    try {
      if (deleteFacts) await forgetAll();
      const ok = await chooseMode('off');
      if (ok) {
        setDraftMode('off');
        setConfirmOffDelete(false);
      } else {
        setDraftMode(pref.mode);
      }
    } finally {
      setPending(false);
    }
  };

  const focusOption = (index: number) => {
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [index]?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = options.findIndex((o) => o.id === draftMode);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % options.length;
      void choose(options[next].id, draftMode === 'cloud' ? pref.provider : undefined);
      focusOption(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (index - 1 + options.length) % options.length;
      void choose(options[next].id, draftMode === 'cloud' ? pref.provider : undefined);
      focusOption(next);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="guardian-memory-view">
      <button
        type="button"
        onClick={onBack}
        className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        ← Chat
      </button>

      <div>
        <div
          ref={groupRef}
          role="radiogroup"
          aria-label="Guardian memory"
          className={`grid ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-1 rounded-full bg-gray-100 dark:bg-gray-800 p-1`}
          onKeyDown={onKeyDown}
        >
          {options.map((opt) => {
            const isSelected = draftMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                disabled={pending}
                onClick={() => void choose(opt.id, opt.id === 'cloud' ? pref.provider : undefined)}
                className={`min-h-tap px-2 rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                  isSelected
                    ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p aria-live="polite" className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          {MODE_DESCRIPTIONS[draftMode]}
        </p>
      </div>

      {draftMode === 'cloud' && (
        <div role="radiogroup" aria-label="Memory provider" className="space-y-1.5">
          {(providers ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={pref.mode === 'cloud' && pref.provider === p.id}
              disabled={!p.available || pending}
              onClick={() => void choose('cloud', p.id)}
              className={`w-full min-h-tap px-3 py-2 rounded-xl border text-left text-xs transition-colors ${
                pref.mode === 'cloud' && pref.provider === p.id
                  ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-white'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="font-bold">{p.location.split(' — ')[0]}</span>
              <span className="block text-2xs text-gray-500 dark:text-gray-400">
                {p.available
                  ? p.location.split(' — ')[1] ?? p.location
                  : p.reason === 'unreachable'
                    ? 'Unavailable right now'
                    : 'Not set up yet'}
              </span>
            </button>
          ))}
          {providers === null && (
            <p className="text-2xs text-gray-400">Checking available providers…</p>
          )}
          {providers !== null && providers.length === 0 && (
            <p className="text-2xs text-gray-400">No memory providers are set up yet.</p>
          )}
        </div>
      )}

      {pref.mode !== draftMode && pref.mode !== 'off' && draftMode !== 'off' ? (
        <p className="text-2xs text-gray-400">
          Facts do not move between stores automatically.
        </p>
      ) : null}

      {confirmOff && (
        <div
          role="group"
          aria-label="Delete remembered facts?"
          className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
        >
          Also delete what Guardian remembers?
          <span className="inline-flex gap-3 ml-2">
            <button
              type="button"
              onClick={() => void confirmOff(true)}
              className="font-bold underline underline-offset-2"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => void confirmOff(false)}
              className="font-bold underline underline-offset-2"
            >
              Keep
            </button>
          </span>
        </div>
      )}

      {draftMode !== 'off' && (
        <div className="space-y-1">
          <p className="text-3xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
            What Guardian remembers
          </p>
          {cloudNeedsAuth ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sign your wallet session to see facts stored across devices.
            </p>
          ) : facts.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Nothing yet.</p>
          ) : (
            <ul className="space-y-1">
              {facts.map((fact) => (
                <li
                  key={fact.id}
                  className="flex items-start justify-between gap-2 text-xs text-gray-700 dark:text-gray-300"
                >
                  <span>{fact.text}</span>
                  <button
                    type="button"
                    aria-label={`Delete: ${fact.text}`}
                    onClick={() => void deleteFact(fact)}
                    className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {facts.length > 0 && (
            <button
              type="button"
              onClick={() => void forgetAll()}
              className="text-2xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2"
            >
              Forget everything
            </button>
          )}
        </div>
      )}
    </div>
  );
}
