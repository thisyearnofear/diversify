import React from "react";
import { Card } from "../../shared/TabComponents";

export function ConnectingState() {
  return (
    <div className="space-y-4">
      <Card className="text-center py-8">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full mb-4 flex items-center justify-center">
            <svg
              className="animate-spin w-6 h-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <p className="text-gray-600">Connecting wallet...</p>
        </div>
      </Card>
    </div>
  );
}
