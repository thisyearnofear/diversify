import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Ten sacks: one per tenth of the buying power the savings started with. */
export const BASKET_SLOTS = 10;
const ROWS = [3, 4, 3];

/**
 * The Goods lens of the Home coin: the same disc, now a basket of staples.
 * Sacks still full = the share of buying power retained (`retainedRatio`,
 * the number that already scales the coin); the rest are emptied. No new
 * data — the sentence under it stays the readable layer.
 *
 * PLACEHOLDER GLYPH: a neutral sack, pending regional illustration of each
 * anchor's staple (rice, maize flour …) by illustrators from those regions.
 */
export function GoodsBasket({
  retainedRatio,
  color,
  size = 112,
}: {
  retainedRatio: number;
  color: string;
  size?: number;
}) {
  const reducedMotion = useReducedMotion();
  const full = Math.max(
    0,
    Math.min(BASKET_SLOTS, Math.round(retainedRatio * BASKET_SLOTS)),
  );
  let i = 0;
  return (
    <span
      data-testid="moment-goods-basket"
      data-full={full}
      aria-hidden="true"
      className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-full border-2 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      style={{ width: size }}
    >
      {ROWS.map((n, r) => (
        <span key={r} className="flex gap-0.5">
          {Array.from({ length: n }, () => {
            const slot = i++;
            const kept = slot < full;
            return (
              <motion.svg
                key={slot}
                viewBox="0 0 16 18"
                width={size * 0.17}
                height={size * 0.19}
                initial={false}
                animate={{ opacity: kept ? 1 : 0.22, scale: kept ? 1 : 0.86 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 240,
                        damping: 22,
                        delay: (BASKET_SLOTS - slot) * 0.03,
                      }
                }
              >
                <path
                  d="M5 1.5h6l-1.2 2.6C13.4 5.6 15 9 15 12.2 15 15.4 12.2 17 8 17s-7-1.6-7-4.8C1 9 2.6 5.6 6.2 4.1Z"
                  fill={kept ? color : "none"}
                  stroke={color}
                  strokeWidth={1.2}
                  strokeLinejoin="round"
                />
              </motion.svg>
            );
          })}
        </span>
      ))}
    </span>
  );
}
