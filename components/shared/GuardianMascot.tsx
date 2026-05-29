import React from 'react';
import { motion } from 'framer-motion';

interface GuardianMascotProps {
  size?: number | string;
  mood?: 'happy' | 'neutral' | 'thinking' | 'protective' | 'alert';
  className?: string;
}

export const GuardianMascot: React.FC<GuardianMascotProps> = ({ 
  size = 120, 
  mood = 'happy',
  className = "" 
}) => {
  // Eye animations based on mood
  const eyeVariants = {
    happy: { scaleY: 1, y: 0 },
    neutral: { scaleY: 1, y: 0 },
    thinking: { scaleY: 0.8, y: -2, x: [0, 2, -2, 0], transition: { repeat: Infinity, duration: 2 } },
    protective: { scaleY: 0.5, y: 2 },
    alert: { scaleY: 1.2, scaleX: 1.2 }
  };

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background Glow */}
      <motion.div
        className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl"
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3] 
        }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      <motion.svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10"
        initial={{ y: 0 }}
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Shield Body */}
        <motion.path
          d="M50 10 L85 25 V50 C85 75 50 90 50 90 C50 90 15 75 15 50 V25 L50 10Z"
          fill="url(#bodyGradient)"
          stroke="#2563EB"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5 }}
        />

        {/* Inner Glass/Screen */}
        <path
          d="M50 20 L75 30 V50 C75 65 50 75 50 75 C50 75 25 65 25 50 V30 L50 20Z"
          fill="#1E293B"
          opacity="0.8"
        />

        {/* Eyes (Digital) */}
        <g className="eyes">
          {/* Left Eye */}
          <motion.rect
            x="35"
            y="40"
            width="8"
            height="8"
            rx="2"
            fill="#60A5FA"
            variants={eyeVariants}
            animate={mood}
          />
          {/* Right Eye */}
          <motion.rect
            x="57"
            y="40"
            width="8"
            height="8"
            rx="2"
            fill="#60A5FA"
            variants={eyeVariants}
            animate={mood}
          />
        </g>

        {/* Thinking Indicator (Floating dots) */}
        {mood === 'thinking' && (
          <g>
            <motion.circle cx="50" cy="15" r="2" fill="#60A5FA" animate={{ opacity: [0, 1, 0] }} transition={{ delay: 0, repeat: Infinity }} />
            <motion.circle cx="60" cy="12" r="2" fill="#60A5FA" animate={{ opacity: [0, 1, 0] }} transition={{ delay: 0.2, repeat: Infinity }} />
            <motion.circle cx="70" cy="15" r="2" fill="#60A5FA" animate={{ opacity: [0, 1, 0] }} transition={{ delay: 0.4, repeat: Infinity }} />
          </g>
        )}

        {/* Gradients */}
        <defs>
          <linearGradient id="bodyGradient" x1="50" y1="10" x2="50" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EFF6FF" />
            <stop offset="100%" stopColor="#DBEAFE" />
          </linearGradient>
        </defs>
      </motion.svg>

      {/* Shadow */}
      <motion.div
        className="absolute -bottom-2 w-1/2 h-2 bg-black/10 rounded-full blur-sm"
        animate={{ scaleX: [1, 0.8, 1], opacity: [0.2, 0.1, 0.2] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
    </div>
  );
};
