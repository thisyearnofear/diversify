// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/**
 * @title TestnetMarketMaker
 * @notice A streamlined constant-product AMM (x*y=k) for testnets with native
 *         ETH support via WETH wrapping.
 *
 * Features:
 * - Single-contract pool registry (no separate Pair contracts)
 * - Uniswap V2-compatible 0.3% fee
 * - Flash-loan resistant (ReentrancyGuard)
 * - Native ETH convenience functions (swapExactETHForTokens, etc.)
 * - View helpers: getReserves, quoteSwap, quoteSwapETH — gas-free price preview
 *
 * Deployment steps:
 * 1. Deploy WETH9.
 * 2. Deploy TestnetStock for each ticker (TSLA, AMZN, etc.)
 * 3. Deploy this contract with WETH address.
 * 4. Owner calls seedPoolETH{value: X}(stockToken, amountStock) to bootstrap.
 * 5. Users call swapExactETHForTokens / swapExactTokensForETH.
 */
contract TestnetMarketMaker is Ownable, ReentrancyGuard, Pausable {
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
    event PoolCreated(address indexed token0, address indexed token1, address indexed creator);
    event FeeUpdated(uint256 oldFee, uint256 newFee);

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
    // Constants & immutables
    // -------------------------------------------------------------------------
    uint256 public constant FEE_DENOMINATOR = 1000;
    uint256 public feeNumerator = 997; // 0.3% fee
    uint256 public constant MAX_FEE = 50; // Max 5% fee

    address public immutable WETH;

    // -------------------------------------------------------------------------
    // Pool storage (tokens always sorted: token0 < token1)
    // -------------------------------------------------------------------------
    struct Pool {
        uint112 reserve0;
        uint112 reserve1;
        uint32  blockTimestampLast;
    }

    mapping(address => mapping(address => Pool)) public pools;
    mapping(address => mapping(address => mapping(address => uint256))) public liquidityShares;
    mapping(address => mapping(address => uint256)) public totalShares;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _weth) Ownable(msg.sender) {
        require(_weth != address(0), "TMM: zero WETH");
        WETH = _weth;
    }

    // Allow receiving ETH from WETH withdrawals
    receive() external payable {}

    // -------------------------------------------------------------------------
    // Pausable
    // -------------------------------------------------------------------------
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

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
    // View helpers (gas-free price preview for UI)
    // -------------------------------------------------------------------------

    function getReserves(address tokenA, address tokenB)
        external view returns (uint256 reserveA, uint256 reserveB)
    {
        (Pool storage pool, address token0,) = _getPool(tokenA, tokenB);
        (reserveA, reserveB) = tokenA == token0
            ? (pool.reserve0, pool.reserve1)
            : (pool.reserve1, pool.reserve0);
    }

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

    /// @notice Quote how many tokens you get for a given ETH amount.
    function quoteSwapETH(uint256 ethAmountIn, address tokenOut)
        external view returns (uint256 amountOut)
    {
        (Pool storage pool, address token0,) = _getPool(WETH, tokenOut);
        _requirePool(pool);
        (uint256 reserveIn, uint256 reserveOut) = WETH == token0
            ? (pool.reserve0, pool.reserve1)
            : (pool.reserve1, pool.reserve0);
        amountOut = getAmountOut(ethAmountIn, reserveIn, reserveOut);
    }

    /// @notice Quote how much ETH you get for selling tokens.
    function quoteSwapTokenForETH(uint256 amountIn, address tokenIn)
        external view returns (uint256 ethOut)
    {
        (Pool storage pool, address token0,) = _getPool(tokenIn, WETH);
        _requirePool(pool);
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0
            ? (pool.reserve0, pool.reserve1)
            : (pool.reserve1, pool.reserve0);
        ethOut = getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public view returns (uint256 amountOut)
    {
        if (amountIn == 0) revert InsufficientInputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        uint256 amountInWithFee = amountIn * feeNumerator;
        uint256 numerator       = amountInWithFee * reserveOut;
        uint256 denominator     = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function getPoolInfo(address tokenA, address tokenB) external view returns (
        uint256 reserveA, uint256 reserveB,
        uint256 totalPoolShares, uint256 userShares, uint32 lastUpdate
    ) {
        (Pool storage pool, address token0, address token1) = _getPool(tokenA, tokenB);
        (reserveA, reserveB) = tokenA == token0
            ? (pool.reserve0, pool.reserve1)
            : (pool.reserve1, pool.reserve0);
        totalPoolShares = totalShares[token0][token1];
        userShares = liquidityShares[token0][token1][msg.sender];
        lastUpdate = pool.blockTimestampLast;
    }

    // -------------------------------------------------------------------------
    // Liquidity — Owner bootstrap (ERC20-only, legacy)
    // -------------------------------------------------------------------------

    function seedPool(
        address tokenA, address tokenB,
        uint256 amountA, uint256 amountB
    ) external onlyOwner nonReentrant whenNotPaused {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        Pool storage pool = pools[token0][token1];

        uint256 amount0 = tokenA == token0 ? amountA : amountB;
        uint256 amount1 = tokenA == token0 ? amountB : amountA;
        require(amount0 > 1000 && amount1 > 1000, "TMM: insufficient initial liquidity");

        if (!IERC20(token0).transferFrom(msg.sender, address(this), amount0)) revert TransferFailed();
        if (!IERC20(token1).transferFrom(msg.sender, address(this), amount1)) revert TransferFailed();

        pool.reserve0 += uint112(amount0);
        pool.reserve1 += uint112(amount1);
        pool.blockTimestampLast = uint32(block.timestamp);

        uint256 shares = amount0 + amount1;
        liquidityShares[token0][token1][msg.sender] += shares;
        totalShares[token0][token1] += shares;

        emit PoolCreated(token0, token1, msg.sender);
        emit LiquidityAdded(msg.sender, token0, token1, amount0, amount1);
        emit Sync(token0, token1, pool.reserve0, pool.reserve1);
    }

    // -------------------------------------------------------------------------
    // Liquidity — ETH bootstrap (owner sends ETH + approves token)
    // -------------------------------------------------------------------------

    /// @notice Seed a new WETH/token pool. Owner sends ETH (auto-wrapped) and
    ///         must have approved `amountToken` of `token` to this contract.
    function seedPoolETH(
        address token, uint256 amountToken
    ) external payable onlyOwner nonReentrant whenNotPaused {
        require(msg.value > 1000 && amountToken > 1000, "TMM: insufficient initial liquidity");

        // Wrap ETH → WETH (held by this contract)
        IWETH(WETH).deposit{value: msg.value}();

        (address token0, address token1) = _sortTokens(token, WETH);
        Pool storage pool = pools[token0][token1];

        uint256 amount0 = token == token0 ? amountToken : msg.value;
        uint256 amount1 = token == token0 ? msg.value   : amountToken;

        // Pull the ERC20 token from owner
        if (!IERC20(token).transferFrom(msg.sender, address(this), amountToken)) revert TransferFailed();
        // WETH is already in this contract from the deposit above

        pool.reserve0 += uint112(amount0);
        pool.reserve1 += uint112(amount1);
        pool.blockTimestampLast = uint32(block.timestamp);

        uint256 shares = amount0 + amount1;
        liquidityShares[token0][token1][msg.sender] += shares;
        totalShares[token0][token1] += shares;

        emit PoolCreated(token0, token1, msg.sender);
        emit LiquidityAdded(msg.sender, token0, token1, amount0, amount1);
        emit Sync(token0, token1, pool.reserve0, pool.reserve1);
    }

    // -------------------------------------------------------------------------
    // Liquidity — Public (ERC20-only)
    // -------------------------------------------------------------------------

    function addLiquidity(
        address tokenA, address tokenB,
        uint256 amountADesired, uint256 amountBDesired,
        uint256 amountAMin, uint256 amountBMin
    ) external nonReentrant whenNotPaused returns (uint256 amountA, uint256 amountB, uint256 shares) {
        (Pool storage pool, address token0, address token1) = _getPool(tokenA, tokenB);
        _requirePool(pool);

        (uint256 reserve0, uint256 reserve1) = (pool.reserve0, pool.reserve1);
        (uint256 reserveA, uint256 reserveB) = tokenA == token0
            ? (reserve0, reserve1) : (reserve1, reserve0);

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

        shares = (amount0 * totalShares[token0][token1]) / reserve0;
        liquidityShares[token0][token1][msg.sender] += shares;
        totalShares[token0][token1] += shares;

        emit LiquidityAdded(msg.sender, token0, token1, amount0, amount1);
        emit Sync(token0, token1, pool.reserve0, pool.reserve1);
    }

    function removeLiquidity(
        address tokenA, address tokenB,
        uint256 sharesToBurn,
        uint256 amountAMin, uint256 amountBMin
    ) external nonReentrant whenNotPaused returns (uint256 amountA, uint256 amountB) {
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
    // Swap — ERC20 ↔ ERC20
    // -------------------------------------------------------------------------

    function swapExactTokensForTokens(
        uint256 amountIn, uint256 amountOutMin,
        address[] calldata path, address to, uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256[] memory amounts) {
        if (deadline < block.timestamp) revert Expired();
        if (path.length != 2) revert InvalidPath();

        address tokenIn  = path[0];
        address tokenOut = path[1];

        (Pool storage pool, address token0, address token1) = _getPool(tokenIn, tokenOut);
        _requirePool(pool);

        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0
            ? (pool.reserve0, pool.reserve1) : (pool.reserve1, pool.reserve0);

        uint256 amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        if (amountOut < amountOutMin) revert InsufficientOutputAmount();

        if (!IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn)) revert TransferFailed();

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

        if (!IERC20(tokenOut).transfer(to, amountOut)) revert TransferFailed();
        emit Sync(token0, token1, pool.reserve0, pool.reserve1);

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }

    // -------------------------------------------------------------------------
    // Swap — ETH → Token (user sends ETH, receives ERC20)
    // -------------------------------------------------------------------------

    /// @notice Swap exact ETH for tokens. ETH is auto-wrapped to WETH internally.
    /// @param amountOutMin Minimum tokens to receive (slippage protection)
    /// @param tokenOut     The stock token to buy
    /// @param to           Recipient
    /// @param deadline     Unix timestamp expiry
    function swapExactETHForTokens(
        uint256 amountOutMin, address tokenOut, address to, uint256 deadline
    ) external payable nonReentrant whenNotPaused returns (uint256 amountOut) {
        if (deadline < block.timestamp) revert Expired();
        require(msg.value > 0, "TMM: zero ETH");

        // Wrap ETH → WETH (held by this contract)
        IWETH(WETH).deposit{value: msg.value}();

        (Pool storage pool, address token0, address token1) = _getPool(WETH, tokenOut);
        _requirePool(pool);

        (uint256 reserveIn, uint256 reserveOut) = WETH == token0
            ? (pool.reserve0, pool.reserve1) : (pool.reserve1, pool.reserve0);

        amountOut = getAmountOut(msg.value, reserveIn, reserveOut);
        if (amountOut < amountOutMin) revert InsufficientOutputAmount();

        if (WETH == token0) {
            pool.reserve0 = uint112(pool.reserve0 + msg.value);
            pool.reserve1 = uint112(pool.reserve1 - amountOut);
            emit Swap(msg.sender, msg.value, 0, 0, amountOut, to);
        } else {
            pool.reserve1 = uint112(pool.reserve1 + msg.value);
            pool.reserve0 = uint112(pool.reserve0 - amountOut);
            emit Swap(msg.sender, 0, msg.value, amountOut, 0, to);
        }
        pool.blockTimestampLast = uint32(block.timestamp);

        if (!IERC20(tokenOut).transfer(to, amountOut)) revert TransferFailed();
        emit Sync(token0, token1, pool.reserve0, pool.reserve1);
    }

    // -------------------------------------------------------------------------
    // Swap — Token → ETH (user sends ERC20, receives ETH)
    // -------------------------------------------------------------------------

    /// @notice Swap exact tokens for ETH. WETH is auto-unwrapped.
    /// @param amountIn     Exact amount of tokens to sell
    /// @param amountOutMin Minimum ETH to receive
    /// @param tokenIn      The stock token to sell
    /// @param to           Recipient of ETH
    /// @param deadline     Unix timestamp expiry
    function swapExactTokensForETH(
        uint256 amountIn, uint256 amountOutMin,
        address tokenIn, address to, uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        if (deadline < block.timestamp) revert Expired();

        (Pool storage pool, address token0, address token1) = _getPool(tokenIn, WETH);
        _requirePool(pool);

        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0
            ? (pool.reserve0, pool.reserve1) : (pool.reserve1, pool.reserve0);

        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        if (amountOut < amountOutMin) revert InsufficientOutputAmount();

        if (!IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn)) revert TransferFailed();

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

        // Unwrap WETH → ETH and send to recipient
        IWETH(WETH).withdraw(amountOut);
        (bool success,) = to.call{value: amountOut}("");
        require(success, "TMM: ETH transfer failed");

        emit Sync(token0, token1, pool.reserve0, pool.reserve1);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setFee(uint256 newFeeNumerator) external onlyOwner {
        require(newFeeNumerator >= FEE_DENOMINATOR - MAX_FEE, "TMM: fee too high");
        require(newFeeNumerator <= FEE_DENOMINATOR, "TMM: invalid fee");
        uint256 oldFee = feeNumerator;
        feeNumerator = newFeeNumerator;
        emit FeeUpdated(oldFee, newFeeNumerator);
    }
}
