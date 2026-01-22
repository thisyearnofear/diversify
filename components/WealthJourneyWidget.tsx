import React from 'react';
import { useWalletContext } from './WalletProvider';
import { ChainDetectionService } from '../services/swap/chain-detection.service';

interface WealthJourneyWidgetProps {
  totalValue: number;
  setActiveTab: (tab: string) => void;
  userRegion: string; // Kept for API compatibility
}

export default function WealthJourneyWidget({
  totalValue,
  setActiveTab,
  userRegion, // Unused but kept for API compatibility
}: WealthJourneyWidgetProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _userRegion = userRegion; // Mark as intentionally unused
  const { chainId } = useWalletContext();

  // Determine journey stage based on chain
  const isCelo = ChainDetectionService.isCelo(chainId);
  const isArbitrum = ChainDetectionService.isArbitrum(chainId);

  // Default stage
  let stage = 'accumulation';
  let title = 'Step 1: Accumulation';
  let description = 'Start by converting your local currency into digital dollars (stablecoins) to stop inflation loss.';
  let cta = 'Deposit cUSD';
  let action = () => setActiveTab('swap');
  let icon = '🛡️';
  let progress = 33;

  if (totalValue > 0) {
    if (isCelo) {
      stage = 'fortification';
      title = 'Step 2: Fortification';
      description = 'You have stablecoins! Now, move surplus funds to the Savings Vault (Arbitrum) to earn yield on Gold & Treasuries.';
      cta = 'Bridge to Vault';
      action = () => setActiveTab('swap'); // In a real app, this might open a specific bridge modal
      icon = '🏰';
      progress = 66;
    } else if (isArbitrum) {
      stage = 'management';
      title = 'Step 3: Wealth Management';
      description = 'Your funds are in the Savings Vault. Monitor your Real-World Assets (RWA) performance here.';
      cta = 'View Performance';
      action = () => setActiveTab('analytics');
      icon = '📈';
      progress = 100;
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-4 mb-6 relative overflow-hidden">
      {/* Progress Bar Background */}
      <div className="absolute top-0 left-0 h-1 bg-blue-100 w-full">
        <div 
          className="h-full bg-blue-600 transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-start gap-4 pt-2">
        <div className="bg-blue-50 p-3 rounded-full text-2xl flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-bold text-gray-900">{title}</h3>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              {stage === 'accumulation' ? 'Start Here' : stage === 'fortification' ? 'Recommended' : 'Active'}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            {description}
          </p>
          <button
            onClick={action}
            className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-lg transition-colors w-full sm:w-auto shadow-sm flex items-center justify-center gap-2"
          >
            {cta}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
