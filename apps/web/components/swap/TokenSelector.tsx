import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TokenIcon } from "../shared/TokenIcon";
import { Coin } from "../shared/FloatingCoins";
import { QUIET_GRAY, tokenColor } from "../shared/palette";
import { springPop, springSoft } from "@/lib/motion-tokens";
import TokenPickerSheet, { type TokenPickerItem } from "./TokenPickerSheet";
import { goodsEquivalentFor } from "@/lib/corridor-context";
import { REGION_COLORS, TOKEN_METADATA, EXCHANGE_RATES } from "../../config";
import type { UserExperienceMode } from "@/context/app/types";
// Deep leaf imports — NOT the barrel — keeps the strategy stack out of first-load.
import { StrategyService } from "@diversifi/shared/src/services/strategy/strategy.service";
import type { FinancialStrategy } from "@diversifi/shared/src/types/strategy";

interface Token {
  symbol: string;
  name: string;
  icon?: string;
  region: string;
}

interface TokenSelectorProps {
  label: string;
  selectedToken: string;
  onTokenChange: (token: string) => void;
  amount?: string;
  onAmountChange?: (amount: string) => void;
  availableTokens: Token[];
  tokenRegion?: string;
  inflationRate?: number;
  disabled?: boolean;
  showAmountInput?: boolean;
  tokenBalances?: Record<string, { formattedBalance: string; value: number }>;
  currentChainId?: number;
  tokenChainId?: number;
  experienceMode?: UserExperienceMode;
  financialStrategy?: FinancialStrategy;
  /** False when no wallet is connected — suppresses the balance line
   *  entirely. A walletless visitor has no balances; showing
   *  "Balance: 0.0000 X" fabricates a state that cannot become true. */
  hasWallet?: boolean;
  /** Live quoted receive amount (To row only). When it parses > 0 the
   *  destination coin pours full — the ticket answering the amount you
   *  typed (§5: motion confirms). Replays on each new quote. */
  receiveAmount?: string | null;
}

/**
 * The destination coin fills as the quote arrives — the ticket answering
 * the amount you typed (§5: motion confirms selection/response; one shot
 * per new quote, never a loop). Quiet gray until a live quote exists;
 * reduced motion renders the filled state instantly.
 */
function PourCoin({
  symbol,
  receiveAmount,
}: {
  symbol: string;
  receiveAmount?: string | null;
}) {
  const reducedMotion = useReducedMotion();
  const filled = Boolean(receiveAmount && Number.parseFloat(receiveAmount) > 0);
  return (
    <span className="relative inline-flex h-6 w-6 shrink-0" aria-hidden="true">
      <Coin size={24} symbol={symbol.slice(0, 1)} color={QUIET_GRAY} variant="asset" />
      {filled && (
        <motion.span
          key={receiveAmount}
          className="absolute inset-0"
          initial={reducedMotion ? false : { clipPath: "inset(100% 0 0 0)" }}
          animate={{ clipPath: "inset(0% 0 0 0)" }}
          transition={reducedMotion ? { duration: 0 } : springSoft}
        >
          <Coin size={24} symbol={symbol.slice(0, 1)} color={tokenColor(symbol)} variant="asset" />
        </motion.span>
      )}
    </span>
  );
}

