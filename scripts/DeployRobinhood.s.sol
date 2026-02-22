// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../contracts/WETH9.sol";
import "../contracts/TestnetStock.sol";
import "../contracts/TestnetMarketMaker.sol";

contract DeployRobinhood is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy WETH
        WETH9 weth = new WETH9();
        console.log("WETH:", address(weth));

        // 2. Deploy stock tokens (each mints 1M to deployer)
        TestnetStock tsla = new TestnetStock("Tesla (Testnet)", "TSLA", 18);
        TestnetStock amzn = new TestnetStock("Amazon (Testnet)", "AMZN", 18);
        TestnetStock pltr = new TestnetStock("Palantir (Testnet)", "PLTR", 18);
        TestnetStock nflx = new TestnetStock("Netflix (Testnet)", "NFLX", 18);
        TestnetStock amd  = new TestnetStock("AMD (Testnet)", "AMD", 18);
        console.log("TSLA:", address(tsla));
        console.log("AMZN:", address(amzn));
        console.log("PLTR:", address(pltr));
        console.log("NFLX:", address(nflx));
        console.log("AMD:",  address(amd));

        // 3. Deploy AMM
        TestnetMarketMaker amm = new TestnetMarketMaker(address(weth));
        console.log("AMM:", address(amm));

        // 4. Approve stock tokens for AMM (100k each for seeding)
        uint256 stockPerPool = 10_000 * 1e18;
        tsla.approve(address(amm), stockPerPool);
        amzn.approve(address(amm), stockPerPool);
        pltr.approve(address(amm), stockPerPool);
        nflx.approve(address(amm), stockPerPool);
        amd.approve(address(amm),  stockPerPool);

        // 5. Seed ETH/stock pools
        //    0.003 ETH per pool = 0.015 ETH total liquidity
        //    10,000 stock tokens per pool
        //    Implied price: 0.0000003 ETH per token (testnet, UI uses EXCHANGE_RATES)
        uint256 ethPerPool = 0.003 ether;

        amm.seedPoolETH{value: ethPerPool}(address(tsla), stockPerPool);
        amm.seedPoolETH{value: ethPerPool}(address(amzn), stockPerPool);
        amm.seedPoolETH{value: ethPerPool}(address(pltr), stockPerPool);
        amm.seedPoolETH{value: ethPerPool}(address(nflx), stockPerPool);
        amm.seedPoolETH{value: ethPerPool}(address(amd),  stockPerPool);

        vm.stopBroadcast();

        console.log("---");
        console.log("All pools seeded. Total ETH used for liquidity:", ethPerPool * 5);
    }
}
