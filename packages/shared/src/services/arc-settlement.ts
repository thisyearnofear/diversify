/**
 * Arc On-Chain Settlement
 *
 * Sends real USDC micro-payments on Arc testnet for each paid research request.
 * Uses the VAULT_PRIVATE_KEY EOA — no Circle entity secret required.
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Plugs into existing verifyCircleGatewayPayment path
 * - SINGLE RESPONSIBILITY: Only handles Arc EOA settlement, nothing else
 * - PERFORMANT: Non-blocking — fires tx and returns hash immediately, does not
 *   wait for confirmation so gateway latency is unaffected
 * - DRY: ARC_RPC and USDC address come from shared config, never duplicated
 */

import { ethers } from 'ethers';
import { ARC_DATA_HUB_CONFIG, ARC_TOKENS } from '../config';

// Minimal ERC-20 ABI — transfer only
const ERC20_TRANSFER_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
] as const;

const ARC_RPC   = process.env.ARC_RPC_URL            || 'https://rpc.testnet.arc.network';
const USDC_ADDR = ARC_TOKENS.USDC;                    // 0x3600...0000
const HUB_ADDR  = process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS;

// Lazily initialised — one provider + signer for the lifetime of the process
let _provider: ethers.providers.JsonRpcProvider | null = null;
let _signer:   ethers.Wallet | null = null;
let _usdc:     ethers.Contract | null = null;
let _ready:    boolean | null = null; // null = unchecked, true/false = result

function getContracts(): { provider: ethers.providers.JsonRpcProvider; signer: ethers.Wallet; usdc: ethers.Contract } | null {
    if (_ready === false) return null;

    const key = process.env.VAULT_PRIVATE_KEY;
    if (!key) {
        _ready = false;
        console.warn('[ArcSettlement] VAULT_PRIVATE_KEY not set — on-chain settlement disabled');
        return null;
    }

    if (!_provider) {
        _provider = new ethers.providers.JsonRpcProvider(ARC_RPC);
        _signer   = new ethers.Wallet(key, _provider);
        _usdc     = new ethers.Contract(USDC_ADDR, ERC20_TRANSFER_ABI, _signer);
    }

    return { provider: _provider, signer: _signer!, usdc: _usdc! };
}

export interface SettlementResult {
    txHash: string;
    amount: string;       // USDC, e.g. "0.001"
    explorer: string;     // Arc testnet explorer link
    settled: true;
}

export interface SettlementSkipped {
    settled: false;
    reason: string;
}

/**
 * Check whether the agent wallet has enough USDC to settle.
 * Returns balance in human-readable USDC or null if unavailable.
 */
export async function getAgentUSDCBalance(): Promise<string | null> {
    try {
        const c = getContracts();
        if (!c) return null;
        const raw: ethers.BigNumber = await c.usdc.balanceOf(c.signer.address);
        return ethers.utils.formatUnits(raw, 6);
    } catch {
        return null;
    }
}

export function getAgentAddress(): string | null {
    const key = process.env.VAULT_PRIVATE_KEY;
    if (!key) return null;
    try {
        return new ethers.Wallet(key).address;
    } catch {
        return null;
    }
}

/**
 * Settle a micro-payment on Arc by sending `amountUSDC` from the agent EOA
 * to the data-hub recipient. Fire-and-forget: returns the tx hash without
 * waiting for confirmation so the gateway response stays fast.
 *
 * Returns SettlementSkipped if the wallet is unfunded or the key is missing.
 */
export async function settleOnArc(
    amountUSDC: number,
    sourceId: string,
): Promise<SettlementResult | SettlementSkipped> {
    const c = getContracts();
    if (!c) return { settled: false, reason: 'No agent wallet configured' };

    // Minimum settlement: 0.001 USDC (1000 micro-USDC)
    const micro = Math.max(0.001, Math.min(amountUSDC, 0.01));
    const raw   = ethers.utils.parseUnits(micro.toFixed(6), 6);

    try {
        // Non-blocking balance pre-check to avoid wasting a nonce on a doomed tx
        const balance: ethers.BigNumber = await c.usdc.balanceOf(c.signer.address);
        if (balance.lt(raw)) {
            return {
                settled: false,
                reason: `Insufficient USDC balance (${ethers.utils.formatUnits(balance, 6)} < ${micro})`,
            };
        }

        // Send — do NOT await mining; return the hash immediately
        const tx: ethers.providers.TransactionResponse = await c.usdc.transfer(HUB_ADDR, raw, {
            gasLimit: 80_000,
        });

        const result: SettlementResult = {
            txHash:   tx.hash,
            amount:   micro.toFixed(6),
            explorer: `https://testnet.arcscan.app/tx/${tx.hash}`,
            settled:  true,
        };

        console.log(`[ArcSettlement] ✅ ${sourceId} → ${micro} USDC → ${tx.hash}`);

        // Mine in background so we get a receipt for logging — does not block response
        tx.wait(1).then(receipt => {
            console.log(`[ArcSettlement] ⛏  confirmed block ${receipt.blockNumber}: ${tx.hash}`);
        }).catch(err => {
            console.warn(`[ArcSettlement] tx ${tx.hash} mining warning:`, err.message);
        });

        return result;
    } catch (err: any) {
        console.error('[ArcSettlement] transfer failed:', err.message);
        return { settled: false, reason: err.message };
    }
}
