// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title AgenticHub
 * @notice Handles micro-settlements for AI-generated financial insights.
 * Users pay a small fee in the configured payment token to access agent services.
 *
 * Chain-agnostic: deploy with cUSD on Celo, USDC on Arbitrum, etc.
 */
contract AgenticHub is Ownable2Step {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;
    uint256 public insightPrice = 0.01 * 10 ** 18; // 0.01 payment tokens

    event InsightPurchased(address indexed user, uint256 timestamp);
    event InsightPriceUpdated(uint256 newPrice);

    error ZeroAddress();
    error NoFundsToWithdraw();

    constructor(address _paymentToken, address _initialOwner) Ownable(_initialOwner) {
        if (_paymentToken == address(0) || _initialOwner == address(0)) revert ZeroAddress();
        paymentToken = IERC20(_paymentToken);
    }

    /**
     * @notice Purchase access to an AI insight.
     * Users must approve this contract to spend their payment tokens first.
     */
    function purchaseInsight() external {
        paymentToken.safeTransferFrom(msg.sender, address(this), insightPrice);
        emit InsightPurchased(msg.sender, block.timestamp);
    }

    /**
     * @notice Update the price of an insight (admin only).
     */
    function setInsightPrice(uint256 _newPrice) external onlyOwner {
        insightPrice = _newPrice;
        emit InsightPriceUpdated(_newPrice);
    }

    /**
     * @notice Withdraw collected fees (admin only).
     */
    function withdraw() external onlyOwner {
        uint256 balance = paymentToken.balanceOf(address(this));
        if (balance == 0) revert NoFundsToWithdraw();
        paymentToken.safeTransfer(owner(), balance);
    }
}
