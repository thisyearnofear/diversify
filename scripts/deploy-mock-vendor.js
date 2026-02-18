const hre = require("hardhat");

async function main() {
    console.log("Starting deployment of MockStockVendor...");

    // Get the signers
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Deploy
    const MockStockVendor = await hre.ethers.getContractFactory("MockStockVendor");
    const vendor = await MockStockVendor.deploy();

    await vendor.waitForDeployment(); // Updated for newer ethers/hardhat versions

    const address = await vendor.getAddress();
    console.log("MockStockVendor deployed to:", address);

    console.log("Done!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
