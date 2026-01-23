# Circle Real Implementation Plan
## Moving from Mock/Placeholder to 100% Production-Ready

### 🎯 Current State Analysis

Based on code review, here's what's currently mock/placeholder:

#### 1. **Circle Developer-Controlled Wallets** (`services/arc-agent.ts`, `scripts/create-circle-wallet.ts`)
- ✅ **SDK Integration**: Already using `@circle-fin/developer-controlled-wallets` v10.0.1
- ❌ **Mock Behavior**: `CircleWalletProvider` class simulates API responses
- ❌ **Placeholder Addresses**: Using generated addresses instead of real Circle wallet addresses
- ❌ **Simulated Transactions**: `signTransaction()` and `sendTransaction()` return mock hashes

#### 2. **Circle Gateway Service** (`services/circle-gateway.ts`)
- ❌ **All API Calls Simulated**: No actual calls to Circle Gateway API
- ❌ **Mock Balance Fetching**: Returns simulated unified balances
- ❌ **Placeholder Transfers**: `transferUSDCViaGateway()` returns fake transaction hashes
- ❌ **No Authentication**: API key and entity secret not used for real calls

#### 3. **Circle Bridge Kit Service** (`services/circle-bridge-kit.ts`)
- ❌ **All API Calls Simulated**: No actual calls to Circle Bridge Kit API
- ❌ **Mock Quotes**: `getBridgeQuote()` returns simulated pricing
- ❌ **Placeholder Bridge Transactions**: `bridgeUSDC()` returns fake transaction IDs
- ❌ **No Status Tracking**: `getBridgeTransactionStatus()` returns hardcoded responses

#### 4. **Transaction Verification** (`services/arc-agent.ts`)
- ❌ **Placeholder Hashes**: Using generated strings instead of real blockchain transaction hashes
- ❌ **No On-Chain Verification**: No actual verification of Circle transactions on-chain

---

## 🚀 Implementation Roadmap

### Phase 1: Circle Developer-Controlled Wallets (CRITICAL)

#### Step 1.1: Real Wallet Creation ✅ (Already Working)
The `scripts/create-circle-wallet.ts` already uses the real Circle SDK:
```typescript
const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
});
const walletSetResponse = await client.createWalletSet({ name: "DiversiFi Agent Wallets" });
const walletsResponse = await client.createWallets({ blockchains: ["ARC-TESTNET"], count: 1, walletSetId });
```

**Status**: ✅ This is REAL - just needs API keys to run

#### Step 1.2: Replace `CircleWalletProvider` Mock Implementation
**File**: `services/arc-agent.ts` (lines 148-215)

**Current Mock Code**:
```typescript
export class CircleWalletProvider implements AgentWalletProvider {
    getAddress() {
        return '0x' + 'circle_wallet_' + this.walletId.slice(0, 10).padEnd(30, '0');
    }
    async signTransaction(tx: any) {
        return '0x' + 'circle_signed_' + Math.random().toString(16).slice(2, 58);
    }
    async sendTransaction(tx: any) {
        return { hash: '0x' + 'circle_tx_' + Math.random().toString(16).slice(2, 58) };
    }
}
```

**Real Implementation Needed**:
```typescript
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

export class CircleWalletProvider implements AgentWalletProvider {
    private client: any;
    private walletAddress: string | null = null;

    constructor(private walletId: string, private apiKey: string, private entitySecret: string) {
        this.client = initiateDeveloperControlledWalletsClient({
            apiKey: this.apiKey,
            entitySecret: this.entitySecret,
        });
    }

    async initialize() {
        // Fetch real wallet details from Circle API
        const response = await this.client.getWallet({ id: this.walletId });
        this.walletAddress = response.data?.wallet?.address;
        if (!this.walletAddress) {
            throw new Error(`Failed to fetch wallet address for ${this.walletId}`);
        }
    }

    getAddress() {
        if (!this.walletAddress) {
            throw new Error('Wallet not initialized. Call initialize() first.');
        }
        return this.walletAddress;
    }

    async balanceOf(tokenAddress: string) {
        // Use Circle's balance API
        const response = await this.client.getWalletTokenBalance({
            id: this.walletId,
            tokenAddress: tokenAddress
        });
        return parseFloat(response.data?.tokenBalance?.amount || '0');
    }

    async transfer(to: string, amount: string, tokenAddress: string) {
        // Use Circle's transaction API
        const response = await this.client.createTransaction({
            walletId: this.walletId,
            blockchain: 'ARC-TESTNET', // or dynamically determined
            tokenAddress: tokenAddress,
            destinationAddress: to,
            amounts: [amount],
            fee: {
                type: 'level',
                config: {
                    feeLevel: 'MEDIUM'
                }
            }
        });

        // Wait for transaction to be broadcast
        const txId = response.data?.transaction?.id;
        if (!txId) {
            throw new Error('Failed to create transaction');
        }

        // Poll for transaction status
        let status = 'PENDING';
        let txHash = null;
        while (status === 'PENDING') {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const statusResponse = await this.client.getTransaction({ id: txId });
            status = statusResponse.data?.transaction?.state;
            txHash = statusResponse.data?.transaction?.txHash;
        }

        if (status !== 'COMPLETE') {
            throw new Error(`Transaction failed with status: ${status}`);
        }

        return {
            transactionHash: txHash,
            from: this.walletAddress,
            to: to,
            amount: amount,
            token: tokenAddress,
            status: 'completed'
        };
    }
}
```

