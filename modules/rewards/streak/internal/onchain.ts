export type OnChainStatus = {
  isWhitelisted: boolean;
  entitlement: string;
  alreadyClaimedOnChain: boolean;
  canClaimOnChain: boolean;
};

export async function fetchOnChainStatus(address: string): Promise<OnChainStatus> {
  let onChainStatus: OnChainStatus = {
    isWhitelisted: true,
    entitlement: '0',
    alreadyClaimedOnChain: false,
    canClaimOnChain: false,
  };

  try {
    const { GoodDollarService } = await import('../../../../services/gooddollar-service');
    const service = GoodDollarService.createReadOnly();
    const eligibility = await service.checkClaimEligibility(address);

    onChainStatus = {
      isWhitelisted: eligibility.isWhitelisted,
      entitlement: eligibility.claimAmount,
      alreadyClaimedOnChain: eligibility.alreadyClaimed,
      canClaimOnChain: eligibility.canClaim,
    };
  } catch (e) {
    console.warn('[StreakRewards] On-chain check failed:', e);
  }

  return onChainStatus;
}
