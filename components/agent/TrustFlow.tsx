import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

const STEPS = [
  { icon: '🔍', label: 'Research' },
  { icon: '⚡', label: 'Analyze' },
  { icon: '💡', label: 'Recommend' },
];

interface TrustFlowProps {
  isActive: boolean;
  step: string;
}

export function TrustFlow({ isActive, step }: TrustFlowProps) {
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setActiveIndex(0);
      return;
    }

    const i = STEPS.findIndex((s) =>
      step.toLowerCase().includes(s.label.toLowerCase())
    );
    if (i >= 0) {
      setActiveIndex(i);
    } else if (step.includes('research') || step.includes('payment') || step.includes('evidence')) {
      setActiveIndex(0);
    } else if (step.includes('analy') || step.includes('consult') || step.includes('evaluat')) {
      setActiveIndex(1);
    } else if (step.includes('recommend') || step.includes('advis')) {
      setActiveIndex(2);
    } else {
      // Use functional setState so we don't need `activeIndex` as a
      // dependency, which would re-trigger the timer on every index change.
      setActiveIndex((prev) => Math.min(prev + 1, 2));
    }
  }, [step, isActive]);

  const variants = {
    inactive: { opacity: 0.25, scale: 0.95 },
    active: { opacity: 1, scale: 1 },
    done: { opacity: 0.5, scale: 0.95 },
  };

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <motion.div
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
            variants={variants}
            animate={
              i < activeIndex
                ? 'done'
                : i === activeIndex
                  ? isActive
                    ? 'active'
                    : 'done'
                  : 'inactive'
            }
            transition={{ duration: reducedMotion ? 0 : 0.3 }}
          >
            <span className="text-sm">{s.icon}</span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${
                i === activeIndex && isActive
                  ? 'text-emerald-400'
                  : i < activeIndex
                    ? 'text-emerald-600'
                    : 'text-slate-500'
              }`}
            >
              {s.label}
            </span>
          </motion.div>

          {i < STEPS.length - 1 && (
            <motion.div
              className="w-4 h-px mx-0.5"
              animate={{
                backgroundColor:
                  i < activeIndex
                    ? 'rgb(52 211 153)'
                    : 'rgba(255 255 255 / 0.1)',
              }}
              transition={{ duration: reducedMotion ? 0 : 0.3 }}
            />
          )}
        </div>
      ))}

      {isActive && (
        <motion.span
          className="text-[10px] text-slate-500 ml-1"
          animate={reducedMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          {STEPS[activeIndex]?.label === 'Recommend' ? '...' : '···'}
        </motion.span>
      )}
    </div>
  );
}
