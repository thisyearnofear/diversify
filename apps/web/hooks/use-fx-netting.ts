/**
 * useFxNetting — CARICOM FX matching + settlement hook.
 *
 * Matching is read-only (POST /api/fx-netting/match). Settlement execution
 * is zero-custody: the net debtor's browser sends the cUSD transfer via the
 * connected wallet (ProviderFactoryService signer on Celo), then submits the
 * tx hash to POST /api/fx-netting/settle, which verifies it on-chain before
 * advancing both sides' intents to `settled`.
 *
 * Deep leaf import for fetchWithTimeout keeps the ethers/AI stack out of
 * first-load. ProviderFactoryService is imported lazily inside settle() for
 * the same reason.
 */

import { useCallback, useState } from 'react';
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';

const FX_NETTING_TIMEOUT_MS = 10_000;

/** cUSD on Celo mainnet (packages/shared/src/config/celo-tokens.ts). */
const CUSD_ADDRESS = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
const CUSD_DECIMALS = 18;

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
] as const;

/** Summary of the settlement-native credit profile (GET /api/fx-netting/credit-profile). */
export interface SettlementCreditProfileSummary {
  /** 300–850 when scoreable; null = thin file (honest, not an error). */
  score: number | null;
  fileStrength: 'none' | 'thin' | 'emerging' | 'established';
  settledVolumeUsd: number;
  settlementsCompleted: number;
  counterparties: number;
  summary: string;
  lendingReadiness: string;
  /** Synthetic participants (demo/observer/guardian) have no file by design. */
  synthetic: boolean;
}

export interface FxNettingMatch {
  matchId: string;
  matchedAmount: number;
  rate: number;
  savingsBps: number;
  notionalUsd: number;
  intentA: { participantId: string; sellCurrency: string; buyCurrency: string };
  intentB: { participantId: string; sellCurrency: string; buyCurrency: string };
}

export interface FxNettingResult {
  matches: FxNettingMatch[];
  totalMatchedUsd: number;
  totalSavingsUsd: number;
  /** Count of the CALLER's intents left unmatched (the caller's leg only). */
  unmatchedCount: number;
  rateSourceNote: string;
  rateDate: string | null;
  /** Size of the open pool the server matched against (hosted pool). */
  poolSize?: number;
  /** True when the run was a walletless observer dry-run — the engine ran
   *  for real against the live pool, but nothing was persisted. */
  observer?: boolean;
}

export interface FxSettlement {
  settlementId: string;
  fromParticipant: string;
  toParticipant: string;
  settlementCurrency: string;
  netAmount: number;
  chainId: number;
  status: string;
  txHash?: string;
  settledAt?: number;
}

export interface FxSettleResult {
  settlement: FxSettlement;
  intentsSettled: number;
}

export interface FxNettingInput {
  sellCurrency: string;
  sellAmount: number;
  buyCurrency: string;
}

/** Build a minimal intent payload for the match API (participantId is added server-side). */
function toIntentPayload(input: FxNettingInput, participantId: string) {
  return {
    intentId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    participantId,
    sellCurrency: input.sellCurrency.toUpperCase(),
    sellAmount: input.sellAmount,
    buyCurrency: input.buyCurrency.toUpperCase(),
    buyAmountMin: null,
    deadline: 0,
    remainingSell: input.sellAmount,
    status: 'open' as const,
    createdAt: Date.now(),
  };
}

/** Session-scoped observer id for walletless matches — never persisted as a
 *  participant (no wallet to verify), only used to exclude self-matching
 *  within this run. See /api/fx-netting/match — it strips these from the
 *  pool after upserting real, signed intents. */
