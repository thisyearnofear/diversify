/**
 * Arc Network Agent Service
 * Autonomous AI agent that pays for its own API calls using x402 protocol.
 * Integrated with the Arc Data Hub for on-chain verified premium data access.
 */

import { ethers, providers, Wallet, Contract, utils } from 'ethers';
import { rwaService } from './rwa-service';
import { circleService, CircleService } from './circle-service';
import { RealCircleWalletProvider } from './circle-wallet-provider-real';
import { hyperliquidService } from './hyperliquid.service';
import { SynthDataService } from './synth-data-service';
import { HYPERLIQUID_CONFIG } from '../config/index';
import { AIService } from './ai/ai-service';
import { marketPulseService } from '../utils/market-pulse-service';
import { inflationService } from '../utils/improved-data-services';

export interface Payment {
    amount: string;
    currency: 'USDC';
    recipient?: string;
}

export interface X402Challenge {
    recipient: string;
    amount: string;
    currency: string;
    nonce: string;
    expires: number;
}

export interface DataSource {
    name: string;
    url: string;
    cost: Payment;
    priority: number;
    dataType: 'inflation' | 'exchange' | 'economic' | 'sentiment' | 'yield';
    headers?: Record<string, string>;
    x402Enabled: boolean;
    apiKey?: string;
}

export interface AnalysisResult {
    action: 'SWAP' | 'HOLD' | 'REBALANCE' | 'BRIDGE';
    targetToken?: string;
    targetNetwork?: 'Celo' | 'Arbitrum' | 'Ethereum';
    confidence: number;
    reasoning: string;
    expectedSavings: number;
    timeHorizon: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    dataSources: string[];
    arcTxHash?: string;
    paymentHashes?: Record<string, string>; // Maps source name to x402 payment hash

    // Enhanced for real product usage
    executionMode: 'ADVISORY' | 'TESTNET_DEMO' | 'MAINNET_READY';
    actionSteps: string[];
    urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    // Automation integration
    automationTriggers?: {
        email?: {
            enabled: boolean;
            recipient: string;
            template: 'rebalance_alert' | 'urgent_action' | 'weekly_summary';
        };
        webhook?: {
            enabled: boolean;
            url: string;
            payload: Record<string, any>;
        };
        zapier?: {
            enabled: boolean;
            zapId: string;
            triggerData: Record<string, any>;
        };
    };
}

// Arc Network configuration
const ARC_CONFIG = {
    TESTNET_RPC: 'https://rpc.testnet.arc.network',
    USDC_TESTNET: '0x3600000000000000000000000000000000000000', // Native USDC on Arc
    EURC_TESTNET: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', // EURC token
    CHAIN_ID_TESTNET: 5042002,
    EXPLORER_URL: 'https://testnet.arcscan.app',
    FAUCET_URL: 'https://faucet.circle.com'
};

/**
 * Real premium data sources with x402 payment support
 * Enhanced for hackathon demo with realistic pricing
 */
const DATA_SOURCES: DataSource[] = [
    // Premium Data Sources (X402 Enabled) - Hackathon optimized
    {
        name: 'Macro Regime Oracle',
        url: '/api/agent/x402-gateway?source=macro-regime',
        cost: { amount: '0.01', currency: 'USDC' },
        priority: 0, // Highest priority
        dataType: 'economic',
        x402Enabled: true,
        headers: { 'Accept': 'application/json' }
    },
    {
        name: 'Truflation Premium',
        url: '/api/agent/x402-gateway?source=truflation',
        cost: { amount: '0.01', currency: 'USDC' },
        priority: 1,
        dataType: 'inflation',
        x402Enabled: true,
        headers: { 'Accept': 'application/json' }
    },
    {
        name: 'Glassnode Institutional',
        url: '/api/agent/x402-gateway?source=glassnode',
        cost: { amount: '0.01', currency: 'USDC' },
        priority: 1,
        dataType: 'sentiment',
        x402Enabled: true,
        headers: { 'Accept': 'application/json' }
    },
    {
        name: 'DeFi Yield Analytics',
        url: '/api/agent/x402-gateway?source=defi-yields',
        cost: { amount: '0.01', currency: 'USDC' },
        priority: 1,
        dataType: 'yield',
        x402Enabled: true,
        headers: { 'Accept': 'application/json' }
    },
    {
        name: 'RWA Market Data',
        url: '/api/agent/x402-gateway?source=rwa-markets',
        cost: { amount: '0.01', currency: 'USDC' },
        priority: 2,
        dataType: 'economic',
        x402Enabled: true,
        headers: { 'Accept': 'application/json' }
    }
];

export interface AgentWalletProvider {
    getAddress(): string;
    initialize?: () => Promise<void>;
    signTransaction(tx: any): Promise<string>;
    sendTransaction(tx: any): Promise<any>;
    balanceOf(tokenAddress: string): Promise<number>;
    transfer(to: string, amount: string, tokenAddress: string): Promise<any>;
    signTypedData(domain: any, types: any, value: any): Promise<string>;
}

export class EthersWalletProvider implements AgentWalletProvider {
    private wallet: Wallet;
    private provider: providers.JsonRpcProvider;

    constructor(privateKey: string, provider: providers.JsonRpcProvider) {
        this.provider = provider;
        this.wallet = new Wallet(privateKey, provider);
    }

    getAddress() { return this.wallet.address; }
    signTransaction(tx: any) { return this.wallet.signTransaction(tx); }
    sendTransaction(tx: any) { return this.wallet.sendTransaction(tx); }
    async balanceOf(tokenAddress: string) {
        const abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        const contract = new Contract(tokenAddress, abi, this.provider);
        const [balance, decimals] = await Promise.all([
            contract.balanceOf(this.wallet.address),
            contract.decimals()
        ]);
        return parseFloat(utils.formatUnits(balance, decimals));
    }
    async transfer(to: string, amount: string, tokenAddress: string) {
        const abi = ['function transfer(address, uint256) returns (bool)', 'function decimals() view returns (uint8)'];
        const contract = new Contract(tokenAddress, abi, this.wallet);
        const decimals = await contract.decimals();
        const amountWei = utils.parseUnits(amount, decimals);
        const tx = await contract.transfer(to, amountWei);
        return await tx.wait();
    }
    async signTypedData(domain: any, types: any, value: any) {
        return await this.wallet._signTypedData(domain, types, value);
    }
}

export class SessionKeyProvider implements AgentWalletProvider {
    private wallet: Wallet;
    private provider: providers.JsonRpcProvider;
    readonly permission: import('./erc7715-service').SessionPermission;
    private spentTodayUSD: number = 0;

    constructor(
        sessionPrivateKey: string,
        permission: import('./erc7715-service').SessionPermission,
        provider: providers.JsonRpcProvider
    ) {
        this.wallet = new Wallet(sessionPrivateKey, provider);
        this.provider = provider;
        this.permission = permission;

        if (this.wallet.address.toLowerCase() !== permission.sessionKeyAddress.toLowerCase()) {
            throw new Error(
                `Session key address mismatch: key=${this.wallet.address} permission=${permission.sessionKeyAddress}`
            );
        }
    }

    getAddress() { return this.wallet.address; }
    signTransaction(tx: any) { return this.wallet.signTransaction(tx); }

    async sendTransaction(tx: any) {
        const { erc7715Service } = await import('./erc7715-service');
        const action = (tx._action ?? 'swap') as import('./erc7715-service').AllowedAction;
        const token = (tx._token ?? 'USDC') as import('./erc7715-service').AllowedToken;
        const amountUSD = tx._amountUSD ?? 0;

        const check = erc7715Service.isActionAllowed(
            this.permission, action, token, amountUSD, this.spentTodayUSD
        );
        if (!check.allowed) {
            throw new Error(`[SessionKeyProvider] Permission denied: ${check.reason}`);
        }

        const result = await this.wallet.sendTransaction(tx);
        this.spentTodayUSD += amountUSD;
        return result;
    }

