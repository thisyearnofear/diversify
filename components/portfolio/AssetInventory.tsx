import React, { useState } from 'react';
import type { TokenBalance } from '@/hooks/use-multichain-balances';
import { classifyAssets, getPeerBracket } from './asset-classification';
import { usePeerStableRatio } from '@/hooks/use-peer-stable-ratio';

interface AssetInventoryProps {
    tokens: TokenBalance[];
    className?: string;
    showPaperToggle?: boolean;
}

export const AssetInventory: React.FC<AssetInventoryProps> = ({
    tokens,
    className = "",
}) => {
    if (!tokens || tokens.length === 0) return null;

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="font-black text-gray-900 dark:text-white text-xs uppercase tracking-widest">
                        Your Portfolio
                    </h3>
                </div>
                <span className="text-xs font-black uppercase text-gray-400">Value</span>
            </div>

            <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                <GroupedAssetList tokens={tokens} />
            </div>

            {/* Social proof (real portfolio only, when there is something to compare) */}
            {tokens.length > 0 && (
                <SocialProofLine tokens={tokens} />
            )}
        </div>
    );
};

/**
 * Renders the real portfolio split into "Tracked" (counts toward
 * protection score) and "Other" (shown for transparency only). Each
 * section has a divider header with the group's total value.
 */
const GroupedAssetList: React.FC<{ tokens: TokenBalance[] }> = ({ tokens }) => {
    const { tracked, other, trackedValue, otherValue, totalValue } = classifyAssets(tokens);
    const onlyOther = tracked.length === 0 && other.length > 0;
    const onlyTracked = other.length === 0 && tracked.length > 0;

    const renderRow = (token: TokenBalance, index: number) => (
        <div
            key={`${token.symbol}-${index}`}
            className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl shadow-md hover:shadow-lg transition-all"
        >
            <div className="flex items-center gap-3">
                <div className="size-8 bg-white dark:bg-gray-900 rounded-xl flex items-center justify-center text-sm shadow-md">
                    {token.symbol.slice(0, 1)}
                </div>
                <div>
                    <div className="text-sm font-black text-gray-900 dark:text-white leading-none mb-1">
                        {token.symbol}
                    </div>
                    <div className="text-xs text-gray-400 font-bold uppercase leading-none flex items-center gap-1">
                        <span className="size-1 rounded-full bg-blue-500"></span>
                        {token.chainName}
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="text-sm font-black text-gray-900 dark:text-white leading-none mb-1">
                    {token.formattedBalance}
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold leading-none">
                    ${token.value.toFixed(2)}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-3">
            {!onlyOther && (
                <AssetGroupSection
                    label="Tracked"
                    sublabel="Counts toward your protection score"
                    count={tracked.length}
                    value={trackedValue}
                    tone="tracked"
                >
                    {tracked.map((t, i) => renderRow(t, i))}
                </AssetGroupSection>
            )}
            {!onlyTracked && (
                <AssetGroupSection
                    label={onlyOther ? "Other tokens" : "Other"}
                    sublabel="Not counted in your protection score"
                    count={other.length}
                    value={otherValue}
                    tone="other"
                    showNotCountedHint={onlyOther}
                >
                    {other.map((t, i) => renderRow(t, i))}
                </AssetGroupSection>
            )}
            {totalValue === 0 && null}
        </div>
    );
};

const AssetGroupSection: React.FC<{
    label: string;
    sublabel: string;
    count: number;
    value: number;
    tone: "tracked" | "other";
    showNotCountedHint?: boolean;
    children: React.ReactNode;
}> = ({ label, sublabel, count, value, tone, showNotCountedHint, children }) => {
    const accentDot = tone === "tracked" ? "bg-emerald-500" : "bg-amber-400";
    const labelColor =
        tone === "tracked"
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-amber-700 dark:text-amber-300";
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <span className={`size-1.5 rounded-full ${accentDot}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${labelColor}`}>
                        {label} · {count}
                    </span>
                    {showNotCountedHint && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 normal-case tracking-normal">
                            (not counted in score)
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 tabular-nums">
                    ${value.toFixed(2)}
                </span>
            </div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 px-1 -mt-0.5">
                {sublabel}
            </div>
            <div className="space-y-1.5 pt-0.5">{children}</div>
        </div>
    );
};

/**
 * One-line peer comparison: "You're in the top 30% of protectors..."
 * Hidden when there's nothing to compare (empty wallet, demo, paper view).
 *
 * Fetches bracket definitions from /api/metrics/peer-stable-ratio on mount
 * and falls back to hardcoded constants if the API is unreachable. The
 * API data is cached server-side for 1 hour, so this is a lightweight
 * background fetch — no loading state needed for a cosmetic line.
 */
const SocialProofLine: React.FC<{ tokens: TokenBalance[] }> = ({ tokens }) => {
    const { trackedValue, totalValue } = classifyAssets(tokens);
    const { brackets } = usePeerStableRatio();
    if (totalValue <= 0) return null;
    const ratio = trackedValue / totalValue;
    const bracket = getPeerBracket(ratio, brackets);
    if (!bracket) return null;
    return (
        <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed text-center">
                {bracket.copy}
            </p>
        </div>
    );
};
