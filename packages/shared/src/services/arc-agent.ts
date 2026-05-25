import { NETWORKS } from '../config';
import { AgentService } from './agent-service';
import type { SessionPermission } from './erc7715-service';

export interface ArcAgentConfig {
  userId?: string;
  privateKey?: string;
  sessionKey?: { privateKey: string; permission: SessionPermission };
  circleWalletId?: string;
  circleApiKey?: string;
  circleEntitySecret?: string;
  circleBaseUrl?: string;
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
      circleWalletId: config.circleWalletId,
      circleApiKey: config.circleApiKey,
      circleEntitySecret: config.circleEntitySecret,
      circleBaseUrl: config.circleBaseUrl,
      rpcUrl: config.rpcUrl ?? defaultRpcUrl,
      network: resolvedNetwork,
      spendingLimit: config.spendingLimit,
    });

    void isTestnet;
  }
}

export default ArcAgent;
