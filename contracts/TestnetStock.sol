// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TestnetStock
 * @notice Standard ERC20 with gasless approvals, mint caps, and safety features.
 *
 * - ERC20Permit enables gasless approvals (signatures instead of approve tx)
 * - Mint caps prevent infinite inflation
 * - Pausable for emergency stops
 * - Public faucet with cooldown for free test tokens
 */
contract TestnetStock is ERC20, ERC20Permit, Ownable, Pausable {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant FAUCET_AMOUNT_UNITS = 100;   // 100 tokens per claim
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    uint256 public constant MAX_SUPPLY = 10_000_000;     // 10M max tokens

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    uint8 private _tokenDecimals;
    uint256 public totalMinted;

    /// @notice Tracks the last time each address used the faucet.
    mapping(address => uint256) public lastFaucetTime;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event FaucetClaimed(address indexed recipient, uint256 amount);
    event TokensMinted(address indexed to, uint256 amount, uint256 newTotal);
    event TokensBurned(address indexed from, uint256 amount);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(
        string memory name,
        string memory symbol,
        uint8 __decimals
    ) ERC20(name, symbol) ERC20Permit(name) Ownable(msg.sender) {
        _tokenDecimals = __decimals;
        uint256 initialMint = 1_000_000 * (10 ** uint256(__decimals));
        _mint(msg.sender, initialMint);
        totalMinted = initialMint;
    }

    // -------------------------------------------------------------------------
    // Overrides
    // -------------------------------------------------------------------------
    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    // -------------------------------------------------------------------------
    // Pausable
    // -------------------------------------------------------------------------
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // -------------------------------------------------------------------------
    // Minting with caps
    // -------------------------------------------------------------------------

    /**
     * @notice Mint tokens with supply cap protection.
     * @dev Only owner can mint. Reverts if cap would be exceeded.
     */
    function mint(address to, uint256 amount) external onlyOwner whenNotPaused {
        require(totalMinted + amount <= MAX_SUPPLY * (10 ** uint256(_tokenDecimals)), "TestnetStock: max supply exceeded");
        _mint(to, amount);
        totalMinted += amount;
        emit TokensMinted(to, amount, totalMinted);
    }

    /**
     * @notice Batch mint to multiple addresses (gas efficient for airdrops).
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner whenNotPaused {
        require(recipients.length == amounts.length, "TestnetStock: array length mismatch");
        
        uint256 totalAmount;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(totalMinted + totalAmount <= MAX_SUPPLY * (10 ** uint256(_tokenDecimals)), "TestnetStock: max supply exceeded");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
            emit TokensMinted(recipients[i], amounts[i], totalMinted + amounts[i]);
        }
        totalMinted += totalAmount;
    }

    // -------------------------------------------------------------------------
    // Burning
    // -------------------------------------------------------------------------

    /**
     * @notice Allow anyone to burn their own tokens.
     */
    function burn(uint256 amount) external whenNotPaused {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }

    /**
     * @notice Burn from an address with approval (for integrations).
     */
    function burnFrom(address account, uint256 amount) external whenNotPaused {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
        emit TokensBurned(account, amount);
    }

    // -------------------------------------------------------------------------
    // Public faucet
    // -------------------------------------------------------------------------

    /**
     * @notice Claim free tokens for testing. Limited to once every 24 hours.
     */
    function faucet() external whenNotPaused {
        require(
            block.timestamp >= lastFaucetTime[msg.sender] + FAUCET_COOLDOWN,
            "TestnetStock: faucet cooldown active"
        );
        
        lastFaucetTime[msg.sender] = block.timestamp;

        uint256 amount = FAUCET_AMOUNT_UNITS * (10 ** uint256(_tokenDecimals));
        require(totalMinted + amount <= MAX_SUPPLY * (10 ** uint256(_tokenDecimals)), "TestnetStock: max supply reached");
        
        _mint(msg.sender, amount);
        totalMinted += amount;

        emit FaucetClaimed(msg.sender, amount);
        emit TokensMinted(msg.sender, amount, totalMinted);
    }

    /**
     * @notice Check faucet cooldown remaining for any address.
     */
    function faucetCooldownRemaining(address user) external view returns (uint256) {
        uint256 nextAvailable = lastFaucetTime[user] + FAUCET_COOLDOWN;
        if (block.timestamp >= nextAvailable) return 0;
        return nextAvailable - block.timestamp;
    }

    /**
     * @notice Check if faucet is available for caller.
     */
    function isFaucetAvailable() external view returns (bool) {
        return block.timestamp >= lastFaucetTime[msg.sender] + FAUCET_COOLDOWN;
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /**
     * @notice Get remaining mintable supply.
     */
    function remainingMintableSupply() external view returns (uint256) {
        uint256 max = MAX_SUPPLY * (10 ** uint256(_tokenDecimals));
        if (totalMinted >= max) return 0;
        return max - totalMinted;
    }

    /**
     * @notice Get full token info in one call (for UI efficiency).
     */
    function getTokenInfo() external view returns (
        string memory name,
        string memory symbol,
        uint8 dec,
        uint256 totalSupply,
        uint256 minted,
        uint256 remaining
    ) {
        return (
            ERC20.name(),
            ERC20.symbol(),
            _tokenDecimals,
            ERC20.totalSupply(),
            totalMinted,
            this.remainingMintableSupply()
        );
    }
}
