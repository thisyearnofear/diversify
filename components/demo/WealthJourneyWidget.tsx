import React from 'react';
import { useWalletContext } from '../wallet/WalletProvider';
import { ChainDetectionService } from '../../services/swap/chain-detection.service';

interface WealthJourneyWidgetProps {
  totalValue: number;
  setActiveTab: (tab: import("@/constants/tabs").TabId) => void;
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
  let cta = 'Deposit USDm';
  let action = () => setActiveTab('swap');
  let icon = '🛡️';
  let progress = 33;

  if (totalValue > 0) {
    if (isCelo) {
      stage = 'fortification';
      title = 'Step 2: Fortification';
      description = 'You have stablecoins! Now, move surplus funds to Arbitrum (RWAs) to earn yield on Gold & Treasuries.';
      cta = 'Bridge to RWAs';
      action = () => setActiveTab('swap'); // In a real app, this might open a specific bridge modal
      icon = '🏰';
      progress = 66;
    } else if (isArbitrum) {
      stage = 'management';
      title = 'Step 3: Wealth Management';
      description = 'Your funds are on Arbitrum (RWAs). Monitor your Real-World Assets performance here.';
      cta = 'View Performance';
      // NOTE: Analytics tab is no longer part of the main navigation.
      // Route to Overview which contains portfolio/performance surface area.
      action = () => setActiveTab('overview');
      icon = '📈';
      progress = 100;
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-6 relative overflow-hidden group">
      {/* Progress Bar Background */}
      <div className="absolute top-0 left-0 h-1.5 bg-gray-50 dark:bg-gray-900 w-full">
        <div
          className="h-full bg-blue-600 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(37,99,235,0.5)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-start gap-4 pt-2">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl text-2xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1.5">
            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{title}</h3>
            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {stage === 'accumulation' ? 'START' : stage === 'fortification' ? 'RECOMMENDED' : 'ACTIVE'}
            </span>
          </div>
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-4 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
            {description}
          </p>
          <button
            onClick={action}
            className="text-[10px] font-black uppercase tracking-[0.1em] text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 py-2.5 px-5 rounded-xl transition-all w-full sm:w-auto shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 hover:translate-x-1"
          >
            {cta}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
