import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletContext } from "../wallet/WalletProvider";
import { OnrampModal } from "./OnrampModal";

export interface GuardarianOnrampProps {
    mode?: "buy" | "sell";
    className?: string;
    compact?: boolean;
    variant?: "default" | "white" | "outline";
    defaultAmount?: string;
    /** Intent fields — same contract as MtPelerinOnramp. The API route
     *  maps the needed asset to a Guardarian ticker/network and sizes the
     *  prefill to the real gap, never a generic amount. */
    neededAsset?: string;
    neededAmountUsd?: number;
    onBuyStarted?: () => void;
}

const GUARD_BRAND = {
    icon: "⚡",
    name: "Guardarian",
    tagline: "Card & bank ramp",
    badge: "No KYC up to €700",
    infoUrl: "https://guardarian.com",
};

interface GuardTarget {
    url: string;
    /** Calculator v2 embeds in our modal; the checkout link opens a tab. */
    embed: boolean;
}

export function GuardarianOnramp({
    mode = "buy",
    className = "",
    compact = false,
    variant = "default",
    defaultAmount = "100",
    neededAsset,
    neededAmountUsd,
    onBuyStarted,
}: GuardarianOnrampProps) {
    const { address, chainId } = useWalletContext();
    const [target, setTarget] = useState<GuardTarget | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Resolve the entry URL up-front so the click stays synchronous —
    // window.open after an await gets popup-blocked (and the modal path
    // needs the URL before the iframe mounts anyway).
    useEffect(() => {
        if (!address) {
            setTarget(null);
            return;
        }
        const params = new URLSearchParams({ mode, address });
        if (neededAsset) params.set("symbol", neededAsset);
        const usd = neededAmountUsd ?? parseFloat(defaultAmount || "100");
        if (Number.isFinite(usd) && usd > 0) params.set("amountUsd", String(usd));
        if (chainId) params.set("chainId", String(chainId));

        let cancelled = false;
        fetch(`/api/onramp/guardarian-url?${params}`)
            .then(async (r) => {
                if (cancelled) return;
                if (r.status === 501) { setUnavailable(true); return; }
                if (!r.ok) throw new Error(String(r.status));
                const data = (await r.json()) as GuardTarget;
                setTarget({ url: data.url, embed: data.embed });
            })
            .catch(() => { if (!cancelled) setUnavailable(true); });
        return () => { cancelled = true; };
    }, [address, chainId, mode, neededAsset, neededAmountUsd, defaultAmount]);

    const open = () => {
        if (!target) return;
        onBuyStarted?.();
        if (target.embed) setIsOpen(true);
        else window.open(target.url, "_blank", "noopener,noreferrer");
    };

    const getModeLabel = () => (mode === "buy" ? "Buy Crypto" : "Sell Crypto");
    const getModeIcon = () => (mode === "buy" ? "⚡" : "💰");

    const getButtonStyles = () => {
        if (variant === "white") {
            return "bg-white text-blue-600 hover:bg-blue-50 shadow-md border-transparent";
        }
        if (variant === "outline") {
            return "bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800";
        }
        if (mode === "buy") {
            return "bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 border-transparent";
        }
        return "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 border-transparent";
    };

    if (!address) {
        return (
            <button disabled className={`opacity-50 cursor-not-allowed ${className}`} title="Connect wallet first">
                {getModeIcon()} {getModeLabel()}
            </button>
        );
    }

    // Not a dead CTA: when the partner credentials aren't configured the
    // provider is honest about it instead of opening a bare homepage.
    if (unavailable) {
        return (
            <button disabled className={`opacity-50 cursor-not-allowed ${className}`} title="Guardarian isn't configured on this deployment">
                {getModeIcon()} {getModeLabel()}
            </button>
        );
    }

    if (compact) {
        return (
            <>
                <button
                    onClick={open}
                    disabled={!target}
                    className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 ${className}`}
                >
                    <span>{getModeIcon()}</span>
                    <span>{getModeLabel()}</span>
                    <span className="ml-auto text-xs text-green-600 dark:text-green-400">
                        No KYC
                    </span>
                </button>
                <AnimatePresence>
                    {isOpen && target && (
                        <OnrampModal widgetUrl={target.url} onClose={() => setIsOpen(false)} brand={GUARD_BRAND} />
                    )}
                </AnimatePresence>
            </>
        );
    }

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={open}
                disabled={!target}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors border disabled:opacity-50 ${getButtonStyles()} ${className}`}
            >
                <span className="text-lg">{getModeIcon()}</span>
                <span>{getModeLabel()}</span>
                <span className="text-xs opacity-80 ml-1">No KYC</span>
            </motion.button>
            <AnimatePresence>
                {isOpen && target && (
                    <OnrampModal widgetUrl={target.url} onClose={() => setIsOpen(false)} brand={GUARD_BRAND} />
                )}
            </AnimatePresence>
        </>
    );
}

// Convenience exports
export function BuyCryptoButtonGuardarian(props: Omit<GuardarianOnrampProps, "mode">) {
    return <GuardarianOnramp {...props} mode="buy" />;
}

export function SellCryptoButtonGuardarian(props: Omit<GuardarianOnrampProps, "mode">) {
    return <GuardarianOnramp {...props} mode="sell" />;
}

export default GuardarianOnramp;