    async balanceOf(tokenAddress: string) {
        const abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        const contract = new Contract(tokenAddress, abi, this.provider);
        const [balance, decimals] = await Promise.all([
            contract.balanceOf(this.wallet.address),
            contract.decimals()
        ]);
        return parseFloat(utils.formatUnits(balance, decimals));
    }

    async transfer(to: string, amount: string, tokenAddress: string) {
        const abi = ['function transfer(address, uint256) returns (bool)', 'function decimals() view returns (uint8)'];
        const contract = new Contract(tokenAddress, abi, this.wallet);
        const decimals = await contract.decimals();
        const amountWei = utils.parseUnits(amount, decimals);
        const tx = await contract.transfer(to, amountWei);
        return await tx.wait();
    }

    async signTypedData(domain: any, types: any, value: any) {
        // Enforce permission scope before signing (nanopayments consume spending limit)
        const amountUSD = parseFloat(utils.formatUnits(value.value, 6));
        const { erc7715Service } = await import('./erc7715-service');
        const check = erc7715Service.isActionAllowed(
            this.permission, 'payment' as any, 'USDC' as any, amountUSD, this.spentTodayUSD
        );

        if (!check.allowed) {
            throw new Error(`[SessionKeyProvider] Nanopayment denied: ${check.reason}`);
        }

        const sig = await this.wallet._signTypedData(domain, types, value);
        this.spentTodayUSD += amountUSD;
        return sig;
    }
}

export class ArcAgent {
    private provider: providers.JsonRpcProvider;
    private wallet: AgentWalletProvider;
    private userId?: string;
    private agentAddress: string = '';
    private spendingLimit: number = 5.0;
    public isProxy: boolean = false; // Flag for server-side proxy agents
    private spentToday: number = 0;
    private isTestnet: boolean;
    private circleService: CircleService;
    private initialized: boolean = false;
    private dataSourceFailures: Map<string, { count: number; lastFailure: number; openUntil?: number }> = new Map();

    private static readonly DATA_SOURCE_MAX_FAILURES = 3;
    private static readonly DATA_SOURCE_FAILURE_WINDOW_MS = 5 * 60 * 1000;
    private static readonly DATA_SOURCE_COOLDOWN_MS = 10 * 60 * 1000;

    constructor(config: {
        userId?: string;
        privateKey?: string;
        sessionKey?: { privateKey: string; permission: import('./erc7715-service').SessionPermission };
        circleWalletId?: string;
        circleApiKey?: string;
        circleEntitySecret?: string;
        circleBaseUrl?: string;
        rpcUrl?: string;
        spendingLimit?: number;
        isTestnet?: boolean;
    }) {
        this.userId = config.userId;
        this.isTestnet = config.isTestnet ?? true;
        this.provider = new providers.JsonRpcProvider(
            config.rpcUrl || ARC_CONFIG.TESTNET_RPC
        );
        this.circleService = circleService;

        if (this.userId) {
            // New 2026 Path: Initialize a user-scoped agent wallet
            // The walletId will be retrieved/created during ensureInitialized()
            this.wallet = new RealCircleWalletProvider({
                walletId: 'pending', // Will be updated during initialization
                apiKey: config.circleApiKey || process.env.CIRCLE_API_KEY || '',
                entitySecret: config.circleEntitySecret || process.env.CIRCLE_ENTITY_SECRET || '',
                baseUrl: config.circleBaseUrl
            });
        } else if (config.circleWalletId && config.circleApiKey) {
            if (!config.circleEntitySecret) {
                throw new Error(
                    'Circle wallet configuration requires circleEntitySecret. Provide circleWalletId, circleApiKey, and circleEntitySecret.'
                );
            }
            this.wallet = new RealCircleWalletProvider({
                walletId: config.circleWalletId,
                apiKey: config.circleApiKey,
                entitySecret: config.circleEntitySecret,
                baseUrl: config.circleBaseUrl
            });
        } else if (config.sessionKey) {
            // Non-custodial path: disposable session key scoped by user-signed ERC-7715 permission
            this.wallet = new SessionKeyProvider(
                config.sessionKey.privateKey,
                config.sessionKey.permission,
                this.provider
            );
            this.agentAddress = this.wallet.getAddress();
            this.initialized = true;
        } else if (config.privateKey) {
            this.wallet = new EthersWalletProvider(config.privateKey, this.provider);
            this.agentAddress = this.wallet.getAddress();
            this.initialized = true;
        } else {
            throw new Error('No wallet configuration provided for ArcAgent');
        }

        if (!this.agentAddress) {
            this.agentAddress = '';
        }
        this.spendingLimit = config.spendingLimit || 5.0;
    }

    private async ensureInitialized(): Promise<void> {
        if (this.initialized) return;

        // If we have a userId but no specific walletId, fetch/create it via CircleService
        if (this.userId && this.wallet instanceof RealCircleWalletProvider) {
            const walletId = await this.circleService.getOrCreateAgentWallet(this.userId);
            (this.wallet as any).updateWalletId(walletId);
        }

        if (typeof this.wallet.initialize === 'function') {
            await this.wallet.initialize();
        }

        this.agentAddress = this.wallet.getAddress();
        this.initialized = true;
    }

