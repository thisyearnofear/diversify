/**
 * ChainPill — small "Celo ⇄ Arbitrum" pill that lives next to the wallet
 * button. One-tap network switch with a tiny dropdown for the other
 * supported chain. Solves the "why don't I see my Arbitrum balance?"
 * confusion by making the current chain visible and switchable from the
 * header instead of buried in the wallet menu.
 *
 * Hidden on mobile (<sm) so it doesn't crowd the right-side controls.
 */
import { useState, useRef, useEffect } from "react";
import { useWalletContext } from "@/components/wallet/WalletProvider";
import { useToast } from "@/components/ui/Toast";
import { useAnalytics } from "@/hooks/use-analytics";
import { NETWORKS } from "../../config";

interface ChainMeta {
    id: number;
    short: string;
    icon: string;
}

// The two chains the home overview actually shows. Testnets and stock
// chains are still available in the full wallet menu but aren't surfaced
// here — this pill is about the "I have USDC on Arbitrum but I see $0"
// problem, not a complete network picker.
const PRIMARY_CHAINS: ReadonlyArray<ChainMeta> = [
    { id: NETWORKS.CELO_MAINNET.chainId, short: "Celo", icon: "🌱" },
    { id: NETWORKS.ARBITRUM_ONE.chainId, short: "Arbitrum", icon: "🔷" },
];

function findChainMeta(chainId: number | null | undefined): ChainMeta | null {
    if (chainId == null) return null;
    return PRIMARY_CHAINS.find((c) => c.id === chainId) ?? null;
}

export function ChainPill() {
    const { chainId, switchNetwork } = useWalletContext();
    const { showToast } = useToast();
    const { trackChainPillSwitch } = useAnalytics();
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const current = findChainMeta(chainId);
    const other = PRIMARY_CHAINS.find((c) => c.id !== current?.id);

    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, [open]);

    // No wallet connected → no pill. The wallet button handles "connect".
    if (!current) return null;

    const handleSwitch = async (target: ChainMeta) => {
        if (pending || target.id === current.id) return;
        setOpen(false);
        setPending(true);
        trackChainPillSwitch(current.short, target.short);
        showToast(`Switching to ${target.short}…`, "info");
        try {
            await switchNetwork(target.id);
            setTimeout(() => {
                showToast(`Connected to ${target.short}`, "success");
                setPending(false);
            }, 800);
        } catch (err: any) {
            const msg = String(err?.message ?? "");
            if (msg.includes("rejected") || err?.code === 4001) {
                showToast("Network switch cancelled", "info");
            } else {
                showToast("Failed to switch network", "error");
            }
            setPending(false);
        }
    };

    return (
        <div ref={wrapperRef} className="relative hidden sm:block">
            <button
                type="button"
                onClick={() => other && setOpen((o) => !o)}
                disabled={pending || !other}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-black text-gray-700 dark:text-gray-200 disabled:opacity-50"
                aria-label={`Current chain: ${current.short}. Tap to switch.`}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <span aria-hidden>{current.icon}</span>
                <span>{current.short}</span>
                {other && (
                    <svg
                        className={`w-3 h-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden
                    >
                        <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </button>
            {open && other && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                    <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                        Switch chain
                    </div>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => handleSwitch(other)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        <span aria-hidden>{other.icon}</span>
                        <span>{other.short}</span>
                    </button>
                    <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
                        For more networks, use the wallet menu.
                    </div>
                </div>
            )}
        </div>
    );
}
