import { Contract, providers, utils } from 'ethers';
import { getTokenAddresses, NETWORKS } from '../../config';
import { instrumentOn } from '../../config/exposures';
import type { AllocationHolding, AllocationSnapshot } from './allocation-optimizer';

const CHAINS = [
  { id: 42220, rpc: NETWORKS.CELO_MAINNET.rpcUrl, api: 'https://celo.blockscout.com/api/v2', platform: 'celo' },
  { id: 42161, rpc: NETWORKS.ARBITRUM_ONE.rpcUrl, api: 'https://arbitrum.blockscout.com/api/v2', platform: 'arbitrum-one' },
] as const;
const ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
async function deadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Wallet evidence deadline exceeded')), ms);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
async function json(url: string, fetcher: typeof fetch) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Wallet evidence HTTP ${response.status}`);
  return response.json();
}
export interface SnapshotReaders {
  fetcher: typeof fetch;
  readBlock: (chainId: number, rpc: string) => Promise<{ number: number; timestamp: number }>;
  readToken: (chainId: number, rpc: string, token: string, address: string, blockNumber: number) =>
    Promise<{ raw: string; decimals: number }>;
}
const readers: SnapshotReaders = {
  fetcher: (...args) => fetch(...args),
  async readBlock(chainId, rpc) {
    const provider = new providers.StaticJsonRpcProvider({ url: rpc, timeout: 8000 }, chainId);
    const block = await provider.getBlock('latest');
    return { number: block.number, timestamp: block.timestamp * 1000 };
  },
  async readToken(chainId, rpc, token, address, blockNumber) {
    const provider = new providers.StaticJsonRpcProvider({ url: rpc, timeout: 8000 }, chainId);
    const contract = new Contract(token, ABI, provider);
    const [balance, decimals] = await Promise.all([
      contract.balanceOf(address, { blockTag: blockNumber }),
      contract.decimals({ blockTag: blockNumber }),
    ]);
    return { raw: balance.toString(), decimals: Number(decimals) };
  },
};

/** Savings scope is explicit, not total wallet wealth: curated ERC-20 assets
 * on Celo/Arbitrum; native gas excluded. Indexer discovery is not an exhaustive
 * on-chain asset inventory. Unknown funded ERC-20 assets fail this scope closed.
 * Known balances are independently read at a recent pinned block on each chain.
 */
export async function readAllocationSnapshot(address: string, deps = readers, now = Date.now()): Promise<
  AllocationSnapshot & { scope: string; errors: string[]; blocks: { chainId: number; number: number; timestamp: number }[] }
> {
  if (!utils.isAddress(address) || /^0x0{40}$/i.test(address) || !Number.isFinite(now) || now <= 0) {
    throw new Error('Invalid verified wallet address or evidence time');
  }
  const results = await Promise.all(CHAINS.map(async (chain) => {
    try {
      const work = async () => {
        const [discovered, block] = await Promise.all([
          json(`${chain.api}/addresses/${address}/token-balances`, deps.fetcher),
          deadline(deps.readBlock(chain.id, chain.rpc), 8000),
        ]);
        if (!Array.isArray(discovered) || !Number.isSafeInteger(block.number) || block.number < 0 ||
            !Number.isFinite(block.timestamp) || block.timestamp <= 0 ||
            block.timestamp > now + 30_000 || now - block.timestamp > 120_000) {
          throw new Error('Invalid or stale wallet discovery/block evidence');
        }
        const tokenMap = getTokenAddresses(chain.id);
        const nativeGasAddress = chain.id === 42220 ? tokenMap.CELO?.toLowerCase() : undefined;
        const known = Object.entries(tokenMap)
          .filter(([symbol]) => symbol !== 'CELO')
          .filter(([, a]) => utils.isAddress(a) && !/^0x0{40}$/i.test(a))
          .filter(([, a], i, all) => all.findIndex(([, b]) => b.toLowerCase() === a.toLowerCase()) === i);
        const discoveredAddresses = new Set<string>();
        for (const row of discovered) {
          if (!row?.token || typeof row.token.type !== 'string') throw new Error('Malformed discovery row');
          if (row.token.type !== 'ERC-20') continue;
          const token = row.token.address_hash;
          if (typeof token !== 'string' || !utils.isAddress(token) || discoveredAddresses.has(token.toLowerCase()) ||
              typeof row.value !== 'string' || !/^\d+$/.test(row.value)) throw new Error('Invalid or duplicate indexer balance');
          discoveredAddresses.add(token.toLowerCase());
          if (token.toLowerCase() === nativeGasAddress) continue;
          if (BigInt(row.value) > 0n && !known.some(([, a]) => a.toLowerCase() === token.toLowerCase())) {
            throw new Error('Unrecognized positive ERC-20 holding; savings coverage incomplete');
          }
        }
        // Four token reads at a time, including indexer-zero entries so lag
        // cannot conceal newly acquired supported assets.
        const measured: { symbol: string; token: string; balance: number; rawBalance: string; decimals: number }[] = [];
        for (let offset = 0; offset < known.length; offset += 4) {
          const batch = await Promise.all(known.slice(offset, offset + 4).map(async ([symbol, token]) => {
            const result = await deadline(deps.readToken(chain.id, chain.rpc, token, address, block.number), 8000);
            if (typeof result.raw !== 'string' || !/^\d+$/.test(result.raw) ||
                !Number.isInteger(result.decimals) || result.decimals < 0 || result.decimals > 36) {
              throw new Error('Invalid RPC token balance or decimals');
            }
            if (BigInt(result.raw) === 0n) return null;
            if (!instrumentOn(symbol, chain.id)) throw new Error(`Unclassified funded asset ${symbol}`);
            const balance = Number(utils.formatUnits(result.raw, result.decimals));
            if (!Number.isFinite(balance) || balance <= 0) throw new Error('Balance exceeds supported numeric precision');
            return { symbol, token, balance, rawBalance: result.raw, decimals: result.decimals };
          }));
          measured.push(...batch.filter((h): h is NonNullable<typeof h> => h !== null));
        }
        let holdings: AllocationHolding[] = [];
        if (measured.length) {
          const prices = await json(`https://api.coingecko.com/api/v3/simple/token_price/${chain.platform}?contract_addresses=${measured.map((h) => h.token).join(',')}&vs_currencies=usd&include_last_updated_at=true`, deps.fetcher);
          holdings = measured.map((h) => {
            const price = prices?.[h.token.toLowerCase()];
            const priceAsOf = price?.last_updated_at * 1000;
            if (typeof price?.usd !== 'number' || !Number.isFinite(price.usd) || price.usd <= 0 ||
                typeof price.last_updated_at !== 'number' || !Number.isFinite(priceAsOf) || priceAsOf <= 0 ||
                priceAsOf > now || now - priceAsOf > 300000 || !Number.isFinite(h.balance * price.usd)) {
              throw new Error(`Missing or stale price for ${h.symbol}`);
            }
            return { symbol: h.symbol, chainId: chain.id, tokenAddress: h.token,
              balance: h.balance, rawBalance: h.rawBalance, decimals: h.decimals,
              valueUsd: h.balance * price.usd, priceUsd: price.usd, priceAsOf,
              priceSource: `coingecko:${chain.platform}:${h.token.toLowerCase()}` };
          });
        }
        return { holdings, block: { chainId: chain.id, ...block }, error: null };
      };
      return await deadline(work(), 30000);
    } catch (error) {
      return { holdings: [] as AllocationHolding[], block: null,
        error: `${chain.id}: ${error instanceof Error ? error.message : 'read failed'}` };
    }
  }));
  const errors = results.flatMap((r) => r.error ? [r.error] : []);
  const holdings = results.flatMap((r) => r.holdings).sort((a, b) => a.chainId - b.chainId || a.symbol.localeCompare(b.symbol));
  return { address: address.toLowerCase(), capturedAt: now, complete: !errors.length,
    estimated: false, holdings,
    blocks: results.flatMap((r) => r.block ? [r.block] : []),
    scope: 'Curated ERC-20 savings on Celo and Arbitrum; native gas and other networks excluded; indexer discovery is not an exhaustive asset inventory',
    errors };
}
