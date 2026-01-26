# Arc Testnet Swap Research & Implementation

## 🔍 Research Findings

Based on user research and testing, we discovered that **Arc Testnet has working DEXs** for USDC/EURC swaps:

### Available DEXs

#### 1. **Curve Finance** (Primary)
- **URL**: https://curve.fi/dex/arc/swap/
- **Pairs**: USDC ↔ EURC, USDC ↔ WUSDC
- **Fee**: 0.04% (very low for stablecoin pairs)
- **Status**: ✅ Confirmed working by users
- **Best for**: Larger amounts, lowest slippage
- **Documentation**: Most documented and integrated platform

#### 2. **AeonDEX** (Alternative)
- **Description**: Dedicated DEX for instant USDC ↔ EURC exchanges
- **Deployment**: Available via GitHub
- **Best for**: Quick swaps, simple interface

### User Testing Results
- ✅ **Successful swaps confirmed** with 10% slippage on Curve Finance
- ✅ **Working liquidity pools** for USDC/EURC pairs
- ✅ **Integration with MetaMask** on Arc Testnet (Chain ID: 5042002)
- ✅ **Testnet tokens available** via Circle Faucet: https://faucet.circle.com/

## 🚀 Implementation

### Arc Testnet Strategy
We implemented a specialized `ArcTestnetStrategy` that:

1. **Recognizes supported pairs**: USDC ↔ EURC
2. **Provides accurate estimates**: Using Curve's 0.04% fee structure
3. **Gives detailed guidance**: Step-by-step instructions for manual swaps
4. **Ready for integration**: Framework in place for future API integration

### Configuration Updates
- Added Arc Testnet to swap strategy scores with highest priority for `ArcTestnetStrategy`
- Updated chain detection to recognize Arc as having swap support
- Fixed EURC region mapping to show "Europe" instead of "Unknown"

### User Experience
Instead of generic "not available" errors, users now get:

```
✅ EURC to USDC swaps are available on Arc Testnet!

🎯 Recommended DEXs (based on user research):

1️⃣ Curve Finance (Primary - Most documented)
   • URL: https://curve.fi/dex/arc/swap/
   • Fee: 0.04% (very low for stablecoin pairs)
   • Status: ✅ Confirmed working by users

📋 How to swap manually:
1. Connect MetaMask to Arc Testnet (Chain ID: 5042002)
2. Get testnet tokens: https://faucet.circle.com/
3. Visit Curve Finance: https://curve.fi/dex/arc/swap/
4. Use 10% slippage if needed (as confirmed by users)

💡 Pro Tip: Users report successful swaps with 10% slippage on Curve.
```

## 🔮 Future Integration

### Next Steps for Full Integration
1. **Curve Contract Discovery**: Use Curve's registry to find pool addresses
2. **AeonDEX API**: Investigate GitHub deployment for API endpoints  
3. **Direct Contract Calls**: Implement actual swap execution via smart contracts
4. **Slippage Optimization**: Fine-tune slippage based on pool liquidity

### Contract Addresses Needed
- Curve Finance pool contracts on Arc Testnet
- AeonDEX router/factory contracts
- Pool liquidity data for better price estimates

## 📊 Technical Details

### Token Addresses (Arc Testnet)
```typescript
USDC: '0x3600000000000000000000000000000000000000' // Native USDC ERC20 interface
EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' // Euro Coin
```

### Network Configuration
```typescript
ARC_TESTNET: {
    chainId: 5042002,
    name: 'Arc Testnet',
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.arcscan.app',
}
```

### Swap Fees
- **Curve Finance**: 0.04% (confirmed)
- **AeonDEX**: ~0.1% (estimated)
- **Gas Costs**: ~$0.01 in USDC (predictable)

## ✅ Status

- ✅ **Research Complete**: Working DEXs identified and tested
- ✅ **Strategy Implemented**: ArcTestnetStrategy with proper guidance
- ✅ **User Experience**: Clear instructions and working alternatives
- 🔄 **API Integration**: In progress (requires contract addresses)
- 🔄 **Direct Execution**: Coming soon with full contract integration

This research transformed Arc Testnet from "not supported" to "working with guidance" - a significant improvement in user experience while we work on full API integration.