const OBSERVER_PREFIX = 'observer-';
function newObserverId(): string {
  return `${OBSERVER_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
export function isObserverIntent(participantId: string): boolean {
  return participantId.startsWith(OBSERVER_PREFIX);
}

export function useFxNetting(
  userAddress: string | null,
  /** Wallet personal_sign — from useWalletContext; needed for the wallet-authed settle endpoints. */
  signMessage?: (message: string) => Promise<string>,
) {
  const [data, setData] = useState<FxNettingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settlements, setSettlements] = useState<FxSettlement[] | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [creditProfile, setCreditProfile] = useState<SettlementCreditProfileSummary | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  /**
   * Fetch the caller's settlement-native credit profile (wallet-authed).
   * Walletless visitors have no file by definition — null, not an error.
   * The thin-file shape (score: null) is DATA and is rendered as such.
   */
  const refreshCreditProfile = useCallback(async () => {
    if (!userAddress) {
      setCreditProfile(null);
      return;
    }
    try {
      const { getWalletAuthHeaders } = await import('@/lib/wallet-auth');
      const authHeaders = await getWalletAuthHeaders(userAddress, signMessage);
      if (!authHeaders) {
        setCreditProfile(null);
        return;
      }
      const res = await fetchWithTimeout(
        `${apiBase}/api/fx-netting/credit-profile`,
        { method: 'GET', headers: authHeaders },
        FX_NETTING_TIMEOUT_MS,
      );
      if (!res.ok) {
        setCreditProfile(null);
        return;
      }
      const json = await res.json();
      setCreditProfile({
        score: json.score ?? null,
        fileStrength: json.fileStrength ?? 'none',
        settledVolumeUsd: json.settledVolumeUsd ?? 0,
        settlementsCompleted: json.settlementsCompleted ?? 0,
        counterparties: json.counterparties ?? 0,
        summary: json.summary ?? '',
        lendingReadiness: json.lendingReadiness ?? '',
        synthetic: json.synthetic === true,
      });
    } catch {
      setCreditProfile(null);
    }
  }, [userAddress, signMessage, apiBase]);

  const match = useCallback(
    async (myIntent: FxNettingInput, counterpartyIntents: FxNettingInput[]) => {
      setIsLoading(true);
      setError(null);
      try {
        // Walletless visitors still get the real engine — they join the run
        // as an ephemeral observer: their intent participates in THIS match
        // run (and persists for the pool's lifetime via the server-side
        // persist window) but carries no wallet to settle with. The honest
        // state: matching works, settlement needs a wallet.
        const intents = [
          toIntentPayload(myIntent, userAddress ?? newObserverId()),
          ...counterpartyIntents.map((c, i) =>
            toIntentPayload(c, `0x_counterparty_${i}`),
          ),
        ];

        const res = await fetchWithTimeout(
          `${apiBase}/api/fx-netting/match`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intents }),
          },
          FX_NETTING_TIMEOUT_MS,
        );
        if (!res.ok) throw new Error(`fx-netting ${res.status}`);
        const json = await res.json();
        setData({
          matches: json.matches ?? [],
          totalMatchedUsd: json.totalMatchedUsd ?? 0,
          totalSavingsUsd: json.totalSavingsUsd ?? 0,
          unmatchedCount: json.unmatchedIntents?.length ?? 0,
          rateSourceNote: json.rateSourceNote ?? '',
          rateDate: json.rateDate ?? null,
          poolSize: json.poolSize,
          observer: json.observer === true,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to match FX intents');
      } finally {
        setIsLoading(false);
      }
    },
    [userAddress, apiBase],
  );
  /** Load the caller's settlements (debtor worklist + creditor inbox). */
  const refreshSettlements = useCallback(async () => {
    if (!userAddress) {
      setSettlements(null);
      return;
    }
    try {
      const { getWalletAuthHeaders } = await import('@/lib/wallet-auth');
      const authHeaders = await getWalletAuthHeaders(userAddress, signMessage);
      if (!authHeaders) {
        setSettlements(null);
        return;
      }
      const res = await fetchWithTimeout(
        `${apiBase}/api/fx-netting/settle`,
        { method: 'GET', headers: authHeaders },
        FX_NETTING_TIMEOUT_MS,
      );
      if (!res.ok) {
        setSettlements(null);
        return;
      }
      const json = await res.json();
      setSettlements(json.settlements ?? []);
    } catch {
      setSettlements(null);
    }
  }, [userAddress, signMessage, apiBase]);

  /**
   * Execute a pending settlement as the net debtor (zero-custody):
   *   1. switch the wallet to Celo mainnet
   *   2. send cUSD transfer(to = creditor, amount = netAmount) from the
   *      user's own wallet
   *   3. submit the tx hash to /api/fx-netting/settle for on-chain
   *      verification + intent advancement + FX_SETTLE ledger anchor
   */
  const settle = useCallback(
    async (settlement: FxSettlement): Promise<FxSettleResult | null> => {
      if (!userAddress) {
        setSettleError('Connect your wallet to settle');
        return null;
      }
      setIsSettling(true);
      setSettleError(null);
      try {
        // Lazily pull the signer stack — keeps ethers out of first-load.
        const { ethers } = await import('ethers');
        const { ProviderFactoryService } = await import(
          '@diversifi/shared/src/services/swap/provider-factory.service'
        );

        const signer = await ProviderFactoryService.getSigner();
        const signerAddress = (await signer.getAddress()).toLowerCase();
        if (signerAddress !== userAddress.toLowerCase()) {
          throw new Error('Connected wallet must be the settlement debtor');
        }
        if (signerAddress !== settlement.fromParticipant.toLowerCase()) {
          throw new Error('This wallet is not the debtor for this settlement');
        }

        // Ensure we're on the settlement chain (Celo). The wallet may prompt;
        // a user rejection surfaces as an error to retry.
        const currentChain = await ProviderFactoryService.getCurrentChainId();
        if (currentChain !== settlement.chainId) {
          const { getAddChainParameter, toHexChainId } = await import(
            '@diversifi/shared/src/modules/wallet/core/chains'
          );
          const { getWalletProvider } = await import(
            '@diversifi/shared/src/modules/wallet/core/provider-registry'
          );
          const rawProvider = await getWalletProvider();
          if (!rawProvider) throw new Error('Wallet provider unavailable');
          const request = (rawProvider as unknown as {
            request: (a: unknown) => Promise<unknown>;
          }).request.bind(rawProvider);
          try {
            await request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: toHexChainId(settlement.chainId) }],
            });
          } catch {
            // Chain not added yet — add it, then switch.
            await request({
              method: 'wallet_addEthereumChain',
              params: [getAddChainParameter(settlement.chainId)],
            });
            await request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: toHexChainId(settlement.chainId) }],
            });
          }
          // The Web3Provider cache holds the pre-switch instance; clear it
          // so the signer below binds to the post-switch provider.
          ProviderFactoryService.clearWeb3Cache();
        }

        // cUSD transfer from the user's own wallet — the zero-custody leg.
        const cusd = new ethers.Contract(
          CUSD_ADDRESS,
          ERC20_ABI,
          signer,
        );
        const amount = settlement.netAmount.toFixed(6);
        const amountRaw = ethers.utils.parseUnits(amount, CUSD_DECIMALS);
        const tx = await cusd.transfer(settlement.toParticipant, amountRaw, {
          gasLimit: 100_000,
        });
        const receipt = await tx.wait(1);

        // Submit for server-side on-chain verification + ledger anchor.
        const { getWalletAuthHeaders } = await import('@/lib/wallet-auth');
        const authHeaders = await getWalletAuthHeaders(userAddress, signMessage);
        if (!authHeaders) throw new Error('Wallet signature required to confirm settlement');

        const res = await fetchWithTimeout(
          `${apiBase}/api/fx-netting/settle`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
              settlementId: settlement.settlementId,
              txHash: receipt.transactionHash,
            }),
          },
          FX_NETTING_TIMEOUT_MS,
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? `fx-netting settle ${res.status}`);
        }
        const result: FxSettleResult = {
          settlement: json.settlement,
          intentsSettled: json.intentsSettled ?? 0,
        };
        void refreshSettlements();
        return result;
      } catch (e) {
        setSettleError(e instanceof Error ? e.message : 'Failed to settle');
        return null;
      } finally {
        setIsSettling(false);
      }
    },
    [userAddress, signMessage, apiBase, refreshSettlements],
  );

  return {
    data,
    isLoading,
    error,
    match,
    settlements,
    refreshSettlements,
    settle,
    isSettling,
    settleError,
    creditProfile,
    refreshCreditProfile,
  };
}
