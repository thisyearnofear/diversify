import React from 'react';

export function StreakProgressVisualizer({ daysActive }: { daysActive: number }) {
  return (
    <div className="mt-2 py-3 px-4 bg-white/40 dark:bg-black/20 rounded-xl backdrop-blur-sm border border-black/5">
      <div className="flex justify-between items-end mb-2">
        <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
          Streak Progress
        </div>
        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{daysActive} Days</div>
      </div>

      <div className="flex gap-1.5 h-2">
        {[...Array(7)].map((_, i) => {
          const dayIndex = (daysActive - 1) % 7;
          const isActive = i <= dayIndex;
          const isCurrent = i === dayIndex;

          return (
            <div
              key={i}
              className={`flex-1 rounded-full transition-all duration-500 ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                  : 'bg-gray-200 dark:bg-gray-800'
              } ${isCurrent ? 'animate-pulse scale-y-125' : ''}`}
            />
          );
        })}
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-[9px] text-gray-400 font-bold">DAY 1</span>
        <span className="text-[9px] text-gray-400 font-bold">GOAL: 7 DAYS</span>
      </div>
    </div>
  );
}
