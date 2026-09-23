export const RWA_ASSETS = [
    {
        symbol: "USDY",
        type: "Yield Bearing",
        label: "US Treasury Yield",
        description:
            "Tokenized US Treasuries via Ondo. ~5% APY auto-accrues in your wallet. No KYC needed.",
        benefits: [
            "~5% APY auto-accruing",
            "No KYC required",
            "Deep DEX liquidity ($10M+)",
        ],
        gradient: "from-green-600 to-emerald-700",
        icon: "📈",
        textColor: "text-green-700",
        bgColor: "bg-green-100",
        expectedSlippage: "0.5%",
        yieldTooltip:
            "Your USDY balance grows automatically at ~5% APY. Just hold it in your wallet—no claiming needed.",
    },
    {
        symbol: "PAXG",
        type: "Store of Value",
        label: "Inflation Hedge",
        description:
            "Tokenized physical gold backed 1:1 by London Good Delivery gold bars held in Brink's vaults.",
        benefits: [
            "No storage fees",
            "Redeemable for physical gold",
            "24/7 trading",
        ],
        gradient: "from-amber-500 to-orange-600",
        icon: "🏆",
        textColor: "text-amber-700",
        bgColor: "bg-amber-100",
        yieldTooltip:
            "PAXG tracks the price of physical gold. No yield—it's a store of value that protects against inflation.",
    },
    {
        symbol: "SYRUPUSDC",
        type: "Stable Yield",
        label: "Syrup USDC",
        description:
            "Yield-bearing USDC from Syrup Finance powered by Morpho. Earn passive yield on your USDC holdings.",
        benefits: ["~4.5% APY", "Morpho-powered lending", "Auto-compounding"],
        gradient: "from-purple-500 to-indigo-600",
        icon: "🍯",
        textColor: "text-purple-700",
        bgColor: "bg-purple-100",
        expectedSlippage: "0.3%",
        yieldTooltip:
            "Your SYRUPUSDC balance increases automatically at ~4.5% APY from Morpho lending markets.",
    },
];

export function rwaLegFor(symbol: string) {
  const token = symbol.toUpperCase();
  return RWA_ASSETS.find((asset) => asset.symbol.toUpperCase() === token) ?? null;
}
