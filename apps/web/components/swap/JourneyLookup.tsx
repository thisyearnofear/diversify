/**
 * JourneyLookup — the journey rail's slot for walletless visitors. The
 * same slot under the pair stage holds three states: a quiet invite
 * line, a read-only rail for a looked-up public address, and honest
 * empty/error lines. Connecting adds you — it never unlocks the world.
 */
import React, { useState } from 'react';
import { isAddress } from 'viem';
import { useWalletContext } from '../wallet/WalletProvider';
import { CapitalJourney, shortAddress } from './CapitalJourney';
import type { CapitalHistory } from '@diversifi/shared/src/services/capital-history';

export function JourneyLookup({
    lookupAddress,
    history,
    isLoading,
    error,
    onLookup,
    onInspectJourney,
}: {
    lookupAddress: string | null;
    history: CapitalHistory | null;
    isLoading: boolean;
    /** Fetch failed (502/offline) — show absence, never partial data. */
    error: boolean;
    onLookup: (address: string | null) => void;
    onInspectJourney?: () => void;
}) {
    const { connect } = useWalletContext();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');
    const [invalid, setInvalid] = useState(false);

    const submit = () => {
        const v = value.trim();
        if (!isAddress(v)) {
            setInvalid(true);
            return;
        }
        setInvalid(false);
        setOpen(false);
        onLookup(v);
    };

    const collapse = () => {
        setOpen(false);
        setInvalid(false);
        setValue('');
    };

    if (lookupAddress) {
        if (error) {
            return (
                <p className="mt-3 flex min-h-[44px] items-center gap-2 px-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Couldn&rsquo;t read that wallet right now.
                    <ClearButton onClear={() => onLookup(null)} />
                </p>
            );
        }
        if (history && history.stations.length < 2) {
            return (
                <p className="mt-3 flex min-h-[44px] items-center gap-2 px-1 text-[11px] text-gray-500 dark:text-gray-400">
                    No currency history found for {shortAddress(lookupAddress)}{' '}
                    on Celo.
                    <ClearButton onClear={() => onLookup(null)} />
                </p>
            );
        }
        if (!history) {
            return isLoading ? (
                <p className="mt-3 min-h-[44px] px-1 pt-2 text-[11px] text-gray-400 dark:text-gray-500">
                    Reading that wallet…
                </p>
            ) : null;
        }
        return (
            <CapitalJourney
                history={history}
                tokenBalances={{}}
                readOnly={{
                    address: lookupAddress,
                    onClear: () => onLookup(null),
                }}
                onInspectJourney={onInspectJourney}
            />
        );
    }

    if (open) {
        return (
            <div className="mt-3 px-1">
                <div className="flex items-center gap-2">
                    <input
                        autoFocus
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value);
                            setInvalid(false);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') collapse();
                            if (e.key === 'Enter') submit();
                        }}
                        placeholder="Paste a Celo address"
                        aria-label="Paste a Celo address"
                        aria-invalid={invalid}
                        className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-gray-200 bg-transparent px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:text-gray-200"
                    />
                    <button
                        type="button"
                        onClick={submit}
                        className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                        View
                    </button>
                    <button
                        type="button"
                        onClick={collapse}
                        className="min-h-[44px] rounded-lg px-2 text-[11px] text-gray-500 hover:underline dark:text-gray-400"
                    >
                        Cancel
                    </button>
                </div>
                {invalid && (
                    <p className="mt-1 text-[11px] text-red-500">
                        That doesn&rsquo;t look like a Celo address.
                    </p>
                )}
            </div>
        );
    }

    return (
        <p className="mt-3 flex min-h-[44px] items-center px-1 text-[11px] text-gray-500 dark:text-gray-400">
            <button
                type="button"
                onClick={() => void connect()}
                className="min-h-[44px] hover:underline"
            >
                Your own journey appears here when you connect
            </button>
            <span aria-hidden className="mx-1">
                ·
            </span>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="min-h-[44px] font-semibold text-gray-600 hover:underline dark:text-gray-300"
            >
                View any wallet →
            </button>
        </p>
    );
}

function ClearButton({ onClear }: { onClear(): void }) {
    return (
        <button
            type="button"
            onClick={onClear}
            className="min-h-[44px] font-semibold text-gray-600 underline decoration-dotted underline-offset-2 hover:text-gray-800 dark:text-gray-300"
        >
            Clear
        </button>
    );
}
