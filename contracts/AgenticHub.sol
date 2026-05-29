// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgenticHub
 * @notice Handles micro-settlements for AI-generated financial insights.
 * Users pay a small fee in cUSD to access agent services.
 */
contract AgenticHub is Ownable {
    IERC20 public immutable cUSD;
    uint256 public insightPrice = 0.01 * 10**18; // 0.01 cUSD

    event InsightPurchased(address indexed user, uint256 timestamp);

    constructor(address _cUSD, address _initialOwner) Ownable(_initialOwner) {
        cUSD = IERC20(_cUSD);
    }

    /**
     * @notice Purchase access to an AI insight.
     * Users must approve this contract to spend their cUSD first.
     */
    function purchaseInsight() external {
        require(cUSD.transferFrom(msg.sender, address(this), insightPrice), "Payment failed");
        emit InsightPurchased(msg.sender, block.timestamp);
    }

    /**
     * @notice Update the price of an insight (admin only).
     */
    function setInsightPrice(uint256 _newPrice) external onlyOwner {
        insightPrice = _newPrice;
    }

    /**
     * @notice Withdraw collected fees (admin only).
     */
    function withdraw() external onlyOwner {
        uint256 balance = cUSD.balanceOf(address(this));
        require(balance > 0, "No funds to withdraw");
        cUSD.transfer(owner(), balance);
    }
}
