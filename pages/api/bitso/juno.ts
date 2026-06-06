import type { NextApiRequest, NextApiResponse } from 'next';
import { junoService } from '@diversifi/shared';

const MUTATING_ACTIONS = new Set(['mock-deposit', 'execute-conversion', 'redeem-mxnb']);
const isDemoMode = () => process.env.JUNO_DEMO_MODE === 'true';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET' && String(req.query.resource || 'status') === 'status') {
      return handleGet(req, res);
    }

    if (!junoService.isConfigured() && !isDemoMode()) {
      return res.status(503).json({
        error: 'Juno API credentials are not configured',
        requiredEnv: ['JUNO_API_KEY', 'JUNO_API_SECRET'],
        demoEnv: 'Set JUNO_DEMO_MODE=true to use clearly labeled demo data.',
        baseUrl: junoService.getEnvironmentBaseUrl(),
      });
    }

    if (req.method === 'GET') {
      return handleGet(req, res);
    }

    if (req.method === 'POST') {
      return handlePost(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Juno API] Request failed:', error);
    return res.status(500).json({ error: message });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const resource = String(req.query.resource || 'status');

  switch (resource) {
    case 'status':
      return res.status(200).json({
        configured: junoService.isConfigured() || isDemoMode(),
        demoMode: isDemoMode(),
        baseUrl: junoService.getEnvironmentBaseUrl(),
        mutationsEnabled: process.env.JUNO_ENABLE_MUTATIONS === 'true',
      });
    case 'balances':
      if (isDemoMode()) return res.status(200).json({ balances: demoBalances(), demoMode: true });
      return res.status(200).json({ balances: await junoService.getBalances() });
    case 'clabes':
      if (isDemoMode()) return res.status(200).json({ clabes: demoClabes(), demoMode: true });
      return res.status(200).json({ clabes: await junoService.listAutoPaymentClabes() });
    case 'banks':
      if (isDemoMode()) return res.status(200).json({ bankAccounts: demoBankAccounts(), demoMode: true });
      return res.status(200).json({ bankAccounts: await junoService.listBankAccounts() });
    case 'conversion-assets':
      if (isDemoMode()) return res.status(200).json({ assets: demoConversionAssets(), demoMode: true });
      return res.status(200).json({ assets: await junoService.getConversionAssets() });
    default:
      return res.status(400).json({
        error: 'Unsupported Juno resource',
        supportedResources: ['status', 'balances', 'clabes', 'banks', 'conversion-assets'],
      });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const action = String(req.body?.action || '');

  if (!action) {
    return res.status(400).json({ error: 'action is required' });
  }

  if (MUTATING_ACTIONS.has(action) && process.env.JUNO_ENABLE_MUTATIONS !== 'true') {
    return res.status(403).json({
      error: 'Juno mutation disabled',
      detail: 'Set JUNO_ENABLE_MUTATIONS=true to enable sandbox deposits, conversion execution, or redemptions.',
    });
  }

  switch (action) {
    case 'request-conversion': {
      if (isDemoMode()) {
        return res.status(200).json({
          quote: demoConversionQuote({
            source_asset: req.body.source_asset,
            target_asset: req.body.target_asset,
            source_amount: req.body.source_amount,
            target_amount: req.body.target_amount,
          }),
          demoMode: true,
        });
      }

      const quote = await junoService.requestConversionQuote({
        source_asset: req.body.source_asset,
        target_asset: req.body.target_asset,
        source_amount: req.body.source_amount,
        target_amount: req.body.target_amount,
      });
      return res.status(200).json({ quote });
    }
    case 'execute-conversion': {
      if (isDemoMode()) {
        return res.status(202).json({
          transaction: demoConversionTransaction(req.body.quote_id, req.body.external_ref),
          demoMode: true,
        });
      }

      const transaction = await junoService.executeConversionQuote(req.body.quote_id, req.body.external_ref);
      return res.status(202).json({ transaction });
    }
    case 'mock-deposit': {
      if (isDemoMode()) {
        return res.status(200).json({
          deposit: demoMockDeposit({
            amount: req.body.amount,
            receiver_clabe: req.body.receiver_clabe,
            receiver_name: req.body.receiver_name,
            sender_clabe: req.body.sender_clabe,
            sender_name: req.body.sender_name,
          }),
          demoMode: true,
        });
      }

      const deposit = await junoService.createMockMxnbDeposit({
        amount: req.body.amount,
        receiver_clabe: req.body.receiver_clabe,
        receiver_name: req.body.receiver_name,
        sender_clabe: req.body.sender_clabe,
        sender_name: req.body.sender_name,
      });
      return res.status(200).json({ deposit });
    }
    case 'redeem-mxnb': {
      if (isDemoMode()) {
        return res.status(200).json({
          redemption: demoRedemption(req.body.amount, req.body.destination_bank_account_id),
          demoMode: true,
        });
      }

      const redemption = await junoService.redeemMxnb({
        amount: req.body.amount,
        destination_bank_account_id: req.body.destination_bank_account_id,
        asset: 'MXN',
        idempotencyKey: req.body.idempotency_key,
      });
      return res.status(200).json({ redemption });
    }
    default:
      return res.status(400).json({
        error: 'Unsupported Juno action',
        supportedActions: ['request-conversion', 'execute-conversion', 'mock-deposit', 'redeem-mxnb'],
      });
  }
}

function demoBalances() {
  return [
    { asset: 'MXNB', total: '12500.00', available: '12500.00', on_hold: '0.00', locked: '0.00' },
    { asset: 'USDC', total: '875.00', available: '875.00', on_hold: '0.00', locked: '0.00' },
  ];
}

function demoClabes() {
  return [
    {
      clabe: '646180000000000001',
      type: 'AUTO_PAYMENT',
      status: 'ACTIVE',
      deposit_minimum_amount: '1.00',
      deposit_maximum_amounts: { daily: '100000.00', monthly: '500000.00' },
      created_at: '2026-06-07T00:00:00.000Z',
      updated_at: null,
    },
  ];
}

function demoBankAccounts() {
  return [
    {
      id: 'demo-bank-account-mx-spei',
      tag: 'Demo SPEI account',
      recipient_legal_name: 'DiversiFi Demo User',
      clabe: '646180000000000002',
      ownership: 'OWN',
    },
  ];
}

function demoConversionAssets() {
  return [
    {
      source_asset: 'USDC',
      decimal_precision: 6,
      convertible_assets: [
        {
          target_asset: 'MXNB',
          decimal_precision: 6,
          source_min_amount: '1.00',
          source_max_amount: '10000.00',
          target_min_amount: '18.00',
          target_max_amount: '180000.00',
        },
      ],
    },
    {
      source_asset: 'MXNB',
      decimal_precision: 6,
      convertible_assets: [
        {
          target_asset: 'USDC',
          decimal_precision: 6,
          source_min_amount: '18.00',
          source_max_amount: '180000.00',
          target_min_amount: '1.00',
          target_max_amount: '10000.00',
        },
      ],
    },
  ];
}

function demoConversionQuote(input: {
  source_asset?: string;
  target_asset?: string;
  source_amount?: string;
  target_amount?: string;
}) {
  const sourceAsset = input.source_asset || 'USDC';
  const targetAsset = input.target_asset || 'MXNB';
  const rate = sourceAsset === 'USDC' && targetAsset === 'MXNB' ? 18.25 : 0.0548;
  const sourceAmount = input.source_amount || (Number(input.target_amount || '1825') / rate).toFixed(2);
  const targetAmount = input.target_amount || (Number(sourceAmount) * rate).toFixed(2);

  return {
    quote_id: `demo-quote-${Date.now()}`,
    source_asset: sourceAsset,
    target_asset: targetAsset,
    source_amount: sourceAmount,
    target_amount: targetAmount,
    exchange_rate: rate.toFixed(6),
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  };
}

function demoConversionTransaction(quoteId?: string, externalRef?: string) {
  const now = new Date().toISOString();
  return {
    id: `demo-conversion-${Date.now()}`,
    created_at: now,
    updated_at: now,
    status: 'COMPLETED',
    external_ref: externalRef || 'diversifi-demo',
    type: 'CONVERSION',
    conversion: {
      quote_id: quoteId || 'demo-quote',
    },
  };
}

function demoMockDeposit(input: {
  amount?: string;
  receiver_clabe?: string;
  receiver_name?: string;
  sender_clabe?: string;
  sender_name?: string;
}) {
  return {
    amount: input.amount || '1000.00',
    tracking_code: `DEMO${Date.now()}`,
    tracking_key: `DEMO-SPEI-${Date.now()}`,
    sender_clabe: input.sender_clabe || '646180000000000003',
    sender_name: input.sender_name || 'Demo Sender',
    receiver_clabe: input.receiver_clabe || '646180000000000001',
    receiver_name: input.receiver_name || 'DiversiFi Demo User',
    created_at: new Date().toISOString(),
  };
}

function demoRedemption(amount?: number | string, destinationBankAccountId?: string) {
  const now = new Date().toISOString();
  return {
    id: `demo-redemption-${Date.now()}`,
    amount: amount || 1000,
    currency: 'MXN',
    transaction_type: 'REDEMPTION',
    method: 'SPEI',
    summary_status: 'COMPLETED',
    network: 'ARBITRUM',
    destination_bank_account_id: destinationBankAccountId || 'demo-bank-account-mx-spei',
    created_at: now,
    updated_at: now,
  };
}
