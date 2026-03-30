type AutonomousRecommendation = {
  action?: string;
  targetToken?: string;
  targetNetwork?: string;
};

export class GuardianPolicyService {
  static canExecuteAutonomously(
    recommendation: AutonomousRecommendation,
    spendingLimit: number,
  ): { allowed: boolean; reason?: string } {
    if (spendingLimit <= 0) {
      return { allowed: false, reason: 'Spending limit is zero' };
    }

    if (!recommendation.action) {
      return { allowed: false, reason: 'No recommended action returned' };
    }

    if (recommendation.action === 'SWAP' && !recommendation.targetToken) {
      return { allowed: false, reason: 'Swap recommendation missing target token' };
    }

    if (recommendation.action === 'BRIDGE' && !recommendation.targetNetwork) {
      return { allowed: false, reason: 'Bridge recommendation missing target network' };
    }

    return { allowed: true };
  }
}
