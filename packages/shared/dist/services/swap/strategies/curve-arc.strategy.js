"use strict";
/**
 * Curve Finance Arc Testnet Strategy
 * Direct integration with Curve Finance on Arc Testnet
 * Implements seamless USDC/EURC swaps using Curve's stable swap pools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurveArcStrategy = void 0;
const ethers_1 = require("ethers");
const base_swap_strategy_1 = require("./base-swap.strategy");
const provider_factory_service_1 = require("../provider-factory.service");
const chain_detection_service_1 = require("../chain-detection.service");
const config_1 = require("../../../config");
const curve_discovery_service_1 = require("../curve-discovery.service");
// Curve Finance contract addresses on Arc Testnet
// These are hardcoded for direct integration as we've verified them on-chain
const CURVE_ARC_CONTRACTS = {
    // Verified USDC/EURC pool on Arc Testnet
    USDC_EURC_POOL: '0x2D84D79C852f6842AbE0304b70bBaA1506AdD457',
    // Fallback: Use Curve's web interface via iframe or redirect
    WEB_INTERFACE: 'https://curve.fi/dex/arc/swap/',
};
// Curve Router ABI (minimal for swaps)
const CURVE_ROUTER_ABI = [
    // Exchange function for token swaps
    'function exchange(address[11] route, uint256[5][5] swap_params, uint256 amount, uint256 expected, address[5] pools, address receiver) payable returns (uint256)',
    // Get exchange rate
    'function get_dy(address[11] route, uint256[5][5] swap_params, uint256 amount, address[5] pools) view returns (uint256)',
    // Get exchange amount needed for specific output
    'function get_dx(address[11] route, uint256[5][5] swap_params, uint256 amount, address[5] pools) view returns (uint256)',
];
// Curve Stable Pool ABI (for direct pool interaction)
const CURVE_POOL_ABI = [
    'function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) returns (uint256)',
    'function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)',
    'function coins(uint256 i) view returns (address)',
    'function balances(uint256 i) view returns (uint256)',
];
// Curve AddressProvider ABI
const ADDRESS_PROVIDER_ABI = [
    'function get_registry() view returns (address)',
    'function get_address(uint256 id) view returns (address)',
];
class CurveArcStrategy extends base_swap_strategy_1.BaseSwapStrategy {
    getName() {
        return 'CurveArcStrategy';
    }
    supports(params) {
        // Only supports Arc Testnet USDC/EURC swaps
        return (chain_detection_service_1.ChainDetectionService.isArc(params.fromChainId) &&
            params.fromChainId === params.toChainId &&
            ((params.fromToken === 'USDC' && params.toToken === 'EURC') ||
                (params.fromToken === 'EURC' && params.toToken === 'USDC')));
    }
    async validate(params) {
        // Check if tokens exist on Arc Testnet
        const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken];
        const toTokenAddress = tokens[params.toToken];
        if (!fromTokenAddress || !toTokenAddress) {
            throw new Error(`Token pair ${params.fromToken}/${params.toToken} not available on Arc Testnet`);
        }
        return true;
    }
    async getEstimate(params) {
        this.log('Getting Curve Arc estimate', { from: params.fromToken, to: params.toToken });
        try {
            // Try to get estimate from Curve contracts
            const estimate = await this.getCurveEstimate(params);
            return estimate;
        }
        catch (error) {
            this.log('Curve contract estimate failed, using fallback calculation');
            // Fallback to manual calculation
            return this.getFallbackEstimate(params);
        }
    }
    async execute(params, callbacks) {
        this.log('Executing Curve Arc swap', params);
        try {
            // Validate the swap
            await this.validate(params);
            // Try direct contract integration first
            const contractResult = await this.executeCurveSwap(params, callbacks);
            if (contractResult.success) {
                return contractResult;
            }
            // Fallback to guided manual swap
            return this.executeGuidedSwap(params);
        }
        catch (error) {
            this.logError('Curve Arc swap failed', error);
            // Provide helpful guidance as fallback
            return {
                success: false,
                error: this.getSwapGuidance(params),
            };
        }
    }
    async getCurveEstimate(params) {
        const provider = provider_factory_service_1.ProviderFactoryService.getProvider(params.fromChainId);
        // First, try to discover Curve contracts on Arc Testnet
        const curveContracts = await this.discoverCurveContracts(provider);
        if (!curveContracts.pool) {
            throw new Error('Curve pool not found on Arc Testnet');
        }
        // Get token metadata
        const fromTokenMeta = config_1.TOKEN_METADATA[params.fromToken] || { decimals: 6 };
        const toTokenMeta = config_1.TOKEN_METADATA[params.toToken] || { decimals: 6 };
        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 6);
        // Get estimate from Curve pool using JsonRpcProvider (works with Farcaster)
        const pool = new ethers_1.ethers.Contract(curveContracts.pool, CURVE_POOL_ABI, provider);
        // Determine coin indices (0 = USDC, 1 = EURC typically)
        const fromIndex = params.fromToken === 'USDC' ? 0 : 1;
        const toIndex = params.fromToken === 'USDC' ? 1 : 0;
        const expectedOutput = await pool.get_dy(fromIndex, toIndex, amountIn);
        const slippage = params.slippageTolerance || config_1.TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);
        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 6),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 6),
            priceImpact: 0.04, // Curve's typical 0.04% fee
            gasCostEstimate: ethers_1.ethers.utils.parseUnits('0.01', 6), // ~$0.01 in USDC
        };
    }
    getFallbackEstimate(params) {
        // Fallback calculation using 1:1 rate with 0.04% Curve fee
        const fromTokenMeta = config_1.TOKEN_METADATA[params.fromToken] || { decimals: 6 };
        const toTokenMeta = config_1.TOKEN_METADATA[params.toToken] || { decimals: 6 };
        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 6);
        // Apply Curve's 0.04% fee
        const feeAmount = amountIn.mul(4).div(10000);
        const expectedOutput = amountIn.sub(feeAmount);
        const slippage = params.slippageTolerance || config_1.TX_CONFIG.DEFAULT_SLIPPAGE;
        const minimumOutput = this.calculateMinOutput(expectedOutput, slippage);
        return {
            expectedOutput: this.formatAmount(expectedOutput, toTokenMeta.decimals || 6),
            minimumOutput: this.formatAmount(minimumOutput, toTokenMeta.decimals || 6),
            priceImpact: 0.04,
            gasCostEstimate: ethers_1.ethers.utils.parseUnits('0.01', 6),
        };
    }
    async executeCurveSwap(params, callbacks) {
        const signer = await provider_factory_service_1.ProviderFactoryService.getSignerForChain(params.fromChainId);
        // Use JsonRpcProvider for read-only discovery (works with Farcaster)
        const readProvider = provider_factory_service_1.ProviderFactoryService.getProvider(params.fromChainId);
        const curveContracts = await this.discoverCurveContracts(readProvider);
        if (!curveContracts.pool) {
            throw new Error('Curve contracts not available for direct integration');
        }
        // Execute the swap via Curve pool
        const tokens = (0, config_1.getTokenAddresses)(params.fromChainId);
        const fromTokenAddress = tokens[params.fromToken];
        const fromTokenMeta = config_1.TOKEN_METADATA[params.fromToken] || { decimals: 6 };
        const amountIn = this.parseAmount(params.amount, fromTokenMeta.decimals || 6);
        // Check and handle approval
        if (fromTokenAddress !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
            await this.checkAndHandleApproval(fromTokenAddress, curveContracts.pool, amountIn, signer, callbacks);
        }
        // Execute swap
        const fromIndex = params.fromToken === 'USDC' ? 0 : 1;
        const toIndex = params.fromToken === 'USDC' ? 1 : 0;
        const slippage = params.slippageTolerance || config_1.TX_CONFIG.DEFAULT_SLIPPAGE;
        // Use JsonRpcProvider for read-only quote (works with Farcaster) - reuse readProvider from above
        const poolRead = new ethers_1.ethers.Contract(curveContracts.pool, CURVE_POOL_ABI, readProvider);
        const expectedOutput = await poolRead.get_dy(fromIndex, toIndex, amountIn);
        const minOutput = this.calculateMinOutput(expectedOutput, slippage);
        // Use signer for transaction
        const poolWrite = new ethers_1.ethers.Contract(curveContracts.pool, CURVE_POOL_ABI, signer);
        const tx = await poolWrite.exchange(fromIndex, toIndex, amountIn, minOutput);
        callbacks?.onSwapSubmitted?.(tx.hash);
        const receipt = await tx.wait();
        this.log('Curve swap completed', { hash: tx.hash });
        return {
            success: true,
            txHash: tx.hash,
        };
    }
    async executeGuidedSwap(params) {
        // Return guided swap instructions
        return {
            success: false,
            error: this.getSwapGuidance(params),
        };
    }
    async discoverCurveContracts(provider) {
        try {
            // First priority: Use hardcoded verified pool for Arc Testnet
            if (CURVE_ARC_CONTRACTS.USDC_EURC_POOL) {
                this.log('Using hardcoded Curve pool for Arc Testnet');
                return {
                    pool: CURVE_ARC_CONTRACTS.USDC_EURC_POOL
                };
            }
            // Fallback: Use the discovery service to find Curve contracts
            const contracts = await curve_discovery_service_1.CurveDiscoveryService.discoverContracts(provider);
            return {
                addressProvider: contracts.addressProvider,
                registry: contracts.mainRegistry,
                router: contracts.exchanges,
                pool: contracts.usdcEurcPool?.address,
            };
        }
        catch (error) {
            this.logError('Curve contract discovery failed', error);
            return {};
        }
    }
    async checkAndHandleApproval(tokenAddress, spenderAddress, amount, signer, callbacks) {
        const userAddress = await signer.getAddress();
        const chainId = await signer.getChainId();
        // Use JsonRpcProvider for read-only allowance check (works with Farcaster)
        const readProvider = provider_factory_service_1.ProviderFactoryService.getProvider(chainId);
        const tokenContractRead = new ethers_1.ethers.Contract(tokenAddress, ['function allowance(address owner, address spender) view returns (uint256)'], readProvider);
        const currentAllowance = await tokenContractRead.allowance(userAddress, spenderAddress);
        if (currentAllowance.gte(amount)) {
            return; // Sufficient allowance
        }
        // Need approval - use signer for transaction
        this.log('Approving token spend for Curve');
        const tokenContractWrite = new ethers_1.ethers.Contract(tokenAddress, ['function approve(address spender, uint256 amount) returns (bool)'], signer);
        const approveTx = await tokenContractWrite.approve(spenderAddress, amount);
        callbacks?.onApprovalSubmitted?.(approveTx.hash);
        await approveTx.wait();
        callbacks?.onApprovalConfirmed?.();
        this.log('Approval confirmed');
    }
    getSwapGuidance(params) {
        const { fromToken, toToken, amount } = params;
        return `🔄 Seamless ${fromToken} → ${toToken} swap available!

🎯 **Curve Finance Integration** (Recommended):
   • Direct integration with Curve's stable swap pools
   • Lowest fees: 0.04% for stablecoin pairs
   • Best liquidity and minimal slippage
   • URL: ${CURVE_ARC_CONTRACTS.WEB_INTERFACE}

📋 **Quick Swap Steps**:
1. ✅ Your wallet is connected to Arc Testnet
2. 🔗 Visit: ${CURVE_ARC_CONTRACTS.WEB_INTERFACE}
3. 💱 Swap ${amount} ${fromToken} for ${toToken}
4. ⚙️ Use 10% slippage if needed (confirmed working)
5. ✨ Enjoy near-instant settlement!

🔧 **Integration Status**:
Direct contract integration is being finalized. For now, use Curve's optimized interface.

💡 **Why Curve?**
• Battle-tested stable swap algorithm
• Minimal price impact for stablecoin pairs  
• Integrated with Arc Testnet infrastructure
• Used by major DeFi protocols worldwide

🚀 **Coming Soon**: One-click swaps directly in DiversiFi!`;
    }
}
exports.CurveArcStrategy = CurveArcStrategy;
//# sourceMappingURL=curve-arc.strategy.js.map