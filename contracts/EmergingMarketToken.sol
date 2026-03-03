// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EmergingMarketToken
 * @notice Proxy token representing an emerging market stock for paper trading
 * @dev Price is updated by oracle, token is mintable for paper trading purposes
 */
contract EmergingMarketToken is ERC20, Ownable {
    // Oracle address authorized to update prices
    address public oracle;
    
    // Current price in USD (scaled by 1e18)
    uint256 public currentPrice;
    
    // Last price update timestamp
    uint256 public lastPriceUpdate;
    
    // Market metadata
    string public market; // e.g., "Kenya", "Brazil"
    string public realTicker; // e.g., "SCOM.NR", "PETR4.SA"
    
    // Events
    event PriceUpdated(uint256 newPrice, uint256 timestamp);
    event OracleUpdated(address indexed newOracle);
    
    /**
     * @notice Constructor
     * @param name Token name (e.g., "Safaricom Paper Token")
     * @param symbol Token symbol (e.g., "SAFCOM")
     * @param _market Market name (e.g., "Kenya")
     * @param _realTicker Real stock ticker (e.g., "SCOM.NR")
     * @param _oracle Oracle address
     * @param initialSupply Initial supply for liquidity
     */
    constructor(
        string memory name,
        string memory symbol,
        string memory _market,
        string memory _realTicker,
        address _oracle,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        market = _market;
        realTicker = _realTicker;
        oracle = _oracle;
        
        // Mint initial supply to owner for liquidity provision
        _mint(msg.sender, initialSupply);
    }
    
    /**
     * @notice Update the current price (oracle only)
     * @param newPrice New price in USD (scaled by 1e18)
     */
    function updatePrice(uint256 newPrice) external {
        require(msg.sender == oracle, "Only oracle can update price");
        require(newPrice > 0, "Price must be positive");
        
        currentPrice = newPrice;
        lastPriceUpdate = block.timestamp;
        
        emit PriceUpdated(newPrice, block.timestamp);
    }
    
    /**
     * @notice Update oracle address (owner only)
     * @param newOracle New oracle address
     */
    function updateOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        oracle = newOracle;
        emit OracleUpdated(newOracle);
    }
    
    /**
     * @notice Mint tokens for paper trading (owner only)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @notice Get price age in seconds
     * @return Age of current price in seconds
     */
    function getPriceAge() external view returns (uint256) {
        if (lastPriceUpdate == 0) return type(uint256).max;
        return block.timestamp - lastPriceUpdate;
    }
}
