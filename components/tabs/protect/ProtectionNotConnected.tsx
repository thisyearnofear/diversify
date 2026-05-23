/**
 * ProtectionNotConnected — Shown when the user has no wallet connected.
 * Single-purpose, self-contained, zero logic.
 */
import React from "react";
import { Card, ConnectWalletPrompt } from "../../shared/TabComponents";
import WalletButton from "../../wallet/WalletButton";
import { USER_GOALS } from "@/hooks/use-protection-profile";
import type { UserExperienceMode } from "@/context/app/types";

interface Props {
  experienceMode: UserExperienceMode;
}

export function ProtectionNotConnected({ experienceMode }: Props) {
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">
              Protection Plan
            </h3>
            <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">
              Build your inflation protection plan
            </p>
          </div>
          <span className="text-3xl">🤖</span>
        </div>
        <ConnectWalletPrompt
          message="Connect your wallet to analyze your portfolio across Arbitrum and Celo against real-time global inflation data."
          WalletButtonComponent={<WalletButton variant="inline" />}
          experienceMode={experienceMode}
        />
      </Card>

      {/* Preview of goals */}
      <Card className="bg-gray-50 border-dashed border-2 p-4">
        <h4 className="text-xs font-black uppercase text-gray-400 mb-4 tracking-widest text-center">
          Available Protection Goals
        </h4>
        <div className="grid grid-cols-2 gap-2 opacity-50">
          {USER_GOALS.map((goal) => (
            <div
              key={goal.value}
              className="p-3 bg-white rounded-xl text-center shadow-md"
            >
              <div className="text-xl mb-1">{goal.icon}</div>
              <div className="text-xs font-black uppercase text-gray-900">
                {goal.label}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
