// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestnetStock
 * @notice Standard ERC20 representing an RWA stock token on testnets.
 *
 * - Owner (typically TestnetMarketMaker) can mint for liquidity seeding.
 * - Public faucet lets testers get a small amount for free, with a 24h cooldown
 *   to prevent unlimited self-minting that would make balances meaningless.
 */
contract TestnetStock is ERC20, Ownable {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant FAUCET_AMOUNT_UNITS = 10;   // 10 tokens per claim
    uint256 public constant FAUCET_COOLDOWN     = 1 days;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    uint8 private _tokenDecimals;

    /// @notice Tracks the last time each address used the faucet.
    mapping(address => uint256) public lastFaucetTime;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event FaucetClaimed(address indexed recipient, uint256 amount);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(
        string memory name,
        string memory symbol,
        uint8 __decimals
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _tokenDecimals = __decimals;
        // Mint 1 million tokens to deployer for initial liquidity seeding
        _mint(msg.sender, 1_000_000 * (10 ** uint256(__decimals)));
    }

    // -------------------------------------------------------------------------
    // Overrides
    // -------------------------------------------------------------------------
    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    // -------------------------------------------------------------------------
    // Owner (minting for market maker liquidity)
    // -------------------------------------------------------------------------

    /**
     * @notice Mint tokens to any address (owner only).
     *         Used by the deployer or TestnetMarketMaker to seed pools.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // -------------------------------------------------------------------------
    // Public faucet
    // -------------------------------------------------------------------------

    /**
     * @notice Claim a small amount of tokens for testing.
     *         Limited to once every 24 hours per address to keep testnet
     *         balances meaningful for the achievement/leaderboard system.
     */
    function faucet() external {
        require(
            block.timestamp >= lastFaucetTime[msg.sender] + FAUCET_COOLDOWN,
            "TestnetStock: faucet cooldown active — try again in 24h"
        );
        lastFaucetTime[msg.sender] = block.timestamp;

        uint256 amount = FAUCET_AMOUNT_UNITS * (10 ** uint256(_tokenDecimals));
        _mint(msg.sender, amount);

        emit FaucetClaimed(msg.sender, amount);
    }

    /**
     * @notice Returns the number of seconds until the caller can use the faucet again.
     *         Returns 0 if the faucet is available now.
     */
    function faucetCooldownRemaining(address user) external view returns (uint256) {
        uint256 nextAvailable = lastFaucetTime[user] + FAUCET_COOLDOWN;
        if (block.timestamp >= nextAvailable) return 0;
        return nextAvailable - block.timestamp;
    }
}
