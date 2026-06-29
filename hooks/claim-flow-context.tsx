import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useClaimFlow, ClaimFlowOverlay, type ClaimFlow } from './use-claim-flow';
import { useNavigation } from '@/context/app/NavigationContext';

const ClaimFlowContext = createContext<ClaimFlow | null>(null);

export function ClaimFlowProvider({ children }: { children: React.ReactNode }) {
  const { setActiveTab } = useNavigation();
  const handleProtect = useCallback(() => {
    setActiveTab('protect');
  }, [setActiveTab]);
  const flow = useClaimFlow({ onProtect: handleProtect });
  return (
    <ClaimFlowContext.Provider value={flow}>
      {children}
      <ClaimFlowOverlay flow={flow} onProtect={handleProtect} />
    </ClaimFlowContext.Provider>
  );
}

export function useClaimFlowContext(): ClaimFlow {
  const ctx = useContext(ClaimFlowContext);
  if (!ctx) throw new Error('useClaimFlowContext must be used within ClaimFlowProvider');
  return ctx;
}

export function useOnClaimSuccess(cb: () => void) {
  const flow = useClaimFlowContext();
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    if (flow.claimStatus === 'success') {
      cbRef.current();
    }
  }, [flow.claimStatus]);
}
