/**
 * State Service
 * Handles agent state persistence, restoration, and checkpointing
 */

import { zeroGPersistenceService } from '@diversifi/shared-0g/src/services/persistence-service';
// AgentContext type - imported inline to avoid missing module issues
export interface AgentContext {
  userId: string;
  preferences: Record<string, any>;
  riskProfile: 'LOW' | 'MEDIUM' | 'HIGH';
  lastStateHash: string;
  timestamp: number;
}

export class StateService {
    private userId?: string;
    private initialized: boolean = false;

    constructor(userId?: string) {
        this.userId = userId;
    }

    setUserId(userId: string): void {
        this.userId = userId;
    }

    getUserId(): string | undefined {
        return this.userId;
    }

    /**
     * Persist agent state to 0G DA
     */
    async persistAgentState(preferences: any = {}, riskProfile: string = 'MEDIUM'): Promise<void> {
        const typedRiskProfile = riskProfile as 'LOW' | 'MEDIUM' | 'HIGH';
        if (!this.userId) {
            console.warn('[State Service] Cannot persist state: no userId');
            return;
        }
        
        try {
            await zeroGPersistenceService.persistState({
                userId: this.userId,
                preferences,
                riskProfile: typedRiskProfile,
                lastStateHash: 'hash', // In real implementation, this would be a hash of the state
                timestamp: Date.now()
            });
        } catch (e) {
            console.error('[State Service] Persistence to 0G DA failed:', e);
            // Don't throw - persistence failure shouldn't break agent operation
        }
    }

    /**
     * Restore agent state from 0G DA
     */
    async restoreAgentState(): Promise<AgentContext | null> {
        if (!this.userId) {
            console.warn('[State Service] Cannot restore state: no userId');
            return null;
        }
        
        try {
            const state = await zeroGPersistenceService.restoreState(this.userId);
            if (state) {
                console.log('[State Service] State restored successfully from 0G DA');
                return state;
            }
            
            console.log('[State Service] No persisted state found for user');
            return null;
        } catch (e) {
            console.error('[State Service] Failed to restore state from 0G DA:', e);
            return null;
        }
    }

    /**
     * Check if state service has a userId configured
     */
    isConfigured(): boolean {
        return !!this.userId;
    }
}