**Required Changes**:
1. Add `entitySecret` to constructor
2. Add `initialize()` method to fetch real wallet address
3. Implement real `balanceOf()` using Circle API
4. Implement real `transfer()` with transaction polling
5. Add proper error handling for API failures

---

### Phase 2: Circle Gateway Service (HIGH PRIORITY)

#### Step 2.1: Research Circle Gateway API
**Action Required**: 
- Circle Gateway might be a conceptual feature or part of CCTP (Cross-Chain Transfer Protocol)
- Need to verify if "Circle Gateway" is a real API endpoint or if we should use CCTP directly
- Check Circle documentation for unified balance APIs

#### Step 2.2: Replace Mock Balance Fetching
**File**: `services/circle-gateway.ts` (lines 47-76)

**Current Mock**:
```typescript
async getUnifiedUSDCBalance(walletAddress: string): Promise<UnifiedUSDCBalance> {
    const arcBalance = await this.getUSDCBalanceOnArc(walletAddress);
    return {
        totalUSDC: arcBalance,
        chainBalances: [{ chainId: 5042002, chainName: 'Arc Testnet', usdcBalance: arcBalance }],
        arcBalance: arcBalance,
        ethereumBalance: '0',
        arbitrumBalance: '0'
    };
}
```

**Real Implementation Strategy**:
```typescript
async getUnifiedUSDCBalance(walletAddress: string): Promise<UnifiedUSDCBalance> {
    // Option 1: If Circle has a unified balance API
    const response = await fetch(`${CIRCLE_GATEWAY_API.BASE_URL}/balances/${walletAddress}`, {
        headers: {
            'Authorization': `Bearer ${CIRCLE_GATEWAY_API.API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Circle Gateway API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data; // Assuming Circle returns this format
    
    // Option 2: If no unified API, query each chain separately
    const [arcBalance, ethBalance, arbBalance] = await Promise.all([
        this.getUSDCBalanceOnChain(walletAddress, 'ARC-TESTNET'),
        this.getUSDCBalanceOnChain(walletAddress, 'ETH-MAINNET'),
        this.getUSDCBalanceOnChain(walletAddress, 'ARB-MAINNET')
    ]);
    
    return {
        totalUSDC: (parseFloat(arcBalance) + parseFloat(ethBalance) + parseFloat(arbBalance)).toString(),
        chainBalances: [
            { chainId: 5042002, chainName: 'Arc Testnet', usdcBalance: arcBalance },
            { chainId: 1, chainName: 'Ethereum', usdcBalance: ethBalance },
            { chainId: 42161, chainName: 'Arbitrum', usdcBalance: arbBalance }
        ],
        arcBalance,
        ethereumBalance: ethBalance,
        arbitrumBalance: arbBalance
    };
}
```

#### Step 2.3: Implement Real Cross-Chain Transfers
**File**: `services/circle-gateway.ts` (lines 102-129)

**Real Implementation**:
```typescript
async transferUSDCViaGateway(
    fromChainId: number,
    toChainId: number,
    amount: string,
    walletAddress: string
): Promise<string> {
    // Use Circle CCTP (Cross-Chain Transfer Protocol)
    const response = await fetch(`${CIRCLE_GATEWAY_API.BASE_URL}/transfers`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CIRCLE_GATEWAY_API.API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            source: {
                chain: this.getCircleChainId(fromChainId),
                address: walletAddress
            },
            destination: {
                chain: this.getCircleChainId(toChainId),
                address: walletAddress
            },
            amount: {
                amount: amount,
                currency: 'USD'
            }
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Circle Gateway transfer failed: ${error.message}`);
    }
    
    const data = await response.json();
    return data.transferId || data.transactionHash;
}
```

---

### Phase 3: Circle Bridge Kit Service (HIGH PRIORITY)

#### Step 3.1: Verify Circle Bridge Kit API Existence
**Research Needed**:
- Circle Bridge Kit might be a conceptual wrapper around CCTP
- Check if there's a dedicated Bridge Kit SDK or if we should use CCTP directly
- Verify API endpoints and authentication methods

#### Step 3.2: Implement Real Bridge Quotes
**File**: `services/circle-bridge-kit.ts` (lines 52-86)

**Real Implementation**:
```typescript
async getBridgeQuote(
    sourceChainId: number,
    destinationChainId: number,
    amount: string,
    tokenAddress: string
): Promise<BridgeQuote> {
    const response = await fetch(`${CIRCLE_BRIDGE_API.BASE_URL}/quotes`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CIRCLE_BRIDGE_API.API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sourceChain: this.getCircleChainId(sourceChainId),
            destinationChain: this.getCircleChainId(destinationChainId),
            amount: amount,
            token: 'USDC'
        })
    });
    
    if (!response.ok) {
        throw new Error(`Failed to get bridge quote: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
        sourceChainId,
        destinationChainId,
        amount,
        token: tokenAddress,
        estimatedAmountOut: data.estimatedOutput,
        estimatedFees: data.fees,
        estimatedTime: data.estimatedSeconds,
        quoteId: data.quoteId,
        expiration: data.expiresAt
    };
}
```

#### Step 3.3: Implement Real Bridge Execution
**File**: `services/circle-bridge-kit.ts` (lines 91-128)

**Real Implementation**:
```typescript
async bridgeUSDC(
    sourceChainId: number,
    destinationChainId: number,
    amount: string,
    walletAddress: string,
    quoteId: string
): Promise<BridgeTransaction> {
    // Execute bridge transaction using Circle API
    const response = await fetch(`${CIRCLE_BRIDGE_API.BASE_URL}/bridge`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CIRCLE_BRIDGE_API.API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            quoteId: quoteId,
            sourceAddress: walletAddress,
            destinationAddress: walletAddress
        })
    });
    
    if (!response.ok) {
        throw new Error(`Bridge execution failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
        transactionId: data.bridgeTransactionId,
        sourceChainId,
        destinationChainId,
        amount,
        token: 'USDC',
        status: data.status === 'COMPLETE' ? 'completed' : 'pending',
        createdAt: data.createdAt,
        completedAt: data.completedAt
    };
}
```

#### Step 3.4: Implement Real Transaction Status Tracking
**File**: `services/circle-bridge-kit.ts` (lines 133-153)

**Real Implementation**:
```typescript
async getBridgeTransactionStatus(transactionId: string): Promise<BridgeTransaction> {
    const response = await fetch(
        `${CIRCLE_BRIDGE_API.BASE_URL}/bridge/${transactionId}`,
        {
            headers: {
                'Authorization': `Bearer ${CIRCLE_BRIDGE_API.API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );
    
    if (!response.ok) {
        throw new Error(`Failed to fetch bridge status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
        transactionId: data.id,
        sourceChainId: this.parseChainId(data.sourceChain),
        destinationChainId: this.parseChainId(data.destinationChain),
        amount: data.amount,
        token: 'USDC',
        status: this.mapStatus(data.status),
        createdAt: data.createdAt,
        completedAt: data.completedAt
    };
}

private mapStatus(circleStatus: string): 'pending' | 'completed' | 'failed' {
    switch (circleStatus) {
        case 'COMPLETE': return 'completed';
        case 'FAILED': return 'failed';
        default: return 'pending';
    }
}
```

---

### Phase 4: Production-Grade Features

#### Step 4.1: Transaction Replay Protection
**File**: `services/arc-agent.ts`

**Implementation**:
```typescript
private usedNonces = new Set<string>();

private generateNonce(): string {
    const nonce = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    if (this.usedNonces.has(nonce)) {
        return this.generateNonce(); // Retry if collision
    }
    this.usedNonces.add(nonce);
    return nonce;
}

async executeUSDCPayment(recipient: string, amount: string): Promise<any> {
    const nonce = this.generateNonce();
    
    // Include nonce in transaction metadata
    const tx = await this.wallet.transfer(recipient, amount, ARC_CONFIG.USDC_TESTNET);
    
    // Store nonce with transaction hash for replay protection
    await this.storeTransactionNonce(tx.transactionHash, nonce);
    
    return tx;
}
```

#### Step 4.2: Database Storage for Transaction History
**New File**: `services/transaction-storage.ts`

**Implementation**:
```typescript
export interface StoredTransaction {
    id: string;
    hash: string;
    from: string;
    to: string;
    amount: string;
    token: string;
    nonce: string;
    status: 'pending' | 'completed' | 'failed';
    createdAt: string;
    completedAt?: string;
    metadata?: any;
}

export class TransactionStorage {
    // For now, use localStorage on client / in-memory on server
    // Later: Replace with real database (Supabase, Firebase, PostgreSQL)
    
    async storeTransaction(tx: StoredTransaction): Promise<void> {
        // TODO: Replace with real database
        if (typeof window !== 'undefined') {
            const existing = this.getAllTransactions();
            existing.push(tx);
            localStorage.setItem('arc_transactions', JSON.stringify(existing));
        }
    }
    
    async getTransaction(id: string): Promise<StoredTransaction | null> {
        const all = this.getAllTransactions();
        return all.find(tx => tx.id === id) || null;
    }
    
    getAllTransactions(): StoredTransaction[] {
        if (typeof window === 'undefined') return [];
        const stored = localStorage.getItem('arc_transactions');
        return stored ? JSON.parse(stored) : [];
    }
    
    async updateTransactionStatus(
        id: string, 
        status: 'pending' | 'completed' | 'failed'
    ): Promise<void> {
        const all = this.getAllTransactions();
        const tx = all.find(t => t.id === id);
        if (tx) {
            tx.status = status;
            if (status === 'completed' || status === 'failed') {
                tx.completedAt = new Date().toISOString();
            }
            localStorage.setItem('arc_transactions', JSON.stringify(all));
        }
    }
}
```

#### Step 4.3: Proper Nonce Management
**File**: `services/arc-agent.ts`

**Implementation**:
```typescript
private async getNextNonce(): Promise<number> {
    // For Circle wallets, nonce is managed by Circle
    // For EOA wallets, fetch from blockchain
    if (this.wallet instanceof EthersWalletProvider) {
        return await this.provider.getTransactionCount(this.agentAddress, 'pending');
    }
    // Circle manages nonces internally
    return 0;
}
```

#### Step 4.4: Comprehensive Error Handling
**File**: All service files

**Implementation Pattern**:
```typescript
async methodName(...args): Promise<ReturnType> {
    try {
        // Validate inputs
        if (!args[0]) {
            throw new ValidationError('Missing required parameter');
        }
        
        // Make API call
        const response = await fetch(url, options);
        
        // Handle HTTP errors
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new APIError(
                `API request failed: ${response.status}`,
                response.status,
                errorData
            );
        }
        
        // Parse and validate response
        const data = await response.json();
        if (!this.validateResponse(data)) {
            throw new ValidationError('Invalid API response format');
        }
        
        return data;
        
    } catch (error) {
        // Log error with context
        console.error(`[MethodName] Error:`, {
            error: error.message,
            args,
            timestamp: new Date().toISOString()
        });
        
        // Rethrow with context
        if (error instanceof APIError || error instanceof ValidationError) {
            throw error;
        }
        throw new Error(`Unexpected error in methodName: ${error.message}`);
    }
}
```

---

## 📋 Implementation Checklist

### Prerequisites
- [ ] Obtain Circle API credentials from https://console.circle.com/
  - [ ] `CIRCLE_API_KEY`
  - [ ] `CIRCLE_ENTITY_SECRET`
- [ ] Create Circle Developer-Controlled Wallet
  - [ ] Run `pnpm create-wallet`
  - [ ] Save `CIRCLE_WALLET_ID` and `CIRCLE_WALLET_ADDRESS`
- [ ] Fund wallet with testnet USDC from https://faucet.circle.com/

### Phase 1: Circle Wallets
- [ ] Update `CircleWalletProvider` constructor to accept `entitySecret`
- [ ] Implement `initialize()` method to fetch real wallet address
- [ ] Replace mock `getAddress()` with real address from Circle API
- [ ] Implement real `balanceOf()` using Circle's balance API
- [ ] Implement real `transfer()` with transaction creation and polling
- [ ] Add error handling for all Circle API calls
- [ ] Test wallet creation and balance fetching
- [ ] Test real USDC transfers on Arc Testnet

### Phase 2: Circle Gateway
- [ ] Research Circle Gateway API documentation
- [ ] Determine if using CCTP or dedicated Gateway API
- [ ] Implement real `getUnifiedUSDCBalance()`
- [ ] Implement real `transferUSDCViaGateway()`
- [ ] Implement real `verifyGatewayTransaction()`
- [ ] Add proper authentication headers
- [ ] Test cross-chain balance queries
- [ ] Test cross-chain transfers

### Phase 3: Circle Bridge Kit
- [ ] Research Circle Bridge Kit API documentation
- [ ] Implement real `getBridgeQuote()`
- [ ] Implement real `bridgeUSDC()`
- [ ] Implement real `getBridgeTransactionStatus()`
- [ ] Add quote expiration handling
- [ ] Add transaction status polling
- [ ] Test bridge quotes
- [ ] Test bridge execution and status tracking

### Phase 4: Production Features
- [ ] Implement transaction replay protection
- [ ] Create `TransactionStorage` service
- [ ] Integrate transaction storage with all payment methods
- [ ] Implement proper nonce management
- [ ] Add comprehensive error handling to all services
- [ ] Create custom error classes (`APIError`, `ValidationError`, etc.)
- [ ] Add request/response logging
- [ ] Implement retry logic with exponential backoff
- [ ] Add rate limiting protection
- [ ] Create transaction history UI

### Testing & Validation
- [ ] Test wallet initialization with real API keys
- [ ] Test balance fetching across multiple chains
- [ ] Test USDC transfers with real transactions
- [ ] Test bridge quotes and execution
- [ ] Test error handling (invalid inputs, API failures, network errors)
- [ ] Test transaction replay protection
- [ ] Test nonce management under concurrent requests
- [ ] Load test with multiple simultaneous transactions
- [ ] Verify all transactions on block explorers

### Documentation
- [ ] Update README with real Circle integration details
- [ ] Document API key setup process
- [ ] Create troubleshooting guide
- [ ] Add example usage for each service
- [ ] Document error codes and handling

---

## 🔑 Environment Variables Required

Add to `.env.local`:

```bash
# Circle Developer-Controlled Wallets
CIRCLE_API_KEY=your_api_key_from_circle_console
CIRCLE_ENTITY_SECRET=your_entity_secret_from_circle_console
CIRCLE_WALLET_ID=wallet_id_from_create_wallet_script
CIRCLE_WALLET_ADDRESS=0x_address_from_create_wallet_script

# Circle Gateway (if separate from main API)
CIRCLE_GATEWAY_API_KEY=your_gateway_api_key
CIRCLE_GATEWAY_BASE_URL=https://api.circle.com/v1/gateway

# Circle Bridge Kit (if separate from main API)
CIRCLE_BRIDGE_API_KEY=your_bridge_api_key
CIRCLE_BRIDGE_BASE_URL=https://api.circle.com/v1/bridge

# Arc Network
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_USDC_ADDRESS=0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B

# Agent Configuration
ARC_AGENT_DAILY_LIMIT=5.0
ARC_AGENT_TESTNET=true
```

---

## 🚨 Critical Notes

1. **API Endpoint Verification**: Circle's API structure needs to be verified. The endpoints used in this plan (`/balances`, `/transfers`, `/quotes`, `/bridge`) are conceptual and need to be confirmed against actual Circle API documentation.

2. **CCTP vs Gateway vs Bridge Kit**: Circle might use different terminology. CCTP (Cross-Chain Transfer Protocol) is their known cross-chain solution. "Gateway" and "Bridge Kit" might be marketing terms or conceptual wrappers.

3. **SDK Version**: Currently using `@circle-fin/developer-controlled-wallets` v10.0.1. Verify this is the latest version and check for any breaking changes.

4. **Testnet vs Mainnet**: Start all testing on Arc Testnet and other testnets. Only move to mainnet after thorough testing.

5. **Transaction Costs**: Real transactions will incur gas fees. Ensure adequate funding for testing.

6. **Rate Limiting**: Circle APIs likely have rate limits. Implement proper throttling and retry logic.

7. **Security**: Never commit API keys or entity secrets to version control. Use environment variables and `.env.local`.

---

## 📚 Next Steps

1. **Research Phase**: Spend time reading Circle's official documentation to verify API endpoints and methods
2. **Prototype Phase**: Implement one service at a time, starting with Circle Wallets
3. **Testing Phase**: Thoroughly test each implementation before moving to the next
4. **Integration Phase**: Integrate all services and test end-to-end flows
5. **Production Phase**: Deploy with monitoring and error tracking

---

**Ready to start implementation once you provide the API keys!**
