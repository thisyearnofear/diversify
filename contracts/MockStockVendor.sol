// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockStockVendor
 * @notice A simple "vending machine" for testnet stock tokens.
 * @dev Intended for Hackathon "Test Drive" on Robinhood Arbitrum Orbit.
 *      Accepts native testnet ETH and emits purchase events the UI can track.
 */
contract MockStockVendor {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event StockPurchased(address indexed buyer, string symbol, uint256 quantity, uint256 unitPrice, uint256 totalCost);
    event PriceUpdated(string symbol, uint256 oldPrice, uint256 newPrice);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    address public owner;

    // Available stock symbols (ordered for getStockList())
    string[] private _stockList;

    // Mock prices in wei (very cheap for testing — ~$0.001–0.002 in ETH terms)
    mapping(string => uint256) public prices;

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlyOwner() {
        require(msg.sender == owner, "MockStockVendor: caller is not the owner");
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor() {
        owner = msg.sender;

        // Seed initial stock prices
        _addStock("TSLA", 0.001 ether);
        _addStock("AMZN", 0.002 ether);
        _addStock("PLTR", 0.0005 ether);
        _addStock("NFLX", 0.0015 ether);
        _addStock("AMD",  0.0008 ether);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /**
     * @notice Transfer contract ownership (for handover or multisig upgrade).
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "MockStockVendor: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @notice Update or add a stock price. Pass 0 to delist a stock.
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
    function buyStock(string calldata symbol, uint256 quantity) external payable {
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

        emit StockPurchased(msg.sender, symbol, quantity, unitPrice, totalCost);
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
