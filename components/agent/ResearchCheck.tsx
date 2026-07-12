import { motion, useReducedMotion } from 'framer-motion';
import { useCredits } from '../../hooks/use-credits';

/**
 * ResearchCheck — a compact response status shown above the chat input.
 * Previously displayed fake source labels ("World Bank", "CoinGecko", etc.)
 * that were timed to appear sequentially; now just shows a pulse + status
 * text + real remaining credits.
 */
interface ResearchCheckProps {
  isActive: boolean;
  spent?: number;
}

export function ResearchCheck({ isActive }: ResearchCheckProps) {
  const { status } = useCredits();
  const remaining = status?.credits.bonus ?? 0;
  const isLow = remaining < 0.05;
  const reducedMotion = useReducedMotion();

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-2.5 w-2.5">
        {isActive && !reducedMotion && (
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
            animate={{ scale: [1, 2, 1], opacity: [0.75, 0, 0.75] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            isActive ? 'bg-emerald-400' : 'bg-slate-500'
          }`}
        />
      </div>

      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        {isActive ? 'Responding...' : 'Ready'}
      </span>

      {remaining > 0 && (
        <span className={`text-[10px] font-mono ml-auto ${isLow ? "text-amber-500" : "text-slate-500"}`}>
          ${remaining.toFixed(3)} credits
        </span>
      )}
    </div>
  );
}
