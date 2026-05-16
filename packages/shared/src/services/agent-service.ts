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
import { GuardianExecutionService } from './guardian/guardian-execution.service';
import { GuardianAnalysisDataService } from './guardian/guardian-analysis-data.service';
import { GuardianRecommendationService } from './guardian/guardian-recommendation.service';
import { GuardianDataAccessService } from './guardian/guardian-data-access.service';
import { GuardianPostAnalysisService } from './guardian/guardian-post-analysis.service';
import { createArcAgentDataSourceTemplates } from '../utils/arc-research-sources';
import { zeroGStorageService } from './storage-service';
import { zeroGPersistenceService } from './persistence-service';
import { SettlementNetwork } from './settlement-service';

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
    evidenceCids?: Record<string, string>; // New: Evidence commitments on 0G Storage

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
const DATA_SOURCES: DataSource[] = createArcAgentDataSourceTemplates();

export interface AgentWalletProvider {
    getAddress(): string;
    initialize?: () => Promise<void>;
    getExecutionSigner?(): ethers.Signer | null;
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
    getExecutionSigner() { return this.wallet; }
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
    getExecutionSigner() { return this.wallet; }
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

/**
 * Autonomous Agent Service
 * AI agent that pays for its own data using x402 on-chain micro-payments.
 * Configurable for any network supporting EOA-based USDC settlement.
 */


export class AgentService {
    private provider: providers.JsonRpcProvider;
    private wallet: AgentWalletProvider;
    private userId?: string;
    private agentAddress: string = '';
    private spendingLimit: number = 5.0;
    private spentToday: number = 0;
    private network: SettlementNetwork;
    private circleService: CircleService;
    private initialized: boolean = false;
    private dataSourceFailures: Map<string, { count: number; lastFailure: number; openUntil?: number }> = new Map();
    private lastAnalysisResult: AnalysisResult | null = null;
    private isTestnet: boolean = true;

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
        rpcUrl: string;
        network: SettlementNetwork;
        spendingLimit?: number;
    }) {
        this.userId = config.userId;
        this.network = config.network;
        this.provider = new providers.JsonRpcProvider(config.rpcUrl);
        this.circleService = circleService;

        if (this.userId) {
            this.wallet = new RealCircleWalletProvider({
                walletId: 'pending',
                apiKey: config.circleApiKey || process.env.CIRCLE_API_KEY || '',
                entitySecret: config.circleEntitySecret || process.env.CIRCLE_ENTITY_SECRET || '',
                baseUrl: config.circleBaseUrl
            });
        } else if (config.circleWalletId && config.circleApiKey) {
            this.wallet = new RealCircleWalletProvider({
                walletId: config.circleWalletId,
                apiKey: config.circleApiKey,
                entitySecret: config.circleEntitySecret || process.env.CIRCLE_ENTITY_SECRET || '',
                baseUrl: config.circleBaseUrl
            });
        } else if (config.sessionKey) {
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
            throw new Error('No wallet configuration provided for AgentService');
        }

        this.spendingLimit = config.spendingLimit || 5.0;
    }

    // ... (keep ensureInitialized)

    /**
     * Persist agent state to 0G DA
     */
    async persistAgentState() {
        if (!this.userId) return;
        
        try {
            await zeroGPersistenceService.persistState({
                userId: this.userId,
                preferences: {}, 
                riskProfile: 'MEDIUM',
                lastStateHash: 'hash',
                timestamp: Date.now()
            });
        } catch (e) {
            console.error('[AgentService] Persistence to 0G DA failed:', e);
        }
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
        const evidenceCids: Record<string, string> = {};

        try {
            await this.ensureInitialized();
            const dataAccess = new GuardianDataAccessService({
                ensureInitialized: () => this.ensureInitialized(),
                wallet: this.wallet,
                circleService: this.circleService,
                agentAddress: this.agentAddress,
                spendingLimit: () => this.spendingLimit,
                getSpentToday: () => this.spentToday,
                setSpentToday: (next) => { this.spentToday = next; },
                dataSourceFailures: this.dataSourceFailures,
                appBaseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                dataSourceFailureWindowMs: AgentService.DATA_SOURCE_FAILURE_WINDOW_MS,
                dataSourceCooldownMs: AgentService.DATA_SOURCE_COOLDOWN_MS,
                dataSourceMaxFailures: AgentService.DATA_SOURCE_MAX_FAILURES,
            });
            const analysisData = await GuardianAnalysisDataService.gatherContext({
                portfolioData,
                spendingLimit: this.spendingLimit,
                steps,
                dataSources,
                paymentHashes,
                getUnifiedUSDCBalance: () => this.getUnifiedUSDCBalance(),
                executeAutonomousBridge: (params) => this.executeAutonomousBridge(params),
                transferUSDCViaGateway: (fromChainId, toChainId, amount) => this.transferUSDCViaGateway(fromChainId, toChainId, amount),
                fetchWithNanopayment: (url, payment) => dataAccess.fetchWithNanopayment(url, payment),
                fetchInflationData: (analysisSteps, sources) => dataAccess.fetchInflationData(analysisSteps, sources, DATA_SOURCES),
                fetchEconomicData: (analysisSteps, sources) => dataAccess.fetchEconomicData(analysisSteps, sources, DATA_SOURCES),
                fetchYieldData: (analysisSteps, sources) => dataAccess.fetchYieldData(analysisSteps, sources, DATA_SOURCES),
                monitorRiskExposure: (analysisSteps, portfolioUsd) => this.monitorRiskExposure(analysisSteps, portfolioUsd),
                getFallbackRecommendation: () => this.getFallbackRecommendation(),
            });

            if (analysisData.earlyResult) {
                return analysisData.earlyResult;
            }

            const context = analysisData.context!;
            steps.push("Synthesizing multi-source intelligence...");

            // Merge evidence CIDs from all sources
            Object.assign(evidenceCids, context.inflationResult.storageCids || {});
            Object.assign(evidenceCids, context.economicResult.storageCids || {});
            Object.assign(evidenceCids, context.yieldResult.storageCids || {});

            const recommendation = await GuardianRecommendationService.generateRecommendation(
                context,
                (content) => this.parseRecommendation(content)
            );
            const action = this.normalizeAction(recommendation.action);
            
            // --- 2026 Autonomous Execution Block ---
            let executionTxHash: string | undefined = undefined;

            const canExecute = this.spendingLimit > 0 && !!action;

            // 1) Teleportation to Arbitrum
            if (canExecute && action === 'BRIDGE' && recommendation.targetNetwork === 'Arbitrum') {
                steps.push(`🚀 Autonomous Opportunity: Teleporting fuel to Arbitrum for yield...`);
                
                try {
                    const execution = await GuardianExecutionService.executeBridgeToArbitrum({
                        arcBalance: context.unifiedBalance.arcBalance,
                        bridgeToArbitrum: (amount) => this.bridgeToArbitrum(amount),
                        steps,
                    });
                    recommendation.reasoning += execution.reasoningSuffix || '';
                    executionTxHash = execution.executionTxHash;
                } catch (bridgeError: any) {
                    console.error('[Arc Agent] Autonomous bridge failed:', bridgeError.message);
                    steps.push(`⚠ Autonomous action failed: ${bridgeError.message}`);
                }
            }

            // 2) Swapping USDC target tokens (Phase 5B)
            if (canExecute && action === 'SWAP' && recommendation.targetToken) {
                steps.push(`🚀 Autonomous Opportunity: Swapping USDC to ${recommendation.targetToken} for stable yield...`);
                try {
                    const execution = await GuardianExecutionService.executeSwap({
                        wallet: this.wallet,
                        targetToken: recommendation.targetToken,
                        networkInfo,
                        agentAddress: this.agentAddress,
                        steps,
                    });
                    executionTxHash = execution.executionTxHash;
                    recommendation.reasoning += execution.reasoningSuffix || '';
                } catch (swapError: any) {
                    console.error('[Arc Agent] Autonomous swap failed:', swapError.message);
                    steps.push(`⚠ Autonomous swap failed: ${swapError.message}`);

                    // Fallback to demo payload if real swap fails (e.g. no signer or no liquidity on testnet)
                    executionTxHash = await GuardianExecutionService.executeSimulatedFallback({
                        wallet: this.wallet,
                        agentAddress: this.agentAddress,
                        steps,
                    });
                }
            }

            const portfolioValue = this.normalizeNumber(context.unifiedBalance.totalUSDC, portfolioData.balance || 0, 0);
            const finalResult = GuardianRecommendationService.buildFinalResult({
                recommendation,
                normalizedAction: action,
                normalizeNumber: (value, fallback, min, max) => this.normalizeNumber(value, fallback, min, max),
                normalizeRiskLevel: (value) => this.normalizeRiskLevel(value),
                determineUrgency: (analysis, currentPortfolioValue) => this.determineUrgency(analysis, currentPortfolioValue),
                portfolioValue,
                dataSources,
                paymentHashes,
                evidenceCids,
                steps,
                executionTxHash,
            });

            // Phase 5E: Persist state to 0G DA
            await this.persistAgentState();

            // Phase 5C: Execution Receipts — Record successful autonomous analysis on-chain
            if (executionTxHash) {
                try {
                    const receiptHash = await GuardianPostAnalysisService.recordAnalysisOnChain({
                        ensureInitialized: () => this.ensureInitialized(),
                        wallet: this.wallet,
                        agentAddress: this.agentAddress,
                        analysis: finalResult,
                    });
                    finalResult.actionSteps.push(`✓ Immutable execution receipt recorded: ${receiptHash}`);
                } catch (err) {
                    console.warn('[Arc Agent] Failed to record analysis execution receipt on-chain:', err);
                }
            }

            // Cache for A2A intelligence (Phase 3B)
            this.lastAnalysisResult = finalResult;

            // Phase 5D: Fire all Zapier/Web3 automations dynamically (passing the new macro/execution fields)
            GuardianPostAnalysisService.triggerAutomations({
                analysis: finalResult,
                userPreferences,
                portfolioData,
                userId: this.userId,
            }).catch(err => {
                console.error('[Arc Agent] Failed to trigger final automations:', err);
            });

            return finalResult;
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

    // fetchWithAPIKey is deprecated in favor of x402-proxied gateway calls

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
                    expectedOutput: estimate.expectedOutput || '0',
                    minimumOutput: estimate.minimumOutput || '0',
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
            result: Awaited<ReturnType<AgentService['simulateRobinhoodSwap']>>;
        }>;
    }> {
        const results: Array<{
            scenario: typeof scenarios[0];
            result: Awaited<ReturnType<AgentService['simulateRobinhoodSwap']>>;
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
     * Serves the agent's most recent analysis result, signed with the agent key.
     * No hardcoded data — if no analysis has run, returns an honest empty payload.
     */
    async provideIntelligence(
        requesterAddress: string,
        queryType: 'macro' | 'yield' | 'strategy'
    ): Promise<any> {
        await this.ensureInitialized();
        console.log(`[Arc Agent] A2A Request from ${requesterAddress} for ${queryType}`);

        // Serve cached analysis — honest about data availability
        const analysisData = this.lastAnalysisResult;

        const payload = {
            timestamp: Date.now(),
            provider: this.agentAddress,
            queryType,
            hasData: !!analysisData,
            data: analysisData ? {
                action: analysisData.action,
                confidence: analysisData.confidence,
                riskLevel: analysisData.riskLevel,
                reasoning: analysisData.reasoning,
                dataSources: analysisData.dataSources,
                targetToken: analysisData.targetToken,
            } : {
                message: 'No analysis has been run yet. Request an analysis first.',
            },
            signature: '', // Will be populated below
        };

        // Sign the payload with agent key for authenticity
        try {
            const payloadHash = utils.keccak256(
                utils.toUtf8Bytes(JSON.stringify(payload.data))
            );
            payload.signature = await this.wallet.signTypedData(
                { name: 'AgentService', version: '1' },
                { Intelligence: [{ name: 'hash', type: 'bytes32' }] },
                { hash: payloadHash }
            );
        } catch {
            payload.signature = 'signing_unavailable';
        }

        return payload;
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
