import { ReactNode } from "react";
import { motion } from "framer-motion";

interface NetworkGatedContentProps {
  isCorrectNetwork: boolean;
  requiredNetwork: string;
  requiredChainId: number;
  currentChainId?: number;
  onSwitchNetwork: () => void;
  children: ReactNode;
  viewOnlyContent?: ReactNode;
}

export default function NetworkGatedContent({
  isCorrectNetwork,
  requiredNetwork,
  requiredChainId,
  currentChainId,
  onSwitchNetwork,
  children,
  viewOnlyContent,
}: NetworkGatedContentProps) {
  if (isCorrectNetwork) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* View-Only Content */}
      {viewOnlyContent && (
        <div className="mb-4">
          {viewOnlyContent}
        </div>
      )}

      {/* Interaction Overlay */}
      <div className="relative">
        {/* Blurred/Disabled Content */}
        <div className="pointer-events-none opacity-40 blur-sm">
          {children}
        </div>

        {/* Network Switch Prompt */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="bg-white dark:bg-gray-900 border-2 border-blue-500 rounded-2xl p-6 shadow-xl max-w-sm text-center">
            <div className="text-4xl mb-3">🔗</div>
            
            <h3 className="text-lg font-bold mb-2">
              Switch to {requiredNetwork}
            </h3>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {currentChainId 
                ? `You're on chain ${currentChainId}. Switch to ${requiredNetwork} (${requiredChainId}) to trade.`
                : `Connect to ${requiredNetwork} to start trading.`
              }
            </p>

            <button
              onClick={onSwitchNetwork}
              className="w-full px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition transform active:scale-95 shadow-lg shadow-blue-500/20"
            >
              Switch Network
            </button>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              You can view charts and data on any network
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
