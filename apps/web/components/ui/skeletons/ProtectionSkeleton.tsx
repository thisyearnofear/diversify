import React from "react";

export default function ProtectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Strategy alignment bar (optional, similar to what ProtectionTab shows) */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700">
        <div className="h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-3 w-32 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
          <div className="h-1.5 w-full bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
      </div>

      {/* Protection Dashboard card */}
      <div className="rounded-2xl bg-gray-200 dark:bg-gray-700 overflow-hidden shadow-[0_20px_50px_-24px_rgba(79,70,229,0.45)]">
        {/* Top gradient section */}
        <div className="bg-gray-300 dark:bg-gray-600 p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="h-4 w-20 bg-gray-400 dark:bg-gray-500 rounded-full" />
              <div className="h-6 w-36 bg-gray-400 dark:bg-gray-500 rounded" />
              <div className="h-3 w-28 bg-gray-400 dark:bg-gray-500 rounded" />
            </div>
            <div className="h-14 w-14 bg-gray-400 dark:bg-gray-500 rounded-2xl" />
          </div>
          <div className="text-center space-y-2">
            <div className="h-10 w-24 bg-gray-400 dark:bg-gray-500 rounded mx-auto" />
            <div className="h-3 w-28 bg-gray-400 dark:bg-gray-500 rounded mx-auto" />
          </div>
        </div>
        {/* Bottom profile wizard section */}
        <div className="p-5 bg-gray-100 dark:bg-gray-800 space-y-3">
          <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-16 bg-gray-300 dark:bg-gray-600 rounded-xl" />
            <div className="h-16 bg-gray-300 dark:bg-gray-600 rounded-xl" />
            <div className="h-16 bg-gray-300 dark:bg-gray-600 rounded-xl" />
          </div>
          <div className="h-10 w-full bg-gray-300 dark:bg-gray-600 rounded-xl" />
        </div>
      </div>

      {/* Optimization insight card */}
      <div className="rounded-2xl bg-gray-200 dark:bg-gray-700 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-36 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-3 w-48 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 flex-1 bg-gray-300 dark:bg-gray-600 rounded-xl" />
          <div className="h-8 w-20 bg-gray-300 dark:bg-gray-600 rounded-xl" />
        </div>
        <div className="h-2 w-28 bg-gray-300 dark:bg-gray-600 rounded mt-1" />
      </div>

      {/* Chain Distribution card */}
      <div className="rounded-2xl bg-gray-200 dark:bg-gray-700 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="h-3 w-16 bg-gray-300 dark:bg-gray-600 rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-10 w-full bg-gray-300 dark:bg-gray-600 rounded-xl" />
          <div className="h-10 w-full bg-gray-300 dark:bg-gray-600 rounded-xl" />
        </div>
      </div>

      {/* RWA Asset cards placeholder */}
      <div className="rounded-2xl bg-gray-200 dark:bg-gray-700 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 bg-gray-300 dark:bg-gray-600 rounded" />
          <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-20 bg-gray-300 dark:bg-gray-600 rounded-xl" />
          <div className="h-20 bg-gray-300 dark:bg-gray-600 rounded-xl" />
        </div>
      </div>

      {/* Advisor CTA card */}
      <div className="rounded-2xl bg-gray-200 dark:bg-gray-700 p-5 space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 bg-gray-300 dark:bg-gray-600 rounded" />
            <div className="h-3 w-44 bg-gray-300 dark:bg-gray-600 rounded" />
          </div>
        </div>
        <div className="h-10 w-full bg-gray-300 dark:bg-gray-600 rounded-xl" />
      </div>
    </div>
  );
}
