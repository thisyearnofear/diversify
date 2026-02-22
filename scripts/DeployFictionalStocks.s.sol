// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../contracts/TestnetStock.sol";
import "../contracts/TestnetMarketMaker.sol";

contract DeployFictionalStocks is Script {
    // Reuse existing infra from first deployment
    address constant AMM  = 0xBD6a279E7b58000Ac01FBfba23a0bFbFCA8e43a3;
    address constant WETH = 0x95fa0c32181d073FA9b07F0eC3961C845d00bE21;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // Deploy fictional stock tokens
        TestnetStock acme    = new TestnetStock("Acme Corporation",    "ACME",    18);
        TestnetStock spacely = new TestnetStock("Spacely Sprockets",   "SPACELY", 18);
        TestnetStock wayne   = new TestnetStock("Wayne Industries",    "WAYNE",   18);
        TestnetStock oscorp  = new TestnetStock("Oscorp Industries",   "OSCORP",  18);
        TestnetStock stark   = new TestnetStock("Stark Industries",    "STARK",   18);

        console.log("ACME:",    address(acme));
        console.log("SPACELY:", address(spacely));
        console.log("WAYNE:",   address(wayne));
        console.log("OSCORP:",  address(oscorp));
        console.log("STARK:",   address(stark));

        // Approve tokens for AMM
        uint256 stockPerPool = 10_000 * 1e18;
        acme.approve(AMM, stockPerPool);
        spacely.approve(AMM, stockPerPool);
        wayne.approve(AMM, stockPerPool);
        oscorp.approve(AMM, stockPerPool);
        stark.approve(AMM, stockPerPool);

        // Seed pools — 0.0008 ETH each (total 0.004 ETH)
        TestnetMarketMaker amm = TestnetMarketMaker(payable(AMM));
        uint256 ethPerPool = 0.0008 ether;

        amm.seedPoolETH{value: ethPerPool}(address(acme),    stockPerPool);
        amm.seedPoolETH{value: ethPerPool}(address(spacely), stockPerPool);
        amm.seedPoolETH{value: ethPerPool}(address(wayne),   stockPerPool);
        amm.seedPoolETH{value: ethPerPool}(address(oscorp),  stockPerPool);
        amm.seedPoolETH{value: ethPerPool}(address(stark),   stockPerPool);

        vm.stopBroadcast();

        console.log("---");
        console.log("Fictional stocks deployed and pools seeded.");
        console.log("Total ETH for liquidity:", ethPerPool * 5);
    }
}