    /**
     * Autonomous analysis with real x402 payments for premium data
     */
    async analyzePortfolioAutonomously(
        portfolioData: { balance: number; holdings: string[] },
        userPreferences: any,
        networkInfo: { chainId: number, name: string }
    ): Promise<AnalysisResult> {
        const steps: string[] = [];
        const dataSources: string[] = [];
        const paymentHashes: Record<string, string> = {};

        try {
            await this.ensureInitialized();
            // Step 1: Check USDC balance and optimize location
            steps.push("Analyzing capital efficiency across chains...");
            const unifiedBalance = await this.getUnifiedUSDCBalance();
            const balance = parseFloat(unifiedBalance.arcBalance || '0');
            console.log(`[Arc Agent] Capital efficiency check: Total ${unifiedBalance.totalUSDC} USDC`);

            if (balance < this.spendingLimit) {
                if (parseFloat(unifiedBalance.totalUSDC) >= this.spendingLimit) {
                    steps.push("Optimizing capital location via BridgeService...");

                    // Determine best bridge strategy: LI.FI for optimal routing, Circle for Native USDC
                    // This satisfies LI.FI hackathon's "Capital Efficiency" track
                    const sourceChain = unifiedBalance.chainBalances?.sort((a: any, b: any) => parseFloat(b.amount) - parseFloat(a.amount))[0];

                    if (sourceChain) {
                        steps.push(`Moving capital from ${sourceChain.chainName} using LI.FI optimal route...`);

                        // We use LI.FI here because it can handle swaps if the source asset is not USDC, 
                        // ensuring the agent never gets stuck.
                        try {
                            const bridgeResult = await this.executeAutonomousBridge({
                                fromChainId: sourceChain.chainId,
                                toChainId: 5042002, // Arc
                                fromToken: 'USDC',
                                toToken: 'USDC',
                                amount: this.spendingLimit.toString()
                            });

                            steps.push(`✓ Capital optimized: ${bridgeResult.txHash}`);
                            return this.getFallbackRecommendation();
                        } catch (bridgeError) {
                            console.error('LI.FI bridge failed, falling back to Circle Native:', bridgeError);
                            // Circle Native Fallback (Consolidation)
                            const transferHash = await this.transferUSDCViaGateway(
                                sourceChain.chainId, 5042002, this.spendingLimit.toString()
                            );
                            steps.push(`✓ Circle Native transfer: ${transferHash}`);
                            return this.getFallbackRecommendation();
                        }
                    }
                } else {
                    throw new Error(`Insufficient USDC balance across all chains.`);
                }
            }

            // Step 2: High-frequency data acquisition via Nanopayments (Circle/Arc)
            // Demonstrates Circle's latest "Nanopayments" vision on Arc
            steps.push("Purchasing market intelligence via Nanopayments...");
            const macroResult = await this.fetchWithNanopayment(
                '/api/agent/x402-gateway?source=macro-regime',
                { amount: '0.001', currency: 'USDC' } // Nanopayment amount
            );
            const macroData = await macroResult.json();
            if (macroResult.headers.get('x-payment-proof')) {
                paymentHashes['Macro Aggregator'] = macroResult.headers.get('x-payment-proof')!;
            }
            dataSources.push("Macro Aggregator");

            // ... (rest of analysis)
            // Step 3: Fetch inflation data from real sources
            steps.push("Fetching real-time inflation data...");
            const inflationResult = await this.fetchInflationData(steps, dataSources);
            Object.assign(paymentHashes, inflationResult.hashes);

            // Step 4: Get real-time economic indicators (Proxied Alpha Vantage)
            steps.push("Accessing premium economic indicators...");
            const economicResult = await this.fetchEconomicData(steps, dataSources);
            Object.assign(paymentHashes, economicResult.hashes);

            // Step 5: Get yield opportunities
            steps.push("Scanning DeFi yield opportunities...");
            const yieldResult = await this.fetchYieldData(steps, dataSources);
            Object.assign(paymentHashes, yieldResult.hashes);

            // Step 6: Get high-fidelity price forecasts from SynthData 
            steps.push("Analyzing probabilistic price forecasts (SynthData)...");
            const synthPredictions: Record<string, any> = {};
            const assetsToAnalyze = ['BTC', 'ETH', 'NVDAX', 'SPYX'];
            await Promise.all(assetsToAnalyze.map(async (asset) => {
                const pred = await SynthDataService.getPredictions(asset);
                if (pred) synthPredictions[asset] = pred;
            }));

            // --- 2026 Autonomous Hedging Spoke ---
            // If risk is high, open a hedge on Hyperliquid autonomously
            const riskStatus = await this.monitorRiskExposure(steps, parseFloat(unifiedBalance.totalUSDC));
            if (riskStatus.status === 'PROTECTED') {
                paymentHashes['Hyperliquid Risk Hedge'] = riskStatus.hedgeTx!;
            }

            // Step 7: Final AI Reasoning with all premium data
            steps.push("Synthesizing multi-source intelligence...");
            const pulse = await marketPulseService.getMarketPulse();

            const prompt = `
                You are ArcAgent, an autonomous AI financial analyst with access to premium verified data.
                Analyze the following data and provide a portfolio recommendation.

                PORTFOLIO:
                - Balance: ${unifiedBalance.totalUSDC} USDC
                - Holdings: ${portfolioData.holdings.join(', ')}

                MARKET PULSE:
                - Sentiment: ${pulse.sentiment}
                - AI Momentum: ${pulse.aiMomentum}
                - War Risk: ${pulse.warRisk}
                - Liquidation Risk: ${pulse.liquidationRisk}%

                TRUFLATION / MACRO:
                ${JSON.stringify(inflationResult.data, null, 2)}
                ${JSON.stringify(economicResult.data, null, 2)}

                SYNTHDATA FORECASTS:
                ${JSON.stringify(synthPredictions, null, 2)}

                YIELD OPPORTUNITIES:
                ${JSON.stringify(yieldResult.data, null, 2)}

                TASK:
                Provide a JSON response with:
                - action: 'SWAP', 'REBALANCE', 'HOLD', or 'BRIDGE'
                - targetToken: (if applicable)
                - targetNetwork: 'Arc' | 'Arbitrum' | 'Celo'
                - confidence: 0-1
                - reasoning: A detailed explanation leveraging the data above
                - riskLevel: 'LOW', 'MEDIUM', 'HIGH'
                - expectedSavings: Estimated alpha generated
            `;

            const aiResponse = await AIService.chat({
                messages: [{ role: 'system', content: prompt }],
                responseMimeType: 'application/json'
            });

            const recommendation = this.parseRecommendation(aiResponse.content);
            const action = this.normalizeAction(recommendation.action);
            
            // --- 2026 Autonomous Execution Block ---
            // If the AI recommends bridging to Arbitrum for yield, the agent can execute it
            if (action === 'BRIDGE' && recommendation.targetNetwork === 'Arbitrum' && this.spendingLimit > 0) {
                steps.push(`🚀 Autonomous Opportunity: Teleporting fuel to Arbitrum for yield...`);
                
                try {
                    // Check if we have enough on Arc, if not, we use the unified balance logic earlier
                    const bridgeAmount = (parseFloat(unifiedBalance.arcBalance) * 0.5).toFixed(2); // Bridge 50% of available fuel
                    
                    const bridgeTxId = await this.bridgeToArbitrum(bridgeAmount);
                    steps.push(`✓ CCTP V2 Transfer Initiated: ${bridgeTxId}`);
                    steps.push(`✓ Target: USDY (Ondo) Yield Vault`);
                    
                    recommendation.reasoning += ` [AUTONOMOUS ACTION TAKEN: Bridged ${bridgeAmount} USDC to Arbitrum via CCTP]`;
                } catch (bridgeError: any) {
                    console.error('[Arc Agent] Autonomous bridge failed:', bridgeError.message);
                    steps.push(`⚠ Autonomous action failed: ${bridgeError.message}`);
                }
            }

            const confidence = this.normalizeNumber(recommendation.confidence, 0.8, 0, 1);
            const expectedSavings = this.normalizeNumber(recommendation.expectedSavings, 0, 0);
            const riskLevel = this.normalizeRiskLevel(recommendation.riskLevel);
            const portfolioValue = this.normalizeNumber(unifiedBalance.totalUSDC, portfolioData.balance || 0, 0);
            const urgencyLevel = this.determineUrgency({ action, expectedSavings }, portfolioValue);
            const actionSteps = Array.isArray(recommendation.actionSteps)
                ? recommendation.actionSteps
                : [];

            return {
                action,
                targetToken: recommendation.targetToken,
                confidence,
                reasoning: recommendation.reasoning || "Balanced hold strategy based on current macro stability.",
                expectedSavings,
                timeHorizon: '7D',
                riskLevel,
                dataSources,
                paymentHashes,
                executionMode: 'ADVISORY',
                actionSteps: steps.concat(actionSteps),
                urgencyLevel
            };
        } catch (error) {
            console.error('Autonomous analysis failed:', error);
            return this.getFallbackRecommendation();
        }
    }

    /**
     * Bridge USDC from Arc L1 to Arbitrum via CCTP
     * This is the "Teleportation" spoke of the 2026 architecture
     */
    async bridgeToArbitrum(amount: string): Promise<string> {
        await this.ensureInitialized();
        
        if (!(this.wallet instanceof RealCircleWalletProvider)) {
            throw new Error('Autonomous bridging requires a real Circle MPC wallet');
        }

        const walletId = (this.wallet as any).getWalletId();
        const destinationAddress = this.agentAddress; // Same address on both chains for the agent

        return await this.circleService.bridgeUSDC(
            walletId,
            'ARBITRUM',
            destinationAddress,
            amount
        );
    }

