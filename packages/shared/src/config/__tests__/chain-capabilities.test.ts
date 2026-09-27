import { describe, expect, it } from 'vitest';
import { NETWORKS, getTokenAddresses } from '../index';
import {
  chainsWith,
  getChainCapabilities,
  getSwapExecutableChainIds,
  GUARDIAN_LIMIT_CHAIN_IDS,
  AUTONOMY_KIT_CHAIN_IDS,
  WALLET_ADDABLE_CHAIN_IDS,
} from '../chain-capabilities';
import { ChainDetectionService } from '../../services/swap/chain-detection.service';
import { SUPPORTED_CHAIN_IDS, isSupportedChainId } from '../../modules/wallet/core/chains';

const ALL = Object.values(NETWORKS).map((n) => n.chainId);

describe('chain-capability matrix — invariants', () => {
  it('every swap-executable chain is wallet-addable, has an RPC and an explicit token map', () => {
    for (const id of getSwapExecutableChainIds()) {
      const c = getChainCapabilities(id);
      expect(c.walletAddable, `${id} walletAddable`).toBe(true);
      expect(c.hasRpc, `${id} hasRpc`).toBe(true);
      // Never execute on the silent Celo fallback.
      expect(c.hasTokenMap, `${id} hasTokenMap`).toBe(true);
    }
  });

  it('a daily limit is only offered where the app can execute the proposal', () => {
    for (const id of GUARDIAN_LIMIT_CHAIN_IDS) {
      expect(getChainCapabilities(id).swapExecutable, `${id}`).toBe(true);
    }
  });

  it('autonomy is only possible where a daily limit can be signed', () => {
    for (const id of AUTONOMY_KIT_CHAIN_IDS) {
      expect(getChainCapabilities(id).guardianLimit, `${id}`).toBe(true);
    }
  });

  it('an unknown chain has no capability at all', () => {
    const c = getChainCapabilities(999_999);
    expect(c).toMatchObject({
      known: false,
      hasTokenMap: false,
      walletAddable: false,
      swapExecutable: false,
      guardianLimit: false,
      autonomyKit: false,
    });
    expect(getChainCapabilities(null).known).toBe(false);
  });

  it('hasTokenMap is exactly the chains getTokenAddresses answers for itself', () => {
    const celo = getTokenAddresses(NETWORKS.CELO_MAINNET.chainId);
    for (const id of ALL) {
      const c = getChainCapabilities(id);
      if (!c.hasTokenMap) {
        // No explicit map ⇒ the call returns Celo's (the fallback phase 2 removes).
        expect(getTokenAddresses(id), `${id}`).toBe(celo);
      }
    }
  });

  it('Arc mainnet stays a settlement rail — never a wallet/swap venue', () => {
    const c = getChainCapabilities(NETWORKS.ARC_MAINNET.chainId);
    expect(c.walletAddable).toBe(false);
    expect(c.swapExecutable).toBe(false);
  });

  it('retired Celo Alfajores (44787) is not a daily-limit chain; Celo Sepolia is', () => {
    expect(GUARDIAN_LIMIT_CHAIN_IDS).not.toContain(44787);
    expect(GUARDIAN_LIMIT_CHAIN_IDS).toContain(NETWORKS.CELO_SEPOLIA.chainId);
  });
});

describe('chain-capability matrix — legacy exports delegate to one table', () => {
  it('ChainDetectionService.isSupported === swapExecutable', () => {
    for (const id of [...ALL, 999_999]) {
      expect(ChainDetectionService.isSupported(id), `${id}`).toBe(getChainCapabilities(id).swapExecutable);
    }
  });

  it('wallet isSupportedChainId / SUPPORTED_CHAIN_IDS === walletAddable', () => {
    expect([...SUPPORTED_CHAIN_IDS]).toEqual([...WALLET_ADDABLE_CHAIN_IDS]);
    for (const id of [...ALL, 999_999]) {
      expect(isSupportedChainId(id), `${id}`).toBe(getChainCapabilities(id).walletAddable);
    }
    expect(chainsWith('walletAddable').sort()).toEqual([...WALLET_ADDABLE_CHAIN_IDS].sort());
  });
});
