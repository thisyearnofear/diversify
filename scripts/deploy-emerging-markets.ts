/**
 * Deploy Emerging Markets Paper Trading System to Celo Alfajores
 * 
 * This script deploys:
 * 1. 9 EmergingMarketToken contracts (one for each stock)
 * 2. EmergingMarketsAMM contract
 * 3. Creates initial liquidity pools
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-emerging-markets.ts --network celoAlfajores
 */

import { ethers } from "hardhat";
import { EMERGING_MARKET_STOCKS, EMERGING_MARKETS_CONFIG } from "../config/emerging-markets";

const CUSD_ADDRESS = EMERGING_MARKETS_CONFIG.baseCurrencyAddress;
const INITIAL_SUPPLY = ethers.utils.parseEther("1000000"); // 1M tokens
const INITIAL_LIQUIDITY_TOKEN = ethers.utils.parseEther("10000"); // 10k tokens per pool
const INITIAL_LIQUIDITY_CUSD = ethers.utils.parseEther("10000"); // 10k cUSD per pool

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🚀 Deploying Emerging Markets Paper Trading System");
  console.log("📍 Network: Celo Alfajores");
  console.log("👤 Deployer:", deployer.address);
  console.log("");

  // Deploy AMM
  console.log("1️⃣ Deploying EmergingMarketsAMM...");
  const AMM = await ethers.getContractFactory("EmergingMarketsAMM");
  const amm = await AMM.deploy(CUSD_ADDRESS);
  await amm.deployed();
  console.log("✅ AMM deployed at:", amm.address);
  console.log("");

  // Deploy tokens
  console.log("2️⃣ Deploying Emerging Market Tokens...");
  const Token = await ethers.getContractFactory("EmergingMarketToken");
  const deployedTokens: Record<string, string> = {};

  for (const stock of EMERGING_MARKET_STOCKS) {
    console.log(`   Deploying ${stock.symbol} (${stock.name})...`);
    
    const token = await Token.deploy(
      `${stock.name} Paper Token`,
      stock.symbol,
      stock.market,
      stock.realTicker,
      deployer.address, // Oracle (deployer for now)
      INITIAL_SUPPLY
    );
    await token.deployed();
    
    deployedTokens[stock.symbol] = token.address;
    console.log(`   ✅ ${stock.symbol}: ${token.address}`);
  }
  console.log("");

  // Create liquidity pools
  console.log("3️⃣ Creating Liquidity Pools...");
  
  // Approve AMM to spend tokens
  for (const [symbol, address] of Object.entries(deployedTokens)) {
    console.log(`   Approving ${symbol}...`);
    const token = await ethers.getContractAt("EmergingMarketToken", address);
    await token.approve(amm.address, INITIAL_LIQUIDITY_TOKEN);
  }

  // Approve cUSD
  console.log("   Approving cUSD...");
  const cUSD = await ethers.getContractAt("IERC20", CUSD_ADDRESS);
  const totalCUSDNeeded = INITIAL_LIQUIDITY_CUSD.mul(EMERGING_MARKET_STOCKS.length);
  await cUSD.approve(amm.address, totalCUSDNeeded);

  // Create pools
  for (const [symbol, address] of Object.entries(deployedTokens)) {
    console.log(`   Creating pool for ${symbol}...`);
    await amm.createPool(address, INITIAL_LIQUIDITY_TOKEN, INITIAL_LIQUIDITY_CUSD);
    console.log(`   ✅ Pool created for ${symbol}`);
  }
  console.log("");

  // Summary
  console.log("🎉 Deployment Complete!");
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log("   AMM:", amm.address);
  console.log("");
  console.log("   Tokens:");
  for (const [symbol, address] of Object.entries(deployedTokens)) {
    console.log(`   ${symbol}: ${address}`);
  }
  console.log("");
  console.log("📝 Next Steps:");
  console.log("   1. Update config/emerging-markets.ts with contract addresses");
  console.log("   2. Set up price oracle service to update prices daily");
  console.log("   3. Fund deployer address with cUSD for initial liquidity");
  console.log("   4. Test trading on Celo Alfajores");
  console.log("");
  console.log("🔗 Explorer:");
  console.log(`   ${EMERGING_MARKETS_CONFIG.explorerUrl}/address/${amm.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
