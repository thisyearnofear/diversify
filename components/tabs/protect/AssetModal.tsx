import React from "react";
import { RWA_ASSETS } from "./RwaAssetCards";

interface AssetModalProps {
    assetSymbol: string | null;
    onClose: () => void;
    onSwap: (symbol: string) => void;
}

export default function AssetModal({
    assetSymbol,
    onClose,
    onSwap,
}: AssetModalProps) {
    if (!assetSymbol) return null;

    const asset = RWA_ASSETS.find((a) => a.symbol === assetSymbol);
    if (!asset) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-4 mb-6">
                    <div
                        className={`w-16 h-16 ${asset.bgColor} dark:bg-opacity-30 rounded-2xl flex items-center justify-center text-4xl shadow-inner`}
                    >
                        {asset.icon}
                    </div>
                    <div>
                        <h3 className="font-black text-xl text-gray-900 dark:text-gray-100">
                            {asset.symbol}
                        </h3>
                        <span
                            className={`text-xs font-black uppercase ${asset.bgColor} dark:bg-opacity-30 ${asset.textColor} dark:text-opacity-90 px-2 py-1 rounded-md`}
                        >
                            {asset.type}
                        </span>
                    </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed font-medium">
                    {asset.description}
                </p>

                <div className="mb-4">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-xs">
                            <span>✓</span>
                            <span>Open Market - No KYC Required</span>
                        </div>
                        {asset.expectedSlippage && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                Expected slippage: ~{asset.expectedSlippage}
                            </p>
                        )}
                    </div>
                </div>

                {asset.yieldTooltip && (
                    <div className="mb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                            <div className="flex items-start gap-2">
                                <span className="text-blue-500 mt-0.5">💡</span>
                                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                    {asset.yieldTooltip}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-3 mb-8">
                    {asset.benefits.map((benefit, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5 font-bold"
                        >
                            <span className="text-green-500 text-lg">✓</span>
                            <span>{benefit}</span>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => {
                            onClose();
                            onSwap(asset.symbol);
                        }}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30"
                    >
                        Get {asset.symbol}
                    </button>
                </div>
            </div>
        </div>
    );
}
