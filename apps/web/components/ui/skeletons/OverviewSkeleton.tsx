import React from "react";

export default function OverviewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* GuardianStreakWidget mimic */}
      <div className="rounded-2xl bg-gray-200 dark:bg-gray-700 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 bg-gray-300 dark:bg-gray-600 rounded-full" />
          <div className="space-y-2">
            <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-5 w-32 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 flex-1 bg-gray-300 dark:bg-gray-600 rounded-xl" />
          <div className="h-8 flex-1 bg-gray-300 dark:bg-gray-600 rounded-xl" />
        </div>
      </div>

      {/* Portfolio overview card */}
      <div className="rounded-2xl bg-gray-200 dark:bg-gray-700 p-5 space-y-4">
        <div className="h-4 w-28 bg-gray-300 dark:bg-gray-600 rounded" />
        <div className="h-8 w-36 bg-gray-300 dark:bg-gray-600 rounded" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-5 w-20 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-5 w-20 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-5 w-20 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-5 w-20 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
        </div>
      </div>

      {/* Chain distribution card */}
      <div className="rounded-2xl bg-gray-200 dark:bg-gray-700 p-5 space-y-3">
        <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded" />
        <div className="space-y-2">
          <div className="h-10 w-full bg-gray-300 dark:bg-gray-600 rounded-xl" />
          <div className="h-10 w-full bg-gray-300 dark:bg-gray-600 rounded-xl" />
        </div>
      </div>

      {/* Insight card */}
      <div className="rounded-2xl bg-gray-200 dark:bg-gray-700 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-3 w-44 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
