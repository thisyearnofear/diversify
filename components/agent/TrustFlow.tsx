import { motion, useReducedMotion } from 'framer-motion';

/**
 * TrustFlow — a lightweight typing indicator shown while the AI is
 * generating a response. Previously this showed fake "Research → Analyze
 * → Recommend" steps that were string-matched off canned thinking text;
 * now it's a simple animated dots indicator that reflects actual activity.
 */
interface TrustFlowProps {
  isActive: boolean;
  step?: string;
}

export function TrustFlow({ isActive }: TrustFlowProps) {
  const reducedMotion = useReducedMotion();

  if (!isActive) return null;

  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"
          animate={
            reducedMotion
              ? undefined
              : { opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }
          }
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}
