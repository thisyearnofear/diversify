import type { NextApiRequest, NextApiResponse } from 'next';
import { getAgentAddress, getAgentUSDCBalance } from '@diversifi/shared';
import { getLedgerContractAddress } from '../../../packages/shared/src/services/recommendation-ledger.service';

interface CapabilityStatus {
  available: boolean;
  mode: 'live' | 'demo' | 'unavailable';
  detail: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const zeroGStorageConfigured = !!process.env.ZERO_G_STORAGE_URL;
  const zeroGServingConfigured = !!process.env.ZERO_G_SERVING_API_KEY;
  const ledgerAddress = getLedgerContractAddress();
  const agentAddress = getAgentAddress();
  const hasCircleFlow = !!(process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET);
  const hasLegacyAgentKey = !!process.env.ARC_AGENT_PRIVATE_KEY;
  const hasSessionPermissionFlow = true;

  const autonomousExecution: CapabilityStatus = hasCircleFlow || hasLegacyAgentKey || hasSessionPermissionFlow
    ? {
        available: true,
        mode: hasCircleFlow || hasLegacyAgentKey ? 'live' : 'demo',
        detail: hasCircleFlow
          ? 'Agent Fuel and wallet-backed execution available.'
          : hasLegacyAgentKey
            ? 'Legacy wallet-backed execution available.'
            : 'Execution path is available through signed session permissions.',
      }
    : {
        available: false,
        mode: 'unavailable',
        detail: 'No agent execution credentials are configured.',
      };

  const payments: CapabilityStatus = agentAddress
    ? {
        available: true,
        mode: 'live',
        detail: 'Arc x402 settlement wallet is configured for real micropayments.',
      }
    : {
        available: false,
        mode: 'unavailable',
        detail: 'Arc settlement wallet is not configured.',
      };

  const storage: CapabilityStatus = zeroGStorageConfigured
    ? {
        available: true,
        mode: process.env.VAULT_PRIVATE_KEY ? 'live' : 'demo',
        detail: process.env.VAULT_PRIVATE_KEY
          ? '0G Storage evidence anchoring is configured.'
          : '0G Storage endpoint is configured, but uploads may fall back in development.',
      }
    : {
        available: false,
        mode: 'unavailable',
        detail: '0G Storage is not configured.',
      };

  const serving: CapabilityStatus = {
    available: true,
    mode: zeroGServingConfigured ? 'live' : 'demo',
    detail: zeroGServingConfigured
      ? '0G Serving is configured in the AI failover chain.'
      : 'AI module remains usable via Gemini/Venice fallback providers.',
  };

  const ledger: CapabilityStatus = ledgerAddress
    ? {
        available: true,
        mode: process.env.VAULT_PRIVATE_KEY ? 'live' : 'demo',
        detail: '0G Recommendation Ledger contract is configured.',
      }
    : {
        available: false,
        mode: 'unavailable',
        detail: '0G Recommendation Ledger contract is not configured.',
      };

  const agentBalance = agentAddress ? await getAgentUSDCBalance().catch(() => null) : null;

  return res.status(200).json({
    module: {
      name: 'DiversiFi Autonomous AI Module',
      focus: 'Autonomous portfolio analysis, paid research acquisition, and verifiable execution traces.',
      entrypoints: {
        analysis: '/api/agent/deep-analyze',
        payments: '/api/agent/x402-metrics',
        ledger: '/api/agent/zero-g-ledger',
      },
    },
    capabilities: {
      autonomousExecution,
      payments,
      storage,
      serving,
      ledger,
    },
    proofs: {
      agentAddress,
      agentUSDCBalance: agentBalance,
      ledgerContractAddress: ledgerAddress || null,
    },
    recommendedDemoFlow: [
      'Run an autonomous analysis request.',
      'Show the Arc settlement metrics endpoint for payment proof.',
      'Show the 0G ledger endpoint for recommendation traceability.',
    ],
  });
}