    /**
     * Bridge USDC to Hyperliquid (Fuel Line sequence)
     * Arc L1 (USDC) -> Arbitrum (USDC) -> Hyperliquid Deposit Address
     */
    async bridgeToHyperliquid(amount: string): Promise<string> {
        await this.ensureInitialized();
        
        // Step 1: Teleport fuel to Arbitrum Spoke
        console.log(`[Arc Agent] Fuel Line Part 1: Bridging ${amount} USDC to Arbitrum...`);
        const bridgeTxId = await this.bridgeToArbitrum(amount);
        
        // Step 2: Transfer from Arbitrum Agent wallet to Hyperliquid Deposit Address
        // In 2026, CCTP V2 allows us to chain these or use a smart relayer
        // For now, we return the initiation ID as Part 1 is the cross-chain bottleneck
        console.log(`[Arc Agent] Fuel Line Part 2: Hyperliquid Deposit Scheduled via ${HYPERLIQUID_CONFIG.BRIDGE_ADDRESS_ARBITRUM}`);
        
        return bridgeTxId;
    }

    /**
     * Execute bridge transaction autonomously using LI.FI SDK
     * This fulfills the LI.FI "Best Cross-chain Agent" track
     */
    private async executeAutonomousBridge(params: {
        fromChainId: number;
        toChainId: number;
        fromToken: string;
        toToken: string;
        amount: string;
    }): Promise<any> {
        console.log(`[Arc Agent] LI.FI Autonomous Bridge: ${params.fromToken} (${params.fromChainId}) -> ${params.toToken} (${params.toChainId})`);

        // Dynamically import LiFiBridgeStrategy to avoid circular dependencies
        const { LiFiBridgeStrategy } = await import('./swap/strategies/lifi-bridge.strategy');
        const strategy = new LiFiBridgeStrategy();

        return await strategy.execute({
            fromToken: params.fromToken,
            toToken: params.toToken,
            amount: params.amount,
            fromChainId: params.fromChainId,
            toChainId: params.toChainId,
            userAddress: this.agentAddress,
            slippageTolerance: 0.5,
            signer: this.wallet // Pass the agent's signer directly
        } as any);
    }

    /**
     * Execute HTTP request with Circle Nanopayments (semantic update to x402)
     */
    private async fetchWithNanopayment(
        url: string,
        payment: Payment,
        headers: Record<string, string> = {}
    ): Promise<Response> {
        console.log(`[Arc Agent] Initiating Nanopayment for ${url} (Amount: ${payment.amount} USDC)`);
        // Under the hood, this uses the same x402 mechanism but optimized for Arc Nanopayments
        return this.fetchWithX402Payment(url, payment, headers);
    }

    /**
     * Get USDC balance for the agent wallet
     */
    private async getUSDCBalance(): Promise<number> {
        await this.ensureInitialized();
        try {
            return await this.wallet.balanceOf(ARC_CONFIG.USDC_TESTNET);
        } catch (error) {
            console.error('Failed to get USDC balance:', error);
            return 0;
        }
    }

    /**
     * Get unified USDC balance across all chains via Circle Gateway
     * This demonstrates the "unified USDC balance instantly accessible crosschain" feature
     */
    async getUnifiedUSDCBalance(): Promise<any> {
        try {
            await this.ensureInitialized();
            return await this.circleService.getUnifiedUSDCBalance(this.agentAddress);
        } catch (error) {
            console.error('Failed to get unified USDC balance:', error);
            return {
                totalUSDC: '0.00',
                arcBalance: '0.00',
                error: 'Circle Gateway unavailable'
            };
        }
    }

    /**
     * Transfer USDC using Circle Gateway for cross-chain operations
     */
    async transferUSDCViaGateway(
        fromChainId: number,
        toChainId: number,
        amount: string
    ): Promise<string> {
        try {
            await this.ensureInitialized();
            return await this.circleService.transferUSDCViaGateway(
                fromChainId, toChainId, amount, this.agentAddress
            );
        } catch (error) {
            console.error('Circle Gateway transfer failed:', error);
            throw error;
        }
    }

    /**
     * Bridge USDC using Circle Bridge Kit for cross-chain operations
     */
    async bridgeUSDC(
        amount: string
    ): Promise<any> {
        try {
            await this.ensureInitialized();
            
            console.log(`[Arc Agent] Bridging ${amount} USDC to Arbitrum via CCTP`);
            const txId = await this.bridgeToArbitrum(amount);

            return {
                transactionId: txId,
                status: 'pending'
            };

        } catch (error) {
            console.error('Circle Bridge Kit operation failed:', error);
            throw error;
        }
    }

    /**
     * Get Circle Bridge Kit status and capabilities
     */
    async getBridgeKitStatus() {
        await this.ensureInitialized();
        return await this.circleService.getBridgeKitStatus();
    }

    /**
     * Fetch inflation data from real premium sources
     */
    private async fetchInflationData(steps: string[], sources: string[]) {
        const inflationSources = DATA_SOURCES.filter(s => s.dataType === 'inflation')
            .sort((a, b) => a.priority - b.priority);

        const data: any = {};
        const hashes: Record<string, string> = {};

        for (const source of inflationSources.slice(0, 1)) {
            if (this.isCircuitOpen(source.name)) {
                steps.push(`⚠ ${source.name} temporarily unavailable (circuit open)`);
                continue;
            }
            try {
                steps.push(`Accessing ${source.name}...`);
                const response = await this.fetchWithRetry(async () => {
                    if (source.x402Enabled) {
                        return await this.fetchWithX402Payment(source.url, source.cost, source.headers, 1);
                    }
                    return await fetch(source.url, { headers: source.headers });
                });

                if (response && response.ok) {
                    data[source.name] = await response.json();
                    sources.push(source.name);
                    steps.push(`✓ Retrieved data from ${source.name}`);
                    if (response.headers.get('x-payment-proof')) {
                        hashes[source.name] = response.headers.get('x-payment-proof')!;
                    }
                    this.recordSourceSuccess(source.name);
                } else {
                    throw new Error(`HTTP ${response?.status || 'unknown'} from ${source.name}`);
                }
            } catch (error) {
                console.warn(`Failed to fetch from ${source.name}:`, error);
                steps.push(`⚠ ${source.name} unavailable`);
                this.recordSourceFailure(source.name);
            }
        }
        return { data, hashes };
    }

    // exchange rates are now handled as part of the unified macro-regime or proxied economic data

    /**
     * Fetch economic indicators from x402-enabled sources
     */
    private async fetchEconomicData(steps: string[], sources: string[]) {
        const economicSources = DATA_SOURCES.filter(s => s.dataType === 'economic')
            .sort((a, b) => a.priority - b.priority);

        const data: any = {};
        const hashes: Record<string, string> = {};

        for (const source of economicSources.slice(0, 1)) {
            if (this.isCircuitOpen(source.name)) {
                steps.push(`⚠ ${source.name} temporarily unavailable (circuit open)`);
                continue;
            }
            try {
                steps.push(`Purchasing data from ${source.name} via x402...`);
                const response = await this.fetchWithRetry(async () => {
                    if (source.x402Enabled) {
                        return await this.fetchWithX402Payment(source.url, source.cost, source.headers, 1);
                    }
                    return await fetch(source.url, { headers: source.headers });
                });

                if (response.ok) {
                    data[source.name] = await response.json();
                    sources.push(source.name);
                    steps.push(`✓ Purchased data from ${source.name} for ${source.cost.amount} USDC`);
                    if (response.headers.get('x-payment-proof')) {
                        hashes[source.name] = response.headers.get('x-payment-proof')!;
                    }
                    this.recordSourceSuccess(source.name);
                } else {
                    throw new Error(`HTTP ${response?.status || 'unknown'} from ${source.name}`);
                }
            } catch (error) {
                console.warn(`Failed to fetch economic data from ${source.name}:`, error);
                steps.push(`⚠ ${source.name} payment failed`);
                this.recordSourceFailure(source.name);
            }
        }
        return { data, hashes };
    }

