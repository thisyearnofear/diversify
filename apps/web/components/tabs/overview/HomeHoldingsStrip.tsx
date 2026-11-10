/**
 * HomeHoldingsStrip — the quiet coin row under Home's stage.
 *
 * One coin per region, sized by share, echoing the coin stage's motif —
 * never a second ring (design-language §5 keeps Home on coins and Shield on
 * the ring). It is its own component because it belongs to the holdings
 * reading, not to the market reading: the stage above it changes what the
 * coins mean (Story tells the market, Verify tells the ledger) while the
 * user's own split stays on screen.
 *
 * Selection dims the other coins and opens the region inspector. The strip
 * is 0px when there are no holdings.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Coin } from "@/components/shared/FloatingCoins";
import { regionGlyph } from "@/lib/home-lens";
import { haptics } from "@/lib/haptics";
import { press, springPress, springSoft, STAGGER_STEP_S } from "@/lib/motion-tokens";
import FlickScrollRow, { useDidDrag } from "@/components/shared/FlickScrollRow";
import { MintMark } from "@/components/swap/MintMark";
import { useBalanceVisibility } from "@/context/app/BalanceVisibilityContext";

interface RegionDatum {
  region: string;
  value: number;
  color: string;
}

/**
 * One region coin — a CHILD COMPONENT because useDidDrag() must be called
 * inside the FlickScrollRow provider's tree; a hook call in the strip body
 * would read the default (never-dragged) ref and silently no-op.
 */
function RegionCoin({
  region,
  pct,
  isSelected,
  isDimmed,
  isSealed,
  index,
  reducedMotion,
  isFirst,
  isLast,
  onSelect,
}: {
  region: RegionDatum;
  pct: number;
  isSelected: boolean;
  isDimmed: boolean;
  isSealed: boolean;
  index: number;
  reducedMotion: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onSelect: () => void;
}) {
  const didDragRef = useDidDrag();
  const arrived = React.useRef(false);
  React.useEffect(() => {
    arrived.current = true;
  }, []);
  const share = pct / 100;
  const clamped = Math.max(0, Math.min(1, share));
  const size = Math.round(28 + 28 * Math.sqrt(clamped));
  return (
    <motion.button
      type="button"
      layoutId={reducedMotion ? undefined : `home-region-${region.region}`}
      aria-pressed={isSelected}
      aria-label={`${region.region} ${Math.round(pct)}%`}
      onClick={() => {
        if (didDragRef.current) return; // release after a drag is not a choice
        haptics.tap();
        onSelect();
      }}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      whileTap={reducedMotion ? undefined : { ...press, transition: springPress }}
      animate={{
        opacity: isDimmed ? 0.35 : 1,
        y: 0,
        scale: reducedMotion ? 1 : isSelected ? 1.08 : 1,
      }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { ...springSoft, delay: arrived.current ? 0 : index * STAGGER_STEP_S }
      }
      className={`flex flex-none flex-col items-center gap-1 min-w-tap min-h-tap rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
        isFirst ? "ms-auto" : ""
      } ${isLast ? "me-auto" : ""}`}
    >
      <span className="relative inline-flex">
        <Coin variant="asset" size={size} symbol={regionGlyph(region.region)} color={region.color} />
        {isSealed && !reducedMotion && (
          // One emerald pulse — the same single-shot seal the receipt
          // coin wears, never a loop.
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-emerald-500"
            initial={{ scale: 0.9, opacity: 0.9 }}
            animate={{ scale: 1.25, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        )}
        {isSealed && (
          <MintMark
            data-testid="region-coin-sealed"
            className="h-4 w-4 bg-emerald-500 text-3xs leading-none text-white ring-emerald-600 dark:bg-emerald-600"
          >
            ✓
          </MintMark>
        )}
      </span>
      <span className="text-2xs font-semibold text-gray-600 dark:text-gray-300 truncate max-w-[72px]">
        {region.region}
      </span>
      <span className="text-2xs tabular-nums text-gray-400 dark:text-gray-500">
        {Math.round(pct)}%
      </span>
    </motion.button>
  );
}

export function HomeHoldingsStrip({
  regionData,
  totalValue,
  focusedRegion,
  onSelectRegion,
  isDemo,
  sealedRegion = null,
}: {
  regionData: RegionDatum[];
  totalValue: number;
  focusedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
  isDemo?: boolean;
  /** Region whose destination token a settled swap landed in — the coin
   *  wears a seal until the user selects a coin. */
  sealedRegion?: string | null;
}) {
  const reducedMotion = useReducedMotion();
  const { formatMoney: fmt } = useBalanceVisibility();
  if (!(totalValue > 0 && regionData.length > 0)) return null;
  return (
    <div
      data-testid="holdings-strip"
      className="mt-4 border-t border-gray-100 dark:border-white/[0.06] pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-semibold text-gray-500 dark:text-gray-400">
          Your savings · <span className="font-bold text-gray-900 dark:text-white tabular-nums">{fmt(totalValue)}</span>
        </p>
        {isDemo && (
          <span className="text-3xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
            Sample
          </span>
        )}
      </div>

      <FlickScrollRow
        className="mt-3 gap-3 pb-1 items-end"
        chevrons={false}
        role="group"
        aria-label="Holdings by region"
      >
        {regionData.map((r, idx) => {
          const pct = totalValue > 0 ? (r.value / totalValue) * 100 : 0;
          const isSelected = focusedRegion === r.region;
          return (
            <RegionCoin
              key={r.region}
              region={r}
              pct={pct}
              isSelected={isSelected}
              isDimmed={focusedRegion !== null && !isSelected}
              isSealed={sealedRegion === r.region}
              index={idx}
              reducedMotion={Boolean(reducedMotion)}
              isFirst={idx === 0}
              isLast={idx === regionData.length - 1}
              onSelect={() =>
                onSelectRegion(focusedRegion === r.region ? null : r.region)
              }
            />
          );
        })}
      </FlickScrollRow>
    </div>
  );
}

export default HomeHoldingsStrip;
