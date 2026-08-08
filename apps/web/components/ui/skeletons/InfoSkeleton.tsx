import React from "react";

export default function InfoSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header section */}
      <div className="px-1 space-y-2">
        <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
      </div>

      {/* Wealth Protection section */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="space-y-1.5">
            <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        {/* Inflation visualizer mimic */}
        <div className="rounded-2xl bg-gray-200 dark:bg-gray-700 p-5 space-y-3">
          <div className="flex justify-between">
            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
          <div className="h-32 w-full bg-gray-300 dark:bg-gray-600 rounded-xl" />
          <div className="flex gap-2 justify-center">
            <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
        </div>
      </div>

      {/* Real-world use cases section (non-beginner) */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-16 w-full bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          <div className="h-16 w-full bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        </div>
      </div>

      {/* GoodDollar section */}
      <div>
        <div className="flex items-center gap-2 mb-4 px-1">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div className="rounded-2xl bg-gray-200 dark:bg-gray-700 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-gray-300 dark:bg-gray-600 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 bg-gray-300 dark:bg-gray-600 rounded" />
              <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded" />
            </div>
          </div>
          <div className="h-3 w-36 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="flex gap-2">
            <div className="h-8 flex-1 bg-gray-300 dark:bg-gray-600 rounded-xl" />
            <div className="h-8 flex-1 bg-gray-300 dark:bg-gray-600 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Network & Wallet info button */}
      <div className="pt-2">
        <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>
  );
}