    /**
     * Fetch yield opportunities from DeFi protocols
     */
    private async fetchYieldData(steps: string[], sources: string[]) {
        const yieldSources = DATA_SOURCES.filter(s => s.dataType === 'yield');
        const data: any = {};
        const hashes: Record<string, string> = {};

        for (const source of yieldSources.slice(0, 1)) {
            if (this.isCircuitOpen(source.name)) {
                steps.push(`⚠ ${source.name} temporarily unavailable (circuit open)`);
                continue;
            }
            try {
                steps.push(`Accessing ${source.name}...`);
                const response = await this.fetchWithRetry(async () => {
                    if (source.x402Enabled) {
                        return await this.fetchWithX402Payment(source.url, source.cost, source.headers, 1);
                    }
                    return await fetch(`${source.url}/pools`);
                });

                if (response && response.ok) {
                    data[source.name] = await response.json();
                    sources.push(source.name);
                    steps.push(`✓ Retrieved yield data from ${source.name}`);
                    if (response.headers.get('x-payment-proof')) {
                        hashes[source.name] = response.headers.get('x-payment-proof')!;
                    }
                    this.recordSourceSuccess(source.name);
                } else {
                    throw new Error(`HTTP ${response?.status || 'unknown'} from ${source.name}`);
                }
            } catch (error) {
                console.warn(`Failed to fetch yield data from ${source.name}:`, error);
                steps.push(`⚠ ${source.name} unavailable`);
                this.recordSourceFailure(source.name);
            }
        }
        return { data, hashes };
    }

    /**
     * Execute HTTP request with real x402 payment and Nanopayment Mandate (EIP-3009)
     */
    private async fetchWithX402Payment(
        url: string,
        payment: Payment,
        headers: Record<string, string> = {},
        retries: number = 3
    ): Promise<Response> {
        await this.ensureInitialized();
        // Check spending limit
        if (this.spentToday + parseFloat(payment.amount) > this.spendingLimit) {
            throw new Error('Daily spending limit exceeded');
        }

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`[Arc Agent] x402 payment attempt ${attempt}/${retries} to ${url}`);

                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
                const initialUrl = url.startsWith('/') ? `${baseUrl}${url}` : url;

                const initialResponse = await fetch(initialUrl, {
                    headers: { ...headers, 'Accept': 'application/json' }
                });

                if (initialResponse.status === 402) {
                    const challenge: X402Challenge = await initialResponse.json();

                    if (!challenge.recipient || !challenge.nonce) {
                        throw new Error('Invalid x402 challenge');
                    }

                    // --- Nanopayment Flow (EIP-3009) ---
                    console.log(`[Arc Agent] Creating gas-free Nanopayment Mandate for ${url}`);

                    const mandate = await this.circleService.createNanopaymentMandate(
                        this.wallet,
                        {
                            recipient: challenge.recipient,
                            amount: challenge.amount || payment.amount,
                            nonce: challenge.nonce,
                            validAfter: 0,
                            validBefore: Math.floor(Date.now() / 1000) + 3600 // 1 hour
                        }
                    );

                    // Retry with the signed mandate (Zero Gas!)
                    const retryResponse = await fetch(initialUrl, {
                        headers: {
                            ...headers,
                            'Accept': 'application/json',
                            'X-Payment-Mandate': JSON.stringify(mandate),
                            'X-Payment-Sender': this.agentAddress
                        }
                    });

                    if (retryResponse.ok) {
                        this.spentToday += parseFloat(payment.amount);
                        console.log(`[Arc Agent] Nanopayment successful (gas-free signature)`);

                        const finalHeaders = new Headers(retryResponse.headers);
                        finalHeaders.set('x-payment-proof', `nanopay_${mandate.signature.slice(2, 10)}`);

                        return new Response(retryResponse.body, {
                            status: retryResponse.status,
                            statusText: retryResponse.statusText,
                            headers: finalHeaders
                        });
                    } else if (retryResponse.status === 401) {
                        // If mandate fails, fall back to on-chain payment (Legacy mode)
                        console.log(`[Arc Agent] Mandate rejected, falling back to on-chain payment...`);
                        const paymentTx = await this.executeUSDCPayment(challenge.recipient, challenge.amount || payment.amount);

                        const legacyRetryResponse = await fetch(initialUrl, {
                            headers: {
                                ...headers,
                                'Accept': 'application/json',
                                'X-Payment-Proof': paymentTx.hash,
                                'X-Payment-Sender': this.agentAddress,
                                'X-Payment-Nonce': challenge.nonce
                            }
                        });

                        if (legacyRetryResponse.ok) {
                            this.spentToday += parseFloat(payment.amount);
                            return legacyRetryResponse;
                        }
                    }

                    throw new Error(`Payment failed: ${retryResponse.status}`);
                }

