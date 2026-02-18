// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TestnetMarketMaker
 * @notice A streamlined constant-product AMM (x*y=k) for testnets.
 *
 * Features:
 * - Single-contract pool registry (no separate Pair contracts)
 * - Uniswap V2-compatible 0.3% fee
 * - Flash-loan resistant (ReentrancyGuard)
 * - Public liquidity provision (not owner-only)
 * - View helpers: getReserves, quoteSwap — used by UI for price preview
 * - Easy Remix deployment
 *
 * Deployment steps:
 * 1. Deploy TestnetStock for each ticker (TSLA, AMZN, etc.)
 * 2. Deploy this contract.
 * 3. Owner calls seedPool(tokenA, tokenB, amountA, amountB) to bootstrap.
 * 4. Anyone calls addLiquidity(tokenA, tokenB, amountA, amountB, minA, minB).
 * 5. Users call swapExactTokensForTokens or swapExactETHForTokens.
 */
contract TestnetMarketMaker is Ownable, ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event LiquidityAdded(address indexed provider, address token0, address token1, uint256 amount0, uint256 amount1);
    event LiquidityRemoved(address indexed provider, address token0, address token1, uint256 amount0, uint256 amount1);
    event Sync(address indexed token0, address indexed token1, uint112 reserve0, uint112 reserve1);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------
    error InsufficientLiquidity();
    error InsufficientOutputAmount();
    error InsufficientInputAmount();
    error InvalidPath();
    error TransferFailed();
    error Expired();
    error SlippageExceeded();
    error PoolNotFound();

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant FEE_DENOMINATOR = 1000;
    uint256 public constant FEE_NUMERATOR = 997; // 0.3% fee

    // -------------------------------------------------------------------------
    // Pool storage
    // Tokens are always sorted: address(token0) < address(token1)
    // -------------------------------------------------------------------------
    struct Pool {
        uint112 reserve0;
        uint112 reserve1;
        uint32  blockTimestampLast;
    }

    // token0 => token1 => Pool (tokens sorted, token0 < token1)
    mapping(address => mapping(address => Pool)) public pools;

    // Per-address liquidity shares (token0 => token1 => provider => shares)
    // Simple share accounting — 1 share = 1 unit of (reserve0 + reserve1) contributed
    mapping(address => mapping(address => mapping(address => uint256))) public liquidityShares;
    mapping(address => mapping(address => uint256)) public totalShares;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor() Ownable(msg.sender) {}

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _sortTokens(address tokenA, address tokenB)
        internal pure returns (address token0, address token1)
    {
        require(tokenA != tokenB, "TMM: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "TMM: ZERO_ADDRESS");
    }

    function _getPool(address tokenA, address tokenB)
        internal view returns (Pool storage pool, address token0, address token1)
    {
        (token0, token1) = _sortTokens(tokenA, tokenB);
        pool = pools[token0][token1];
    }

    function _requirePool(Pool storage pool) internal view {
        if (pool.reserve0 == 0 || pool.reserve1 == 0) revert PoolNotFound();
    }

    // -------------------------------------------------------------------------
    // View helpers (used by UI for price preview — no state changes)
    // -------------------------------------------------------------------------

    /**
     * @notice Return the current reserves for a pool.
     * @return reserveA Reserve of tokenA (in tokenA's native decimals)
     * @return reserveB Reserve of tokenB
     */
    function getReserves(address tokenA, address tokenB)
        external view returns (uint256 reserveA, uint256 reserveB)
    {
        (Pool storage pool, address token0,) = _getPool(tokenA, tokenB);
        (reserveA, reserveB) = tokenA == token0
            ? (pool.reserve0, pool.reserve1)
            : (pool.reserve1, pool.reserve0);
    }

    /**
     * @notice Compute the output amount for a given input — gas-free preview.
     * @param amountIn  Exact input amount
     * @param tokenIn   Input token address
     * @param tokenOut  Output token address
     * @return amountOut Expected output (before slippage)
     */
    function quoteSwap(uint256 amountIn, address tokenIn, address tokenOut)
        external view returns (uint256 amountOut)
    {
        (Pool storage pool, address token0,) = _getPool(tokenIn, tokenOut);
        _requirePool(pool);
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0
            ? (pool.reserve0, pool.reserve1)
            : (pool.reserve1, pool.reserve0);
        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
    }

    /**
     * @notice Constant-product output formula with 0.3% fee.
     */
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public pure returns (uint256 amountOut)
    {
        if (amountIn == 0) revert InsufficientInputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        uint256 numerator       = amountInWithFee * reserveOut;
        uint256 denominator     = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    // -------------------------------------------------------------------------
    // Liquidity — Owner bootstrap
    // -------------------------------------------------------------------------

    /**
     * @notice Seed a new pool with initial reserves (owner only).
     *         Caller must have approved both tokens beforehand.
     */
    function seedPool(
        address tokenA, address tokenB,
        uint256 amountA, uint256 amountB
    ) external onlyOwner nonReentrant {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        Pool storage pool = pools[token0][token1];

        uint256 amount0 = tokenA == token0 ? amountA : amountB;
        uint256 amount1 = tokenA == token0 ? amountB : amountA;

        if (!IERC20(token0).transferFrom(msg.sender, address(this), amount0)) revert TransferFailed();
        if (!IERC20(token1).transferFrom(msg.sender, address(this), amount1)) revert TransferFailed();

        pool.reserve0 += uint112(amount0);
        pool.reserve1 += uint112(amount1);
        pool.blockTimestampLast = uint32(block.timestamp);

        // Mint shares to owner
        uint256 shares = amount0 + amount1;
        liquidityShares[token0][token1][msg.sender] += shares;
        totalShares[token0][token1] += shares;

        emit LiquidityAdded(msg.sender, token0, token1, amount0, amount1);
        emit Sync(token0, token1, pool.reserve0, pool.reserve1);
    }

    // -------------------------------------------------------------------------
    // Liquidity — Public
    // -------------------------------------------------------------------------

    /**
     * @notice Add liquidity to an existing pool.
     *         Ratios are enforced — excess is refunded.
     * @param tokenA    First token address
     * @param tokenB    Second token address
     * @param amountADesired  Amount of tokenA the caller wants to add
     * @param amountBDesired  Amount of tokenB the caller wants to add
     * @param amountAMin      Minimum tokenA accepted (slippage guard)
     * @param amountBMin      Minimum tokenB accepted (slippage guard)
     */
    function addLiquidity(
        address tokenA, address tokenB,
        uint256 amountADesired, uint256 amountBDesired,
        uint256 amountAMin, uint256 amountBMin
    ) external nonReentrant returns (uint256 amountA, uint256 amountB, uint256 shares) {
        (Pool storage pool, address token0, address token1) = _getPool(tokenA, tokenB);
        _requirePool(pool);

        (uint256 reserve0, uint256 reserve1) = (pool.reserve0, pool.reserve1);
        (uint256 reserveA, uint256 reserveB) = tokenA == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);

        // Calculate optimal amounts preserving current ratio
        uint256 amountBOptimal = (amountADesired * reserveB) / reserveA;
        if (amountBOptimal <= amountBDesired) {
            if (amountBOptimal < amountBMin) revert SlippageExceeded();
            (amountA, amountB) = (amountADesired, amountBOptimal);
        } else {
            uint256 amountAOptimal = (amountBDesired * reserveA) / reserveB;
            if (amountAOptimal < amountAMin) revert SlippageExceeded();
            (amountA, amountB) = (amountAOptimal, amountBDesired);
        }

        uint256 amount0 = tokenA == token0 ? amountA : amountB;
        uint256 amount1 = tokenA == token0 ? amountB : amountA;

        if (!IERC20(token0).transferFrom(msg.sender, address(this), amount0)) revert TransferFailed();
        if (!IERC20(token1).transferFrom(msg.sender, address(this), amount1)) revert TransferFailed();

        pool.reserve0 += uint112(amount0);
        pool.reserve1 += uint112(amount1);
        pool.blockTimestampLast = uint32(block.timestamp);

        // Simple proportional share minting
        shares = (amount0 * totalShares[token0][token1]) / reserve0;
        liquidityShares[token0][token1][msg.sender] += shares;
        totalShares[token0][token1] += shares;

        emit LiquidityAdded(msg.sender, token0, token1, amount0, amount1);
        emit Sync(token0, token1, pool.reserve0, pool.reserve1);
    }

    /**
     * @notice Remove liquidity proportional to held shares.
     * @param tokenA     First token address
     * @param tokenB     Second token address
     * @param sharesToBurn Number of shares to redeem
     * @param amountAMin   Minimum tokenA to receive
     * @param amountBMin   Minimum tokenB to receive
     */
    function removeLiquidity(
        address tokenA, address tokenB,
        uint256 sharesToBurn,
        uint256 amountAMin, uint256 amountBMin
    ) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        (Pool storage pool, address token0, address token1) = _getPool(tokenA, tokenB);

        uint256 providerShares = liquidityShares[token0][token1][msg.sender];
        require(sharesToBurn > 0 && sharesToBurn <= providerShares, "TMM: insufficient shares");

        uint256 total = totalShares[token0][token1];
        uint256 amount0 = (sharesToBurn * pool.reserve0) / total;
        uint256 amount1 = (sharesToBurn * pool.reserve1) / total;

        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        if (amountA < amountAMin || amountB < amountBMin) revert SlippageExceeded();

        liquidityShares[token0][token1][msg.sender] -= sharesToBurn;
        totalShares[token0][token1] -= sharesToBurn;

        pool.reserve0 -= uint112(amount0);
        pool.reserve1 -= uint112(amount1);
        pool.blockTimestampLast = uint32(block.timestamp);

        if (!IERC20(token0).transfer(msg.sender, amount0)) revert TransferFailed();
        if (!IERC20(token1).transfer(msg.sender, amount1)) revert TransferFailed();

        emit LiquidityRemoved(msg.sender, token0, token1, amount0, amount1);
        emit Sync(token0, token1, pool.reserve0, pool.reserve1);
    }

    // -------------------------------------------------------------------------
    // Swap
    // -------------------------------------------------------------------------

    /**
     * @notice Swap an exact amount of input tokens for output tokens.
     * @param amountIn     Exact input amount
     * @param amountOutMin Minimum output (slippage protection)
     * @param path         [tokenIn, tokenOut] — single-hop only for now
     * @param to           Recipient of output tokens
     * @param deadline     Unix timestamp after which the tx reverts
     * @return amounts     [amountIn, amountOut]
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external nonReentrant returns (uint256[] memory amounts) {
        if (deadline < block.timestamp) revert Expired();
        if (path.length != 2) revert InvalidPath();

        address tokenIn  = path[0];
        address tokenOut = path[1];

        (Pool storage pool, address token0, address token1) = _getPool(tokenIn, tokenOut);
        _requirePool(pool);

        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0
            ? (pool.reserve0, pool.reserve1)
            : (pool.reserve1, pool.reserve0);

        uint256 amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        if (amountOut < amountOutMin) revert InsufficientOutputAmount();

        // Pull input tokens from sender
        if (!IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn)) revert TransferFailed();

        // Update reserves
        if (tokenIn == token0) {
            pool.reserve0 = uint112(pool.reserve0 + amountIn);
            pool.reserve1 = uint112(pool.reserve1 - amountOut);
            emit Swap(msg.sender, amountIn, 0, 0, amountOut, to);
        } else {
            pool.reserve1 = uint112(pool.reserve1 + amountIn);
            pool.reserve0 = uint112(pool.reserve0 - amountOut);
            emit Swap(msg.sender, 0, amountIn, amountOut, 0, to);
        }

        pool.blockTimestampLast = uint32(block.timestamp);

        // Send output tokens to recipient
        if (!IERC20(tokenOut).transfer(to, amountOut)) revert TransferFailed();

        emit Sync(token0, token1, pool.reserve0, pool.reserve1);

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }
}
