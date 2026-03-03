// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EmergingMarketsAMM
 * @notice Simple constant-product AMM for emerging market paper trading
 * @dev All pairs are against cUSD on Celo Alfajores
 */
contract EmergingMarketsAMM is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // cUSD token address on Celo Alfajores
    address public immutable cUSD;
    
    // Fee in basis points (30 = 0.3%)
    uint256 public constant FEE_BPS = 30;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // Liquidity pools: token => Pool
    struct Pool {
        uint256 tokenReserve;
        uint256 cUSDReserve;
        uint256 totalLiquidity;
        mapping(address => uint256) liquidity;
    }
    
    mapping(address => Pool) public pools;
    
    // Events
    event PoolCreated(address indexed token, uint256 tokenAmount, uint256 cUSDAmount);
    event Swap(
        address indexed user,
        address indexed token,
        bool isBuy,
        uint256 amountIn,
        uint256 amountOut
    );
    event LiquidityAdded(
        address indexed provider,
        address indexed token,
        uint256 tokenAmount,
        uint256 cUSDAmount,
        uint256 liquidity
    );
    event LiquidityRemoved(
        address indexed provider,
        address indexed token,
        uint256 tokenAmount,
        uint256 cUSDAmount,
        uint256 liquidity
    );
    
    constructor(address _cUSD) Ownable(msg.sender) {
        require(_cUSD != address(0), "Invalid cUSD address");
        cUSD = _cUSD;
    }
    
    /**
     * @notice Create a new liquidity pool
     * @param token Token address
     * @param tokenAmount Initial token amount
     * @param cUSDAmount Initial cUSD amount
     */
    function createPool(
        address token,
        uint256 tokenAmount,
        uint256 cUSDAmount
    ) external onlyOwner {
        require(pools[token].totalLiquidity == 0, "Pool already exists");
        require(tokenAmount > 0 && cUSDAmount > 0, "Invalid amounts");
        
        Pool storage pool = pools[token];
        pool.tokenReserve = tokenAmount;
        pool.cUSDReserve = cUSDAmount;
        pool.totalLiquidity = sqrt(tokenAmount * cUSDAmount);
        pool.liquidity[msg.sender] = pool.totalLiquidity;
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(cUSD).safeTransferFrom(msg.sender, address(this), cUSDAmount);
        
        emit PoolCreated(token, tokenAmount, cUSDAmount);
    }
    
    /**
     * @notice Swap cUSD for token (buy)
     * @param token Token to buy
     * @param cUSDAmountIn Amount of cUSD to spend
     * @param minTokenOut Minimum tokens to receive (slippage protection)
     */
    function buy(
        address token,
        uint256 cUSDAmountIn,
        uint256 minTokenOut
    ) external nonReentrant returns (uint256 tokenOut) {
        Pool storage pool = pools[token];
        require(pool.totalLiquidity > 0, "Pool does not exist");
        
        // Calculate output with fee
        uint256 cUSDAfterFee = (cUSDAmountIn * (BPS_DENOMINATOR - FEE_BPS)) / BPS_DENOMINATOR;
        tokenOut = getAmountOut(cUSDAfterFee, pool.cUSDReserve, pool.tokenReserve);
        
        require(tokenOut >= minTokenOut, "Slippage exceeded");
        require(tokenOut < pool.tokenReserve, "Insufficient liquidity");
        
        // Update reserves
        pool.cUSDReserve += cUSDAmountIn;
        pool.tokenReserve -= tokenOut;
        
        // Transfer tokens
        IERC20(cUSD).safeTransferFrom(msg.sender, address(this), cUSDAmountIn);
        IERC20(token).safeTransfer(msg.sender, tokenOut);
        
        emit Swap(msg.sender, token, true, cUSDAmountIn, tokenOut);
    }
    
    /**
     * @notice Swap token for cUSD (sell)
     * @param token Token to sell
     * @param tokenAmountIn Amount of tokens to sell
     * @param minCUSDOut Minimum cUSD to receive (slippage protection)
     */
    function sell(
        address token,
        uint256 tokenAmountIn,
        uint256 minCUSDOut
    ) external nonReentrant returns (uint256 cUSDOut) {
        Pool storage pool = pools[token];
        require(pool.totalLiquidity > 0, "Pool does not exist");
        
        // Calculate output with fee
        uint256 tokenAfterFee = (tokenAmountIn * (BPS_DENOMINATOR - FEE_BPS)) / BPS_DENOMINATOR;
        cUSDOut = getAmountOut(tokenAfterFee, pool.tokenReserve, pool.cUSDReserve);
        
        require(cUSDOut >= minCUSDOut, "Slippage exceeded");
        require(cUSDOut < pool.cUSDReserve, "Insufficient liquidity");
        
        // Update reserves
        pool.tokenReserve += tokenAmountIn;
        pool.cUSDReserve -= cUSDOut;
        
        // Transfer tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmountIn);
        IERC20(cUSD).safeTransfer(msg.sender, cUSDOut);
        
        emit Swap(msg.sender, token, false, tokenAmountIn, cUSDOut);
    }
    
    /**
     * @notice Get quote for buying tokens with cUSD
     * @param token Token address
     * @param cUSDAmountIn Amount of cUSD to spend
     * @return tokenOut Amount of tokens to receive
     */
    function quoteBuy(address token, uint256 cUSDAmountIn) 
        external 
        view 
        returns (uint256 tokenOut) 
    {
        Pool storage pool = pools[token];
        require(pool.totalLiquidity > 0, "Pool does not exist");
        
        uint256 cUSDAfterFee = (cUSDAmountIn * (BPS_DENOMINATOR - FEE_BPS)) / BPS_DENOMINATOR;
        tokenOut = getAmountOut(cUSDAfterFee, pool.cUSDReserve, pool.tokenReserve);
    }
    
    /**
     * @notice Get quote for selling tokens for cUSD
     * @param token Token address
     * @param tokenAmountIn Amount of tokens to sell
     * @return cUSDOut Amount of cUSD to receive
     */
    function quoteSell(address token, uint256 tokenAmountIn) 
        external 
        view 
        returns (uint256 cUSDOut) 
    {
        Pool storage pool = pools[token];
        require(pool.totalLiquidity > 0, "Pool does not exist");
        
        uint256 tokenAfterFee = (tokenAmountIn * (BPS_DENOMINATOR - FEE_BPS)) / BPS_DENOMINATOR;
        cUSDOut = getAmountOut(tokenAfterFee, pool.tokenReserve, pool.cUSDReserve);
    }
    
    /**
     * @notice Get pool reserves
     * @param token Token address
     * @return tokenReserve Token reserve
     * @return cUSDReserve cUSD reserve
     */
    function getReserves(address token) 
        external 
        view 
        returns (uint256 tokenReserve, uint256 cUSDReserve) 
    {
        Pool storage pool = pools[token];
        return (pool.tokenReserve, pool.cUSDReserve);
    }
    
    /**
     * @notice Calculate output amount using constant product formula
     * @param amountIn Input amount
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return amountOut Output amount
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        uint256 numerator = amountIn * reserveOut;
        uint256 denominator = reserveIn + amountIn;
        amountOut = numerator / denominator;
    }
    
    /**
     * @notice Square root function for liquidity calculation
     * @param y Input value
     * @return z Square root
     */
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