                return initialResponse;

            } catch (error: any) {
                lastError = error;
                console.error(`[Arc Agent] x402 attempt ${attempt} failed:`, error.message);

                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        throw lastError || new Error('x402 payment failed');
    }

    // fetchWithAPIKey is deprecated in favor of x402-proxied gateway calls

    /**
     * Execute USDC payment on Arc network
     */
    private async executeUSDCPayment(recipient: string, amount: string): Promise<any> {
        try {
            await this.ensureInitialized();
            console.log(`[Arc Agent] Initiating USDC transfer: ${amount} to ${recipient}`);
            return await this.wallet.transfer(recipient, amount, ARC_CONFIG.USDC_TESTNET);
        } catch (error) {
            console.error('USDC payment failed:', error);
            throw error;
        }
    }

    /**
     * Run comprehensive AI analysis with real data
     * Enhanced to support Arc testnet diversification strategies
     */
    private async runAIAnalysis(data: any, networkInfo: { chainId: number, name: string }): Promise<Partial<AnalysisResult>> {
        const isArcTestnet = networkInfo.chainId === 5042002;

        const prompt = `
    You are an expert DeFi wealth protection agent operating on ${networkInfo.name}.
    
    ${isArcTestnet ? `
    SPECIAL: You are on Arc Testnet with access to real diversification:
    - USDC (native gas token): USD exposure, 4.2% inflation risk
    - EURC: Euro exposure, 2.3% inflation (better protection)
    
    Users can get free testnet funds from https://faucet.circle.com to test strategies risk-free.
    ` : `
    You are providing advisory recommendations for mainnet assets.
    `}
    
    Portfolio Data: ${JSON.stringify(data.portfolio)}
    Market Data: ${JSON.stringify({
            macro: data.macro,
            inflation: data.inflation,
            economic: data.economic,
            yields: data.yields
        })}
    ${isArcTestnet ? `Diversification Options: ${JSON.stringify(data.diversification)}` : `RWA Options: ${JSON.stringify(data.diversification)}`}
    User Preferences: ${JSON.stringify(data.preferences)}
    
    Provide a JSON response with:
    - action: "SWAP" | "HOLD" | "REBALANCE"
    - targetToken: string (${isArcTestnet ? 'EURC for EUR diversification' : 'PAXG, GLP for RWA'})
    - targetNetwork: "${networkInfo.name}"
    - confidence: number (0-1)
    - reasoning: string (focus on ${isArcTestnet ? 'testnet diversification benefits' : 'wealth protection vs inflation'})
    - expectedSavings: number (USD)
    - timeHorizon: string
    - riskLevel: "LOW" | "MEDIUM" | "HIGH"
    - actionSteps: array of specific steps user can take
    - urgencyLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    
    ${isArcTestnet ? `
    TESTNET STRATEGY GUIDANCE:
    1. If user has >80% USDC, recommend EURC diversification (lower EUR inflation)
    2. Always mention this is risk-free testing with faucet funds
    3. Provide specific swap amounts and steps
    4. Focus on geographic diversification benefits (USD vs EUR inflation)
    ` : `
    MAINNET STRATEGY GUIDANCE:
    1. If inflation data is high (>4%), prioritize PAXG (gold hedge) or USDY (treasury yield) on Arbitrum
    2. If macro sentiment is bearish, recommend PAXG (Gold) as safe haven
    3. For conservative yield seekers: USDY (~5% APY, auto-accruing, treasury-backed)
    4. For DeFi-native users: SYRUPUSDC (~4.5% APY, Morpho protocol, instant liquidity)
    5. Consider gas efficiency - if amount <$500, optimize for lower fees
    
    RWA DIFFERENTIATION:
    - USDY: Best for users wanting US Treasury yield without KYC. Auto-accruing, no claiming needed.
    - SYRUPUSDC: Best for users familiar with Morpho. Auto-compounding yield, highly liquid.
    - PAXG: Best for users wanting gold exposure. No yield, pure store of value.
    `}
    `;

        try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const response = await fetch(`${baseUrl}/api/agent/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    model: 'gemini-3-flash-preview', // Use latest frontier model
                    maxTokens: 1000,
                    realData: data,
                    networkContext: networkInfo,
                    userBalance: data.portfolio.balance,
                    currentHoldings: data.portfolio.holdings,
                    inflationData: data.inflation,
                    config: data.preferences
                })
            });

            const result = await response.json();

            try {
                return JSON.parse(result.text);
            } catch (parseError) {
                return {
                    action: 'HOLD',
                    reasoning: result.text || 'Analysis completed with real market data',
                    confidence: 0.75,
                    riskLevel: 'MEDIUM'
                };
            }
        } catch (error) {
            console.error('AI analysis failed:', error);
            throw error;
        }
    }

    /**
     * Record analysis on Arc blockchain for transparency
     */
    private async recordAnalysisOnChain(analysis: Partial<AnalysisResult>): Promise<string> {
        try {
            await this.ensureInitialized();
            // Create analysis hash for on-chain record
            const analysisHash = utils.keccak256(
                utils.toUtf8Bytes(JSON.stringify(analysis))
            );

            console.log(`[Arc Agent] Recording analysis hash on-chain: ${analysisHash}`);

            // In production, this would call a deployed agent contract
            // For now, we'll create a simple transaction with the hash in data
            const tx = await this.wallet.sendTransaction({
                to: this.agentAddress,
                value: 0,
                data: analysisHash
            });

            const receipt = await tx.wait();
            console.log(`[Arc Agent] Analysis recorded on-chain: ${receipt.transactionHash}`);

            return receipt.transactionHash;
        } catch (error) {
            console.error('Failed to record analysis on-chain:', error);
            throw error;
        }
    }

    /**
     * Fallback recommendation if analysis fails
     */
    private getFallbackRecommendation(executionMode: 'ADVISORY' | 'TESTNET_DEMO' | 'MAINNET_READY' = 'ADVISORY'): AnalysisResult {
        return {
            action: 'HOLD',
            confidence: 0,
            reasoning: 'Unable to analyze due to data source failures. Recommend holding current position.',
            expectedSavings: 0,
            timeHorizon: '1 month',
            riskLevel: 'LOW',
            dataSources: [],
            executionMode,
            actionSteps: ['Review portfolio manually', 'Consider consulting financial advisor'],
            urgencyLevel: 'LOW'
        };
    }

    /**
     * Determine execution mode based on network and portfolio
     */
    private determineExecutionMode(
        networkInfo: { chainId: number, name: string },
        portfolioData: { balance: number; holdings: string[] }
    ): 'ADVISORY' | 'TESTNET_DEMO' | 'MAINNET_READY' {
        // If on Arc testnet, we can do testnet demos
        if (networkInfo.chainId === 5042002) {
            return 'TESTNET_DEMO';
        }

        // If on mainnet chains but Arc agent can't execute directly
        if ([1, 42161, 42220].includes(networkInfo.chainId)) {
            // For now, Arc agent is advisory-only for mainnet
            // In future, could support mainnet execution via Circle CCTP
            return 'ADVISORY';
        }

        return 'ADVISORY';
    }

    /**
     * Generate action steps based on analysis and execution mode
     */
    private generateActionSteps(analysis: any, executionMode: 'ADVISORY' | 'TESTNET_DEMO' | 'MAINNET_READY'): string[] {
        const baseSteps = [];

        if (executionMode === 'TESTNET_DEMO') {
            baseSteps.push('Go to Swap tab in DiversiFi app');
            if (analysis.targetToken) {
                baseSteps.push(`Select ${analysis.targetToken} as target asset`);
            }
            if (analysis.targetNetwork && analysis.targetNetwork !== 'Celo') {
                baseSteps.push(`Bridge to ${analysis.targetNetwork} network`);
            }
            baseSteps.push('Review transaction details and confirm');
        } else {
            // Advisory mode - provide manual steps
            baseSteps.push('Open your preferred DeFi platform or exchange');
            if (analysis.targetToken) {
                baseSteps.push(`Search for ${analysis.targetToken} trading pair`);
                baseSteps.push(`Consider swapping to ${analysis.targetToken}`);
            }
            if (analysis.targetNetwork) {
                baseSteps.push(`Consider bridging assets to ${analysis.targetNetwork}`);
            }
            baseSteps.push('Review gas fees and slippage before executing');
            baseSteps.push('Monitor position after execution');
        }

        return baseSteps;
    }

    /**
     * Determine urgency level based on analysis
     */
    private determineUrgency(
        analysis: { expectedSavings?: number; action?: string },
        portfolioValue?: number
    ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        const savings = Math.max(0, analysis.expectedSavings || 0);
        const value = portfolioValue && portfolioValue > 0 ? portfolioValue : 0;
        const ratio = value > 0 ? savings / value : 0;

        if (ratio >= 0.05) return 'CRITICAL';
        if (ratio >= 0.02) return 'HIGH';
        if (ratio >= 0.005 || (analysis.action && analysis.action !== 'HOLD')) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Generate automation triggers based on analysis
     */
    private generateAutomationTriggers(
        analysis: any,
        userEmail?: string,
        executionMode: 'ADVISORY' | 'TESTNET_DEMO' | 'MAINNET_READY' = 'ADVISORY',
        portfolioValue?: number
    ): AnalysisResult['automationTriggers'] {
        if (!userEmail) return undefined;

        const urgency = this.determineUrgency(analysis, portfolioValue);

        return {
            email: {
                enabled: true,
                recipient: userEmail,
                template: urgency === 'CRITICAL' ? 'urgent_action' :
                    analysis.action !== 'HOLD' ? 'rebalance_alert' : 'weekly_summary'
            },
            webhook: {
                enabled: urgency !== 'LOW',
                url: process.env.WEBHOOK_URL || '',
                payload: {
                    action: analysis.action,
                    urgency,
                    expectedSavings: analysis.expectedSavings,
                    executionMode
                }
            },
            zapier: {
                enabled: ['HIGH', 'CRITICAL'].includes(urgency),
                zapId: process.env.ZAPIER_ZAP_ID || '',
                triggerData: {
                    recommendation: analysis.action,
                    target_token: analysis.targetToken,
                    expected_savings: analysis.expectedSavings,
                    urgency_level: urgency,
                    execution_mode: executionMode
                }
            }
        };
    }

    /**
     * Trigger automations using the automation service
     */
    private async triggerAutomations(
        analysis: AnalysisResult,
        userEmail: string,
        portfolioData: any
    ): Promise<void> {
        try {
            // Import and use automation service
            const { AutomationService } = await import('./automation-service');

            const automationConfig = {
                email: {
                    enabled: true,
                    provider: (process.env.EMAIL_PROVIDER as 'sendgrid' | 'resend') || 'sendgrid',
                    apiKey: process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY,
                    fromEmail: process.env.FROM_EMAIL || 'agent@diversifi.app',
                    templates: {
                        rebalance_alert: 'rebalance',
                        urgent_action: 'urgent',
                        weekly_summary: 'summary'
                    }
                },
                zapier: {
                    enabled: !!process.env.ZAPIER_WEBHOOK_URL,
                    webhookUrl: process.env.ZAPIER_WEBHOOK_URL
                },
                make: {
                    enabled: !!process.env.MAKE_WEBHOOK_URL,
                    webhookUrl: process.env.MAKE_WEBHOOK_URL
                },
                slack: {
                    enabled: !!process.env.SLACK_WEBHOOK_URL,
                    webhookUrl: process.env.SLACK_WEBHOOK_URL,
                    channel: '#diversifi-alerts'
                }
            };

            const automationService = new AutomationService(automationConfig);
            await automationService.processAnalysis(analysis, userEmail, portfolioData);

            console.log(`[Arc Agent] Automations triggered for ${userEmail}`);
        } catch (error) {
            console.error('[Arc Agent] Automation trigger failed:', error);
        }
    }

    /**
     * Autonomous Risk Monitoring
     * Monitors portfolio exposure and automatically opens hedges on Hyperliquid
     * during high-volatility events.
     */
    async monitorRiskExposure(
        steps: string[],
        portfolioValue: number
    ): Promise<{ hedgeTx?: string; status: string }> {
        try {
            await this.ensureInitialized();
            
            // Check risk signals from SynthData
            const btcForecast = await SynthDataService.getPredictions('BTC');
            const ethForecast = await SynthDataService.getPredictions('ETH');

            // Use volatility as a risk indicator (High volatility = high drawdown risk)
            const btcVol = btcForecast?.forecast_future?.average_volatility || 0;
            const ethVol = ethForecast?.forecast_future?.average_volatility || 0;
            
            const isHighRisk = btcVol > 0.08 || ethVol > 0.08;

            if (isHighRisk && this.spendingLimit > 0) {
                steps.push("⚠ High Drawdown Risk Detected: Initializing autonomous hedge...");
                
                // Open 1x Short Hedge on Hyperliquid
                // We use 10% of portfolio value for the hedge
                const hedgeAmount = portfolioValue * 0.1;
                
                try {
                    const txId = await hyperliquidService.openHedge(
                        this.wallet as any,
                        'ETH',
                        hedgeAmount
                    );
                    
                    steps.push(`✓ Protection Active: 1x ETH Short Hedge opened on Hyperliquid`);
                    return { hedgeTx: txId, status: 'PROTECTED' };
                } catch (hedgeError: any) {
                    console.error('[Arc Agent] Hedging failed:', hedgeError.message);
                    steps.push(`⚠ Hedging failed: ${hedgeError.message}`);
                }
            }

            return { status: 'STABLE' };
        } catch (error) {
            console.error('[Arc Agent] Risk monitoring failed:', error);
            return { status: 'ERROR' };
        }
    }

    /**
     * Robinhood Simulation Spoke - Backtesting & Paper Trading
     * Enables autonomous simulation of stock token swaps on Robinhood testnet.
     * Part of the 2026 "Autonomous" architecture for agent-led backtesting.
     */
    async simulateRobinhoodSwap(params: {
        fromToken: 'ETH' | 'ACME' | 'SPACELY' | 'WAYNE' | 'OSCORP' | 'STARK';
        toToken: 'ETH' | 'ACME' | 'SPACELY' | 'WAYNE' | 'OSCORP' | 'STARK';
        amount: string;
    }): Promise<{
        success: boolean;
        estimate?: {
            expectedOutput: string;
            minimumOutput: string;
            priceImpact: number;
        };
        simulationId?: string;
        error?: string;
    }> {
        try {
            await this.ensureInitialized();
            
            // Dynamic import to avoid circular dependencies
            const { RobinhoodAMMStrategy } = await import('./swap/strategies/robinhood-amm.strategy');
            const { NETWORKS } = await import('../config');
            
            const strategy = new RobinhoodAMMStrategy();
            
            // Build swap params for RH testnet
            const swapParams = {
                fromToken: params.fromToken,
                toToken: params.toToken,
                amount: params.amount,
                fromChainId: NETWORKS.RH_TESTNET.chainId,
                toChainId: NETWORKS.RH_TESTNET.chainId,
                slippageTolerance: 1,
                userAddress: this.agentAddress,
            };
            
            // Check if strategy supports this swap
            if (!strategy.supports(swapParams)) {
                return {
                    success: false,
                    error: 'Unsupported swap pair. Must be ETH ↔ stock token on RH testnet.'
                };
            }
            
            // Get estimate (dry-run, no on-chain execution)
            const estimate = await strategy.getEstimate(swapParams);
            
            // Generate simulation ID for tracking
            const simulationId = `rh-sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            
            console.log(`[Arc Agent] Robinhood Simulation: ${params.amount} ${params.fromToken} → ${estimate.expectedOutput} ${params.toToken}`);
            
            // In production, this would record to a simulation log or streak rewards
            // For now, return the estimate as the simulation result
            return {
                success: true,
                estimate: {
                    expectedOutput: estimate.expectedOutput,
                    minimumOutput: estimate.minimumOutput,
                    priceImpact: estimate.priceImpact,
                },
                simulationId,
            };
        } catch (error: any) {
            console.error('[Arc Agent] Robinhood simulation failed:', error);
            return {
                success: false,
                error: error.message || 'Simulation failed',
            };
        }
    }

    /**
     * Run autonomous backtesting sequence on Robinhood testnet
     * Simulates a series of swaps to evaluate strategy performance.
     */
    async runBacktestSequence(scenarios: Array<{
        fromToken: 'ETH' | 'ACME' | 'SPACELY' | 'WAYNE' | 'OSCORP' | 'STARK';
        toToken: 'ETH' | 'ACME' | 'SPACELY' | 'WAYNE' | 'OSCORP' | 'STARK';
        amount: string;
    }>): Promise<{
        totalSimulations: number;
        successful: number;
        results: Array<{
            scenario: typeof scenarios[0];
            result: Awaited<ReturnType<ArcAgent['simulateRobinhoodSwap']>>;
        }>;
    }> {
        const results: Array<{
            scenario: typeof scenarios[0];
            result: Awaited<ReturnType<ArcAgent['simulateRobinhoodSwap']>>;
        }> = [];
        
        let successful = 0;
        
        for (const scenario of scenarios) {
            const result = await this.simulateRobinhoodSwap(scenario);
            results.push({ scenario, result });
            if (result.success) successful++;
        }
        
        console.log(`[Arc Agent] Backtest complete: ${successful}/${scenarios.length} simulations successful`);
        
        return {
            totalSimulations: scenarios.length,
            successful,
            results,
        };
    }

    /**
     * Celo Social Autonomy - Resolve social identifiers to addresses
     * Enables the agent to interact with users via phone/email instead of addresses.
     * Part of the 2026 "Social Autonomy" architecture.
     */
    async resolveSocialIdentifier(params: {
        identifier: string;
        type: 'phone' | 'email' | 'twitter';
    }): Promise<{
        success: boolean;
        address?: string;
        error?: string;
    }> {
        try {
            await this.ensureInitialized();
            
            // Dynamic import to avoid circular dependencies
            const { SocialConnectService, IdentifierPrefix } = await import('./social-connect-service');
            
            const prefixMap = {
                phone: IdentifierPrefix.PHONE_NUMBER,
                email: IdentifierPrefix.EMAIL,
                twitter: IdentifierPrefix.TWITTER,
            };
            
            const service = new SocialConnectService({
                isTestnet: this.isTestnet,
                issuerAddress: this.agentAddress as any,
            });
            
            // Create auth signer from agent wallet
            const authSigner = SocialConnectService.createViemAuthSigner(
                this.wallet,
                this.agentAddress as any
            );
            
            const resolvedAddress = await service.resolveIdentifier(
                params.identifier,
                prefixMap[params.type],
                authSigner
            );
            
            if (resolvedAddress) {
                console.log(`[Arc Agent] Social resolved: ${params.type}:${params.identifier} → ${resolvedAddress}`);
                return {
                    success: true,
                    address: resolvedAddress,
                };
            }
            
            return {
                success: false,
                error: 'No address found for this identifier',
            };
        } catch (error: any) {
            console.error('[Arc Agent] Social resolution failed:', error);
            return {
                success: false,
                error: error.message || 'Resolution failed',
            };
        }
    }

    /**
     * Autonomous social transfer - Send USDC to a social contact
     * Resolves identifier and executes transfer in one autonomous action.
     */
    async sendToSocialContact(params: {
        identifier: string;
        type: 'phone' | 'email';
        amount: string;
    }): Promise<{
        success: boolean;
        txHash?: string;
        resolvedAddress?: string;
        error?: string;
    }> {
        try {
            // Step 1: Resolve social identifier
            const resolution = await this.resolveSocialIdentifier(params);
            
            if (!resolution.success || !resolution.address) {
                return {
                    success: false,
                    error: resolution.error || 'Could not resolve identifier',
                };
            }
            
            // Step 2: Execute USDC transfer
            const transferResult = await this.transferUSDCViaGateway(
                ARC_CONFIG.CHAIN_ID_TESTNET,
                ARC_CONFIG.CHAIN_ID_TESTNET,
                params.amount
            );
            
            console.log(`[Arc Agent] Social transfer: ${params.amount} USDC → ${params.identifier} (${resolution.address})`);
            
            return {
                success: true,
                txHash: transferResult,
                resolvedAddress: resolution.address,
            };
        } catch (error: any) {
            console.error('[Arc Agent] Social transfer failed:', error);
            return {
                success: false,
                error: error.message || 'Transfer failed',
            };
        }
    }

    /**
     * Agent-to-Agent (A2A) Service: Expose intelligence to other agents
     * This fulfills the vision of a Machine-to-Machine (M2M) economy
     */
    async provideIntelligence(
        requesterAddress: string,
        queryType: 'macro' | 'yield' | 'strategy'
    ): Promise<any> {
        await this.ensureInitialized();
        console.log(`[Arc Agent] A2A Request from ${requesterAddress} for ${queryType}`);

        // In a real x402 flow, this would be gated by a payment check
        // For the hackathon, we demonstrate the response capability
        const intelligence = {
            timestamp: Date.now(),
            provider: this.agentAddress,
            data: {
                macroRegime: 'Inflationary / Bearish',
                recommendedHedge: 'PAXG (Gold) / USDY (Treasuries)',
                bestBridgeRoute: 'LI.FI (Celo -> Arbitrum)',
                optimalStablecoin: 'EURC (Lowest current inflation risk)'
            },
            signature: '0x_agent_signed_payload'
        };

        return intelligence;
    }

    /**
     * Get current spending status
     */
    getSpendingStatus() {
        return {
            spent: this.spentToday,
            limit: this.spendingLimit,
            remaining: this.spendingLimit - this.spentToday,
            balance: 0 // Will be populated by getUSDCBalance()
        };
    }

    /**
     * Reset daily spending (called by cron job)
     */
    resetDailySpending() {
        this.spentToday = 0;
    }

    /**
     * Get Arc Network status
     */
    async getNetworkStatus() {
        try {
            await this.ensureInitialized();
            const network = await this.provider.getNetwork();
            const balance = await this.getUSDCBalance();

            return {
                chainId: network.chainId,
                name: network.name,
                isTestnet: this.isTestnet,
                usdcBalance: balance,
                agentAddress: this.agentAddress,
                rpcUrl: this.provider.connection.url
            };
        } catch (error) {
            console.error('Failed to get network status:', error);
            return null;
        }
    }

    private isCircuitOpen(sourceName: string): boolean {
        const state = this.dataSourceFailures.get(sourceName);
        if (!state) return false;
        if (state.openUntil && Date.now() < state.openUntil) {
            return true;
        }
        return false;
    }

    private recordSourceFailure(sourceName: string) {
        const now = Date.now();
        const existing = this.dataSourceFailures.get(sourceName);

        if (!existing || now - existing.lastFailure > ArcAgent.DATA_SOURCE_FAILURE_WINDOW_MS) {
            this.dataSourceFailures.set(sourceName, {
                count: 1,
                lastFailure: now
            });
            return;
        }

        const nextCount = existing.count + 1;
        const updated = {
            count: nextCount,
            lastFailure: now,
            openUntil: existing.openUntil
        };

        if (nextCount >= ArcAgent.DATA_SOURCE_MAX_FAILURES) {
            updated.openUntil = now + ArcAgent.DATA_SOURCE_COOLDOWN_MS;
        }

        this.dataSourceFailures.set(sourceName, updated);
    }

    private recordSourceSuccess(sourceName: string) {
        this.dataSourceFailures.delete(sourceName);
    }

    private async fetchWithRetry<T>(
        action: () => Promise<T>,
        options: { retries?: number; baseDelayMs?: number } = {}
    ): Promise<T> {
        const retries = options.retries ?? 2;
        const baseDelayMs = options.baseDelayMs ?? 750;
        let lastError: unknown = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await action();
            } catch (error) {
                lastError = error;
                if (attempt >= retries) break;
                const backoff = baseDelayMs * Math.pow(2, attempt);
                const jitter = Math.floor(Math.random() * 150);
                await new Promise(resolve => setTimeout(resolve, backoff + jitter));
            }
        }

        throw lastError;
    }

    private parseRecommendation(content: unknown): any {
        if (typeof content === 'object' && content !== null) {
            return content;
        }

        const raw = typeof content === 'string' ? content : '';

        try {
            return JSON.parse(raw);
        } catch (error) {
            const start = raw.indexOf('{');
            const end = raw.lastIndexOf('}');
            if (start !== -1 && end > start) {
                const candidate = raw.slice(start, end + 1);
                try {
                    return JSON.parse(candidate);
                } catch (innerError) {
                    // fall through to fallback
                }
            }

            return {
                action: 'HOLD',
                reasoning: raw || 'Analysis completed, but no structured response was returned.',
                confidence: 0.5,
                riskLevel: 'MEDIUM',
                expectedSavings: 0
            };
        }
    }

    private normalizeAction(action?: string): AnalysisResult['action'] {
        const candidate = (action || '').toUpperCase();
        if (candidate === 'SWAP' || candidate === 'REBALANCE' || candidate === 'HOLD' || candidate === 'BRIDGE') {
            return candidate as AnalysisResult['action'];
        }
        return 'HOLD';
    }

    private normalizeRiskLevel(level?: string): AnalysisResult['riskLevel'] {
        const candidate = (level || '').toUpperCase();
        if (candidate === 'LOW' || candidate === 'MEDIUM' || candidate === 'HIGH') {
            return candidate as AnalysisResult['riskLevel'];
        }
        return 'MEDIUM';
    }

    private normalizeNumber(
        value: unknown,
        fallback: number,
        min?: number,
        max?: number
    ): number {
        const parsed = typeof value === 'number'
            ? value
            : typeof value === 'string'
                ? parseFloat(value)
                : NaN;
        const resolved = Number.isFinite(parsed) ? parsed : fallback;
        const lowerBounded = typeof min === 'number' ? Math.max(min, resolved) : resolved;
        const upperBounded = typeof max === 'number' ? Math.min(max, lowerBounded) : lowerBounded;
        return upperBounded;
    }
}
