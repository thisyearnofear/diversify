// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../contracts/WETH9.sol";
import "../contracts/TestnetStock.sol";
import "../contracts/TestnetMarketMaker.sol";

/**
 * @title DeployCeloEmergingMarkets
 * @notice Deploy emerging markets paper trading to Celo Sepolia
 * @dev Uses proven v1 contracts (TestnetMarketMaker + TestnetStock)
 * 
 * Usage:
 *   forge script scripts/DeployCeloEmergingMarkets.s.sol:DeployCeloEmergingMarkets \
 *     --rpc-url https://forno.celo-sepolia.celo-testnet.org \
 *     --broadcast \
 *     --verify
 */
contract DeployCeloEmergingMarkets is Script {
    // Deployment config
    uint256 constant TOKENS_PER_POOL = 10_000 * 1e18; // 10k tokens
    uint256 constant CELO_PER_POOL = 3 ether; // 3 CELO per pool

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        console.log("========================================");
        console.log("Deploying Emerging Markets to Celo Sepolia");
        console.log("========================================");
        console.log("");

        // 1. Deploy WETH9 (wrapped CELO)
        console.log("1. Deploying WETH9 (Wrapped CELO)...");
        WETH9 weth = new WETH9();
        console.log("   WETH9:", address(weth));
        console.log("");

        // 2. Deploy emerging market stock tokens
        console.log("2. Deploying Emerging Market Stock Tokens...");
        
        // Africa
        TestnetStock safcom = new TestnetStock("Safaricom Paper Token", "SAFCOM", 18);
        TestnetStock dangote = new TestnetStock("Dangote Cement Paper Token", "DANGOTE", 18);
        TestnetStock shoprite = new TestnetStock("Shoprite Paper Token", "SHOPRITE", 18);
        
        // Latin America
        TestnetStock petrobras = new TestnetStock("Petrobras Paper Token", "PETROBRAS", 18);
        TestnetStock meli = new TestnetStock("MercadoLibre Paper Token", "MELI", 18);
        TestnetStock cemex = new TestnetStock("CEMEX Paper Token", "CEMEX", 18);
        
        // Asia
        TestnetStock reliance = new TestnetStock("Reliance Industries Paper Token", "RELIANCE", 18);
        TestnetStock grab = new TestnetStock("Grab Holdings Paper Token", "GRAB", 18);
        TestnetStock jollibee = new TestnetStock("Jollibee Foods Paper Token", "JOLLIBEE", 18);

        console.log("   Africa:");
        console.log("   SAFCOM:", address(safcom));
        console.log("   DANGOTE:", address(dangote));
        console.log("   SHOPRITE:", address(shoprite));
        console.log("");
        console.log("   Latin America:");
        console.log("   PETROBRAS:", address(petrobras));
        console.log("   MELI:", address(meli));
        console.log("   CEMEX:", address(cemex));
        console.log("");
        console.log("   Asia:");
        console.log("   RELIANCE:", address(reliance));
        console.log("   GRAB:", address(grab));
        console.log("   JOLLIBEE:", address(jollibee));
        console.log("");

        // 3. Deploy AMM
        console.log("3. Deploying TestnetMarketMaker (AMM)...");
        TestnetMarketMaker amm = new TestnetMarketMaker(address(weth));
        console.log("   AMM:", address(amm));
        console.log("");

        // 4. Approve tokens for AMM
        console.log("4. Approving tokens for liquidity provision...");
        safcom.approve(address(amm), TOKENS_PER_POOL);
        dangote.approve(address(amm), TOKENS_PER_POOL);
        shoprite.approve(address(amm), TOKENS_PER_POOL);
        petrobras.approve(address(amm), TOKENS_PER_POOL);
        meli.approve(address(amm), TOKENS_PER_POOL);
        cemex.approve(address(amm), TOKENS_PER_POOL);
        reliance.approve(address(amm), TOKENS_PER_POOL);
        grab.approve(address(amm), TOKENS_PER_POOL);
        jollibee.approve(address(amm), TOKENS_PER_POOL);
        console.log("   All tokens approved");
        console.log("");

        // 5. Seed liquidity pools
        console.log("5. Seeding liquidity pools...");
        amm.seedPoolETH{value: CELO_PER_POOL}(address(safcom), TOKENS_PER_POOL);
        amm.seedPoolETH{value: CELO_PER_POOL}(address(dangote), TOKENS_PER_POOL);
        amm.seedPoolETH{value: CELO_PER_POOL}(address(shoprite), TOKENS_PER_POOL);
        amm.seedPoolETH{value: CELO_PER_POOL}(address(petrobras), TOKENS_PER_POOL);
        amm.seedPoolETH{value: CELO_PER_POOL}(address(meli), TOKENS_PER_POOL);
        amm.seedPoolETH{value: CELO_PER_POOL}(address(cemex), TOKENS_PER_POOL);
        amm.seedPoolETH{value: CELO_PER_POOL}(address(reliance), TOKENS_PER_POOL);
        amm.seedPoolETH{value: CELO_PER_POOL}(address(grab), TOKENS_PER_POOL);
        amm.seedPoolETH{value: CELO_PER_POOL}(address(jollibee), TOKENS_PER_POOL);
        console.log("   All pools seeded with 10,000 tokens + 3 CELO each");
        console.log("");

        vm.stopBroadcast();

        // Summary
        console.log("========================================");
        console.log("Deployment Complete!");
        console.log("========================================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("---");
        console.log("WETH9 (Wrapped CELO):", address(weth));
        console.log("TestnetMarketMaker (AMM):", address(amm));
        console.log("");
        console.log("Emerging Market Tokens:");
        console.log("---");
        console.log("Africa:");
        console.log("  SAFCOM:", address(safcom));
        console.log("  DANGOTE:", address(dangote));
        console.log("  SHOPRITE:", address(shoprite));
        console.log("");
        console.log("Latin America:");
        console.log("  PETROBRAS:", address(petrobras));
        console.log("  MELI:", address(meli));
        console.log("  CEMEX:", address(cemex));
        console.log("");
        console.log("Asia:");
        console.log("  RELIANCE:", address(reliance));
        console.log("  GRAB:", address(grab));
        console.log("  JOLLIBEE:", address(jollibee));
        console.log("");
        console.log("Next Steps:");
        console.log("1. Update config/emerging-markets.ts with addresses");
        console.log("2. Verify contracts on Blockscout");
        console.log("3. Test trading on https://celo-sepolia.blockscout.com");
        console.log("4. Integrate with TradeTab UI");
        console.log("");
        console.log("Features Available:");
        console.log("- Public faucet (100 tokens/24h per stock)");
        console.log("- Gasless approvals (ERC20Permit)");
        console.log("- Liquidity provision");
        console.log("- Native CELO trading (auto-wrap/unwrap)");
        console.log("- 0.3% trading fee");
    }
}
