// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockUniswapV2Router {
    using SafeERC20 for IERC20;

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        require(amountOutMin > 0, "Min out required");

        // Pull input token from caller (the vault)
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);

        // Mint output token 1:1 for simplicity
        uint256 amountOut = amountIn;
        require(amountOut >= amountOutMin, "Slippage");

        // Use a simple mint on test output tokens. If the output token does not
        // support minting, we cannot satisfy the swap, so tests should use a
        // MockERC20 with a mint function.
        (bool success,) = path[1].call(abi.encodeWithSignature("mint(address,uint256)", to, amountOut));
        require(success, "Mock router requires mintable output token");

        amounts = new uint256[](path.length);
        for (uint256 i = 0; i < path.length; i++) {
            amounts[i] = amountIn;
        }
    }
}
