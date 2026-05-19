/**
 * Wallet Service
 * Handles wallet creation, loading, key management, and balance queries
 */

import { ethers, providers, Wallet, Contract, utils } from 'ethers';
import { RealCircleWalletProvider } from './circle-wallet-provider-real';
import { AgentWalletProvider } from '../types/wallet-provider';

export class WalletService {
    private provider: providers.JsonRpcProvider;
    private wallet!: AgentWalletProvider;
    private userId?: string;
    private agentAddress: string = '';
    private initialized: boolean = false;
    private circleService: any; // Will be injected

    constructor(config: {
        userId?: string;
        privateKey?: string;
        sessionKey?: { privateKey: string; permission: import('./erc7715-service').SessionPermission };
        circleWalletId?: string;
        circleApiKey?: string;
        circleEntitySecret?: string;
        circleBaseUrl?: string;
        rpcUrl: string;
        circleService: any;
    }) {
        this.userId = config.userId;
        this.circleService = config.circleService;
        this.provider = new providers.JsonRpcProvider(config.rpcUrl);
        
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
            throw new Error('No wallet configuration provided for WalletService');
        }
    }

    public async ensureInitialized(): Promise<void> {
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

    getAddress(): string {
        return this.wallet!.getAddress();
    }

    getExecutionSigner(): any {
        return this.wallet!.getExecutionSigner();
    }

    getAgentAddress(): string {
        return this.agentAddress;
    }

    getUserId(): string | undefined {
        return this.userId;
    }

    async getUSDCBalance(): Promise<number> {
        await this.ensureInitialized();
        try {
            const ARC_CONFIG = {
                USDC_TESTNET: '0x3600000000000000000000000000000000000000' // Native USDC on Arc
            };
            return await this.wallet.balanceOf(ARC_CONFIG.USDC_TESTNET);
        } catch (error) {
            console.error('Failed to get USDC balance:', error);
            return 0;
        }
    }

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

    async transfer(to: string, amount: string, tokenAddress: string): Promise<any> {
        await this.ensureInitialized();
        const abi = ['function transfer(address, uint256) returns (bool)', 'function decimals() view returns (uint8)'];
        const contract = new Contract(tokenAddress, abi, this.wallet as any);
        const decimals = await contract.decimals();
        const amountWei = ethers.utils.parseUnits(amount, decimals);
        const tx = await contract.transfer(to, amountWei);
        return await tx.wait();
    }

    async signTypedData(domain: any, types: any, value: any): Promise<string> {
        await this.ensureInitialized();
        return await this.wallet!.signTypedData(domain, types, value);
    }

    async signTransaction(tx: any): Promise<string> {
        await this.ensureInitialized();
        return await this.wallet.signTransaction(tx);
    }

    async sendTransaction(tx: any): Promise<any> {
        await this.ensureInitialized();
        return await this.wallet.sendTransaction(tx);
    }

    async balanceOf(tokenAddress: string): Promise<number> {
        await this.ensureInitialized();
        const abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        const contract = new Contract(tokenAddress, abi, this.provider);
        const [balance, decimals] = await Promise.all([
            contract.balanceOf(this.wallet!.getAddress()),
            contract.decimals()
        ]);
        return parseFloat(ethers.utils.formatUnits(balance, decimals));
    }

    isInitialized(): boolean {
        return this.initialized;
    }
}

// Reuse existing provider classes from agent-service.ts
class EthersWalletProvider implements AgentWalletProvider {
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
        return parseFloat(ethers.utils.formatUnits(balance, decimals));
    }
    async transfer(to: string, amount: string, tokenAddress: string) {
        const abi = ['function transfer(address, uint256) returns (bool)', 'function decimals() view returns (uint8)'];
        const contract = new Contract(tokenAddress, abi, this.wallet as any);
        const decimals = await contract.decimals();
        const amountWei = ethers.utils.parseUnits(amount, decimals);
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
        // Simplified - would need to import erc7715Service in real implementation
        const result = await this.wallet.sendTransaction(tx);
        // this.spentTodayUSD += amountUSD; // Would need to extract amount from tx
        return result;
    }

    async balanceOf(tokenAddress: string) {
        const abi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        const contract = new Contract(tokenAddress, abi, this.provider);
        const [balance, decimals] = await Promise.all([
            contract.balanceOf(this.wallet.address),
            contract.decimals()
        ]);
        return parseFloat(ethers.utils.formatUnits(balance, decimals));
    }

    async transfer(to: string, amount: string, tokenAddress: string) {
        const abi = ['function transfer(address, uint256) returns (bool)', 'function decimals() view returns (uint8)'];
        const contract = new Contract(tokenAddress, abi, this.wallet as any);
        const decimals = await contract.decimals();
        const amountWei = ethers.utils.parseUnits(amount, decimals);
        const tx = await contract.transfer(to, amountWei);
        return await tx.wait();
    }

    async signTypedData(domain: any, types: any, value: any): Promise<string> {
        // Simplified - would need to import erc7715Service in real implementation
        const sig = await this.wallet._signTypedData(domain, types, value);
        // this.spentTodayUSD += amountUSD; // Would need to extract amount from value
        return sig;
    }
}
