import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useCredits } from '../../hooks/use-credits';
import { FREE_TRIAL_CREDITS } from '../../constants/credits';

const SOURCES = ['World Bank', 'CoinGecko', 'IMF', 'DeFi Llama', 'FRED'];

interface ResearchCheckProps {
  isResearching: boolean;
  spent?: number;
}

export function ResearchCheck({ isResearching }: ResearchCheckProps) {
  const { status } = useCredits();
  const spent = status ? Math.max(0, FREE_TRIAL_CREDITS + status.referral.totalEarned - status.credits.bonus) : 0;
  const reducedMotion = useReducedMotion();
  const [visibleSources, setVisibleSources] = useState<string[]>([]);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    if (!isResearching) {
      setVisibleSources([]);
      setSourceIndex(0);
      return;
    }

    if (sourceIndex < SOURCES.length) {
      const timer = setTimeout(() => {
        setVisibleSources((prev) => [...prev, SOURCES[sourceIndex]]);
        setSourceIndex((i) => i + 1);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isResearching, sourceIndex]);

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-2.5 w-2.5">
        {isResearching && !reducedMotion && (
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
            animate={{ scale: [1, 2, 1], opacity: [0.75, 0, 0.75] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            isResearching ? 'bg-emerald-400' : 'bg-slate-500'
          }`}
        />
      </div>

      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {isResearching ? 'Researching...' : 'Research ready'}
        </span>

        {isResearching && visibleSources.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {visibleSources.map((source, i) => (
              <motion.span
                key={source}
                initial={reducedMotion ? undefined : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[9px] font-bold px-1.5 py-0.5 bg-white/10 rounded-full text-emerald-300 border border-emerald-500/20"
              >
                {source}
              </motion.span>
            ))}
          </div>
        )}
      </div>

      <span className="text-[10px] font-mono text-slate-500 ml-auto">
        ${spent.toFixed(3)} spent
      </span>
    </div>
  );
}
