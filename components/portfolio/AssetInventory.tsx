import React from 'react';
import type { TokenBalance } from '@/hooks/use-multichain-balances';

interface AssetInventoryProps {
    tokens: TokenBalance[];
    className?: string;
}

export const AssetInventory: React.FC<AssetInventoryProps> = ({ tokens, className = "" }) => {
    if (!tokens || tokens.length === 0) return null;

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-gray-900 dark:text-white text-[10px] uppercase tracking-widest">Your Portfolio</h3>
                <span className="text-[10px] font-black uppercase text-gray-400">Value</span>
            </div>

            <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {tokens.map((token, index) => (
                    <div key={`${token.symbol}-${index}`} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm hover:border-blue-200 dark:hover:border-blue-900 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="size-8 bg-white dark:bg-gray-900 rounded-lg flex items-center justify-center text-sm shadow-sm border border-gray-100 dark:border-gray-800">
                                {token.symbol.slice(0, 1)}
                            </div>
                            <div>
                                <div className="text-sm font-black text-gray-900 dark:text-white leading-none mb-1">
                                    {token.symbol}
                                </div>
                                <div className="text-[10px] text-gray-400 font-bold uppercase leading-none flex items-center gap-1">
                                    <span className="size-1 rounded-full bg-blue-500"></span>
                                    {token.chainName}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-black text-gray-900 dark:text-white leading-none mb-1">
                                {token.formattedBalance}
                            </div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold leading-none">
                                ${token.value.toFixed(2)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
