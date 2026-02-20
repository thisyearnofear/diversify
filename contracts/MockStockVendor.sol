// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MockStockVendor
 * @notice A simple "vending machine" for testnet stock tokens.
 * @dev Intended for Hackathon "Test Drive" on Robinhood Arbitrum Orbit.
 *      Accepts native testnet ETH and emits purchase events the UI can track.
 */
contract MockStockVendor is Ownable, Pausable {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event StockPurchased(address indexed buyer, string symbol, uint256 quantity, uint256 unitPrice, uint256 totalCost, uint256 timestamp);
    event BatchStockPurchased(address indexed buyer, string[] symbols, uint256[] quantities, uint256 totalCost);
    event PriceUpdated(string symbol, uint256 oldPrice, uint256 newPrice);

    // Available stock symbols (ordered for getStockList())
    string[] private _stockList;

    // Mock prices in wei (very cheap for testing — ~$0.001–0.002 in ETH terms)
    mapping(string => uint256) public prices;

    // Purchase tracking for leaderboard
    mapping(address => mapping(string => uint256)) public userHoldings;
    mapping(address => uint256) public userTotalPurchases;

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    constructor() Ownable(msg.sender) {
        // Seed initial stock prices
        _addStock("ACME", 0.001 ether);
        _addStock("SPACELY", 0.0008 ether);
        _addStock("WAYNE", 0.0015 ether);
        _addStock("OSCORP", 0.0005 ether);
        _addStock("STARK", 0.002 ether);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /**
     * @notice Pause contract in case of emergency.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Update or add a stock price. Pass 0 to effectively delist.
     */
    function setPrice(string calldata symbol, uint256 newPrice) external onlyOwner {
        uint256 old = prices[symbol];
        if (old == 0 && newPrice > 0) {
            // New stock — add to list
            _stockList.push(symbol);
        }
        prices[symbol] = newPrice;
        emit PriceUpdated(symbol, old, newPrice);
    }

    /**
     * @notice Withdraw accumulated ETH to owner.
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "MockStockVendor: nothing to withdraw");
        payable(owner).transfer(balance);
    }

    // -------------------------------------------------------------------------
    // Public — View
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the list of available stock symbols and their prices.
     * @dev Lets the UI build its stock picker dynamically without hardcoding symbols.
     */
    function getStockList() external view returns (string[] memory symbols, uint256[] memory stockPrices) {
        uint256 count = _stockList.length;
        symbols = new string[](count);
        stockPrices = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            symbols[i] = _stockList[i];
            stockPrices[i] = prices[_stockList[i]];
        }
    }

    /**
     * @notice Quote the cost of buying `quantity` units of a stock.
     */
    function quoteBuy(string calldata symbol, uint256 quantity) external view returns (uint256 totalCost) {
        require(quantity > 0, "MockStockVendor: quantity must be > 0");
        uint256 unitPrice = prices[symbol];
        require(unitPrice > 0, "MockStockVendor: stock not found");
        totalCost = unitPrice * quantity;
    }

    // -------------------------------------------------------------------------
    // Public — Write
    // -------------------------------------------------------------------------

    /**
     * @notice Buy one or more units of a simulated stock.
     * @dev Emits an on-chain event the UI tracks to credit the user.
     *      In a production version, this would mint ERC20 tokens.
     *      Excess ETH is refunded to the caller.
     * @param symbol  Ticker symbol (e.g. "TSLA")
     * @param quantity Number of units to purchase (min 1)
     */
    function buyStock(string calldata symbol, uint256 quantity) external payable whenNotPaused {
        require(quantity > 0, "MockStockVendor: quantity must be > 0");
        uint256 unitPrice = prices[symbol];
        require(unitPrice > 0, "MockStockVendor: stock not found");

        uint256 totalCost = unitPrice * quantity;
        require(msg.value >= totalCost, "MockStockVendor: insufficient payment");

        // Refund excess
        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            payable(msg.sender).transfer(excess);
        }

        // Track purchase for leaderboard
        userHoldings[msg.sender][symbol] += quantity;
        userTotalPurchases[msg.sender] += totalCost;

        emit StockPurchased(msg.sender, symbol, quantity, unitPrice, totalCost, block.timestamp);
    }

    /**
     * @notice Buy multiple stocks in one transaction (gas efficient).
     * @param symbols Array of stock symbols
     * @param quantities Array of quantities (must match symbols length)
     */
    function batchBuyStock(string[] calldata symbols, uint256[] calldata quantities) external payable whenNotPaused {
        require(symbols.length == quantities.length, "MockStockVendor: array length mismatch");
        require(symbols.length > 0, "MockStockVendor: empty batch");

        uint256 totalCost;
        uint256[] memory costs = new uint256[](symbols.length);

        for (uint256 i = 0; i < symbols.length; i++) {
            require(quantities[i] > 0, "MockStockVendor: quantity must be > 0");
            uint256 unitPrice = prices[symbols[i]];
            require(unitPrice > 0, "MockStockVendor: stock not found");
            
            costs[i] = unitPrice * quantities[i];
            totalCost += costs[i];

            // Track purchase for leaderboard
            userHoldings[msg.sender][symbols[i]] += quantities[i];
        }

        require(msg.value >= totalCost, "MockStockVendor: insufficient payment");

        // Refund excess
        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            payable(msg.sender).transfer(excess);
        }

        userTotalPurchases[msg.sender] += totalCost;
        emit BatchStockPurchased(msg.sender, symbols, quantities, totalCost);
    }

    // -------------------------------------------------------------------------
    // View functions for Leaderboard
    // -------------------------------------------------------------------------

    /**
     * @notice Get user's full portfolio (symbols and quantities).
     */
    function getUserPortfolio(address user) external view returns (string[] memory symbols, uint256[] memory quantities, uint256 totalValue) {
        uint256 count = _stockList.length;
        symbols = new string[](count);
        quantities = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            string memory symbol = _stockList[i];
            uint256 qty = userHoldings[user][symbol];
            symbols[i] = symbol;
            quantities[i] = qty;
            totalValue += qty * prices[symbol];
        }
    }

    /**
     * @notice Get quick user stats for leaderboard.
     */
    function getUserStats(address user) external view returns (uint256 totalPurchases, uint256 portfolioValue, uint256 uniqueStocks) {
        totalPurchases = userTotalPurchases[user];
        
        uint256 count = _stockList.length;
        for (uint256 i = 0; i < count; i++) {
            uint256 qty = userHoldings[user][_stockList[i]];
            if (qty > 0) {
                uniqueStocks++;
                portfolioValue += qty * prices[_stockList[i]];
            }
        }
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    function _addStock(string memory symbol, uint256 price) internal {
        _stockList.push(symbol);
        prices[symbol] = price;
    }

    // Allow contract to receive plain ETH (e.g. from faucets)
    receive() external payable {}
}
