import { NETWORKS } from '../config';
import { AgentService } from './agent-service';
import type { SessionPermission } from './erc7715-service';

export interface ArcAgentConfig {
  userId?: string;
  privateKey?: string;
  sessionKey?: { privateKey: string; permission: SessionPermission };
  rpcUrl?: string;
  network?: any;
  spendingLimit?: number;
  isTestnet?: boolean;
}

export class ArcAgent extends AgentService {
  isProxy = false;

  constructor(config: ArcAgentConfig) {
    const isTestnet = config.isTestnet !== false;
    const resolvedNetwork = config.network ?? 'ARC';
    const defaultRpcUrl = resolvedNetwork === 'ARC'
      ? NETWORKS.ARC_TESTNET.rpcUrl
      : NETWORKS.CELO_MAINNET.rpcUrl;

    super({
      userId: config.userId,
      privateKey: config.privateKey,
      sessionKey: config.sessionKey,
      rpcUrl: config.rpcUrl ?? defaultRpcUrl,
      network: resolvedNetwork,
      spendingLimit: config.spendingLimit,
    });

    void isTestnet;
  }
}

export default ArcAgent;