const TokenSelector: React.FC<TokenSelectorProps> = ({
  label,
  selectedToken,
  onTokenChange,
  amount,
  onAmountChange,
  availableTokens,
  tokenRegion,
  disabled = false,
  showAmountInput = true,
  tokenBalances = {},
  currentChainId,
  tokenChainId,
  experienceMode = "beginner",
  financialStrategy,
  hasWallet = true,
  receiveAmount = null,
}) => {
  const isBeginnerMode = experienceMode === "beginner";
  const reducedMotion = useReducedMotion();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [showWhySwap, setShowWhySwap] = React.useState(false);

  // Smart default: auto-select token with highest balance
  React.useEffect(() => {
    if (!selectedToken && availableTokens.length > 0 && Object.keys(tokenBalances).length > 0) {
      let highestBalanceToken = availableTokens[0].symbol;
      let highestBalance = 0;
      for (const token of availableTokens) {
        const balance = tokenBalances[token.symbol];
        if (balance && parseFloat(balance.formattedBalance) > highestBalance) {
          highestBalance = parseFloat(balance.formattedBalance);
          highestBalanceToken = token.symbol;
        }
      }
      if (highestBalance > 0) onTokenChange(highestBalanceToken);
    }
  }, [availableTokens, tokenBalances, selectedToken, onTokenChange]);

  // --- compliance + badge helpers (unchanged logic, now feeds the picker) ---

  const getComplianceInfo = (tokenSymbol: string) => {
    if (!financialStrategy) return { isCompliant: true };
    return StrategyService.getAssetCompliance(financialStrategy, tokenSymbol);
  };

  const isRecommended = (tokenSymbol: string): boolean => {
    if (!financialStrategy) return false;
    const recommended = StrategyService.getRecommendedAssets(financialStrategy);
    return recommended.some(
      (rec) =>
        tokenSymbol.toUpperCase().includes(rec.toUpperCase()) ||
        rec.toUpperCase().includes(tokenSymbol.toUpperCase()),
    );
  };

  const getStrategyBadge = (tokenSymbol: string): { label: string } | null => {
    if (!financialStrategy || !isRecommended(tokenSymbol)) return null;
    switch (financialStrategy) {
      case "africapitalism":
        if (tokenSymbol.match(/KES|GHS|ZAR|NGN|XOF/i)) return { label: "Builds Africa" };
        break;
      case "buen_vivir":
        if (tokenSymbol.match(/BRL|COP|MXN|ARS/i)) return { label: "LatAm Unity" };
        break;
      case "pan_caribbean":
        if (tokenSymbol.match(/USDC|USDm|USDY|PAXG/i)) return { label: "Caribbean Hedge" };
        break;
      case "confucian":
        if (tokenSymbol.match(/USD|EUR|USDY/i)) return { label: "Stable Wealth" };
        break;
      case "gotong_royong":
        if (tokenSymbol.match(/PHP|IDR|THB|VND/i)) return { label: "Community" };
        break;
      case "islamic":
        if (tokenSymbol.match(/PAXG|USDm|EURm/i)) return { label: "Halal" };
        break;
      case "global":
      case "custom":
      default:
        return { label: "Aligned" };
    }
    return null;
  };

  const getYieldBadge = (symbol: string): { text: string; color: string } | null => {
    if (symbol === "USDY") return { text: "+5% APY", color: "text-emerald-600 bg-emerald-100" };
    if (symbol === "SYRUPUSDC") return { text: "+4.5% APY", color: "text-purple-600 bg-purple-100" };
    if (symbol === "PAXG") return { text: "Gold", color: "text-amber-600 bg-amber-100" };
    return null;
  };

  // Build picker items from available tokens
  const pickerItems: TokenPickerItem[] = React.useMemo(
    () =>
      availableTokens.map((token) => {
        const compliance = getComplianceInfo(token.symbol);
        const metadata = TOKEN_METADATA[token.symbol];
        return {
          symbol: token.symbol,
          name: metadata?.name || token.name || token.symbol,
          region: token.region,
          balance: tokenBalances[token.symbol]?.formattedBalance,
          balanceValue: tokenBalances[token.symbol]?.value ?? 0,
          compliant: compliance.isCompliant,
          complianceReason: compliance.reason,
          badge: getStrategyBadge(token.symbol),
          yieldBadge: getYieldBadge(token.symbol),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableTokens, tokenBalances, financialStrategy],
  );

  // --- balance / cross-chain ---
  const isCrossChain = currentChainId && tokenChainId && currentChainId !== tokenChainId;
  const tokenBalance = tokenBalances[selectedToken];
  const hasBalance = tokenBalance && parseFloat(tokenBalance.formattedBalance) > 0;

  const balanceNum = hasBalance ? parseFloat(tokenBalance.formattedBalance) : 0;
  const balanceDisplay = isCrossChain
    ? hasBalance
      ? `${balanceNum.toFixed(4)} ${selectedToken}`
      : `— ${selectedToken}`
    : `${balanceNum.toFixed(4)} ${selectedToken}`;

  const setMaxAmount = () => {
    if (onAmountChange && hasBalance && !isCrossChain) {
      onAmountChange(tokenBalance.formattedBalance);
    }
  };

  // USD equivalent of the input amount
  const usdEquivalent = React.useMemo(() => {
    if (!showAmountInput || !amount) return null;
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    const rate = EXCHANGE_RATES[selectedToken];
    if (!rate) return null;
    return parsed * rate;
  }, [amount, selectedToken, showAmountInput]);

  // Purchasing-power vocabulary, not DEX vocabulary: the equivalent leads
  // with what the amount buys at home ("6 bags of rice") when the fiat has
  // a curated staple; the dollar figure follows. A token with no anchor
  // keeps the plain ≈ $ — absence is honest.
  const goodsEquivalent = React.useMemo(() => {
    if (!showAmountInput || !amount) return null;
    return goodsEquivalentFor(selectedToken, parseFloat(amount));
  }, [amount, selectedToken, showAmountInput]);

  const equivalentText = React.useMemo(() => {
    const usd =
      usdEquivalent != null
        ? `$${usdEquivalent < 1 ? usdEquivalent.toFixed(4) : usdEquivalent.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
        : null;
    return [goodsEquivalent, usd].filter(Boolean).join(" · ") || null;
  }, [goodsEquivalent, usdEquivalent]);

  // The receive side answers the same way — what the quoted amount buys
  // where it lands (the remittance reading). Only when a real quote
  // exists and the destination fiat has a curated staple.
  const destinationGoods = React.useMemo(() => {
    if (showAmountInput || !receiveAmount) return null;
    return goodsEquivalentFor(selectedToken, parseFloat(receiveAmount));
  }, [showAmountInput, receiveAmount, selectedToken]);

  // Region color for the token pill border
  const regionColor =
    tokenRegion && tokenRegion !== "Unknown"
      ? REGION_COLORS[tokenRegion as keyof typeof REGION_COLORS]
      : null;

  const selectedCompliance = getComplianceInfo(selectedToken);
  const isNonCompliant = !selectedCompliance.isCompliant;

  // --- amount input handlers (text, not type=number, to avoid scroll-wheel hijack) ---
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onAmountChange) return;
    const val = e.target.value;
    // allow only valid decimal patterns
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      onAmountChange(val);
    }
  };

  return (
    <div>
      {/* Label row */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {label}
        </label>
        {isBeginnerMode && label === "From" && (
          <button
            type="button"
            onClick={() => setShowWhySwap((s) => !s)}
            className="relative flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-1 my-0.5 text-xs font-semibold text-blue-600 dark:text-blue-300 transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 before:absolute before:inset-[-10px] before:content-['']"
            aria-label="Why swap? Different currencies lose value at different rates"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Why swap?
          </button>
        )}
      </div>

      {/* Beginner educational tooltip */}
      {isBeginnerMode && showWhySwap && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl">
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            Different currencies lose value at different rates. Swapping to more stable currencies protects your savings from losing purchasing power.
          </p>
          <button
            onClick={() => setShowWhySwap(false)}
            className="relative mt-2 text-xs font-bold text-blue-500 hover:text-blue-700 before:absolute before:inset-[-12px] before:content-['']"
          >
            Got it
          </button>
        </div>
      )}

      {/* Amount-as-hero layout */}
      <div
        className={`relative rounded-2xl border-2 bg-white dark:bg-gray-900 transition-colors ${
          isNonCompliant
            ? "border-red-300 dark:border-red-800"
            : regionColor
              ? "border-transparent"
              : "border-gray-200 dark:border-gray-700 focus-within:border-blue-500"
        }`}
        style={regionColor && !isNonCompliant ? { borderColor: regionColor, borderWidth: 2 } : {}}
      >
        <div className="flex items-stretch">
          {/* Amount input (hero) */}
          {showAmountInput && onAmountChange && (
            <input
              type="text"
              value={amount ?? ""}
              onChange={handleAmountChange}
              placeholder="0.00"
              inputMode="decimal"
              disabled={disabled}
              className="flex-1 min-w-0 bg-transparent text-2xl font-black text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 px-4 py-3.5 focus:outline-none"
              aria-label={`${label} amount`}
            />
          )}

          {/* When no amount input (To field), show balance/region info instead */}
          {!showAmountInput && (
            <div className="flex-1 min-w-0 px-4 py-3.5 flex items-center gap-2">
              <PourCoin symbol={selectedToken} receiveAmount={receiveAmount} />
              {regionColor && tokenRegion && tokenRegion !== "Unknown" && (
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: regionColor }}
                  aria-hidden
                />
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {TOKEN_METADATA[selectedToken]?.name || selectedToken}
                {tokenRegion && tokenRegion !== "Unknown" ? ` · ${tokenRegion}` : ""}
              </span>
            </div>
          )}

          {/* Token pill button */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={disabled}
            aria-label={`Select ${label} token`}
            className="flex items-center gap-2 px-3 min-h-[44px] my-1.5 mr-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Mint flip — the LensCoinSelector moment-of-choice beat:
                picking a token mints it into the pill (§5 confirms the
                selection). Keyed remount replays per change; reduced
                motion swaps instantly. */}
            <motion.span
              key={selectedToken}
              className="inline-flex"
              initial={reducedMotion ? false : { rotateY: 90, opacity: 0.3 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={springPop}
            >
              <TokenIcon symbol={selectedToken} size={24} />
            </motion.span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {selectedToken}
            </span>
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Balance line — only with a connected wallet: no wallet, no
            balances, and "0.0000" would be a fabricated number. The
            ≈ equivalent is display-rate + staple math, not balance —
            walletless visitors get it too. */}
        {hasWallet ? (
        <div className="flex items-center justify-between px-4 pb-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 dark:text-gray-500">
              {isCrossChain ? (hasBalance ? "Balance (other chain):" : "Balance (switch to check):") : "Balance:"}
            </span>
            <span className="font-semibold text-gray-600 dark:text-gray-300">
              {balanceDisplay}
            </span>
            {hasBalance && !isCrossChain && (
              <button
                type="button"
                onClick={setMaxAmount}
                disabled={disabled}
                className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                MAX
              </button>
            )}
          </div>
          {equivalentText && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ≈ {equivalentText}
            </span>
          )}
        </div>
        ) : (
          equivalentText && (
            <div className="flex justify-end px-4 pb-2.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ≈ {equivalentText}
              </span>
            </div>
          )
        )}
      </div>

      {/* The receive side in staples — what the quote buys where it
          lands. Remittance vocabulary: "6 bags of rice in Lagos", not
          "500.12 USD". */}
      {destinationGoods && (
        <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          ≈ {destinationGoods} where it lands
        </p>
      )}

      {/* Non-compliant inline warning (compact, one line) */}
      {isNonCompliant && selectedCompliance.reason && (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 leading-relaxed">
          {selectedCompliance.reason}
          {selectedCompliance.alternatives?.length ? ` · Try: ${selectedCompliance.alternatives.join(", ")}` : ""}
        </p>
      )}

      {/* Cross-chain hint (compact) */}
      {showAmountInput && isCrossChain && (
        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
          Cross-chain quotes may shift with bridge fees.
        </p>
      )}

      <TokenPickerSheet
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onTokenChange}
        items={pickerItems}
        selectedToken={selectedToken}
        title={`Select ${label} token`}
      />
    </div>
  );
};

export default TokenSelector;
