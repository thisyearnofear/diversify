// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DiversiFiVault
 * @notice ERC-4626 managed vault on Celo for automated wealth diversification.
 *
 * @dev Security model:
 *   - DEPOSITORs can deposit/withdraw at any time (ERC-4626 standard)
 *   - REBALANCER_ROLE can call executeSwap() — cannot withdraw
 *   - ADMIN_ROLE can set fee params, pause, manage allowlist
 *   - All constraints enforced on-chain, not by trusting the server
 *
 * @dev Architecture:
 *   - Users deposit a base stablecoin (e.g. cUSD)
 *   - Rebalancer diversifies into allowlisted tokens via DEX routers
 *   - Fees are skimmed on swap (protocol fee) and at withdrawal (management fee)
 *   - Daily swap limit caps rebalancer exposure
 */
contract DiversiFiVault is ERC4626, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Roles ──────────────────────────────────────────────────────────────
    bytes32 public constant REBALANCER_ROLE = keccak256("REBALANCER_ROLE");

    // ─── State ──────────────────────────────────────────────────────────────
    /// @notice Protocol fee recipient address
    address public feeRecipient;

    /// @notice Management fee in basis points (e.g. 100 = 1% annual)
    uint256 public managementFeeBps;

    /// @notice Swap fee in basis points (e.g. 10 = 0.10%)
    uint256 public swapFeeBps;

    /// @notice Maximum total swap volume per day (in base asset units)
    uint256 public dailySwapLimit;

    /// @notice Accumulated swap volume today
    uint256 public dailySwapVolume;

    /// @notice Start of current day (Unix timestamp, floored to midnight UTC)
    uint256 public currentDayStart;

    /// @notice Total fees collected (in base asset units)
    uint256 public totalFeesCollected;

    /// @notice Whether a token is allowlisted for swaps
    mapping(address => bool) public allowedTokens;

    /// @notice The DEX routers the rebalancer can call
    mapping(address => bool) public allowedRouters;

    // ─── Events ─────────────────────────────────────────────────────────────
    event SwapExecuted(
        address indexed rebalancer,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount,
        address router
    );

    event TokenAllowlisted(address indexed token, bool allowed);
    event RouterAllowlisted(address indexed router, bool allowed);
    event FeesCollected(address indexed recipient, uint256 amount);
    event DailyLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event FeeParamsUpdated(uint256 managementFeeBps, uint256 swapFeeBps);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    // ─── Errors ─────────────────────────────────────────────────────────────
    error TokenNotAllowed(address token);
    error RouterNotAllowed(address router);
    error DailyLimitExceeded(uint256 volume, uint256 limit);
    error ZeroAmount();
    error SwapFailed(bytes reason);
    error InvalidFeeRecipient();
    error ExcessiveFee(uint256 feeBps);

    // ─── Constructor ────────────────────────────────────────────────────────
    /**
     * @param _asset The base asset (e.g. cUSD address on Celo)
     * @param _name Vault share token name
     * @param _symbol Vault share token symbol
     * @param _admin Admin role holder (can pause, set fees, manage allowlist)
     * @param _rebalancer Rebalancer role holder (agent address)
     * @param _feeRecipient Protocol fee recipient
     * @param _dailySwapLimit Max daily swap volume in base asset units
     */
    constructor(
        address _asset,
        string memory _name,
        string memory _symbol,
        address _admin,
        address _rebalancer,
        address _feeRecipient,
        uint256 _dailySwapLimit
    ) ERC4626(IERC20(_asset)) ERC20(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(REBALANCER_ROLE, _rebalancer);

        feeRecipient = _feeRecipient;
        dailySwapLimit = _dailySwapLimit;
        managementFeeBps = 100; // 1% annual default
        swapFeeBps = 10; // 0.10% default
        currentDayStart = _dayStart(block.timestamp);
    }

    // ─── Deposit / Withdraw (ERC-4626 overrides) ────────────────────────────

    /**
     * @notice Deposit base asset into the vault, receive shares.
     * @dev Anyone can deposit. Management fee is settled before shares are minted.
     */
    function deposit(uint256 assets, address receiver)
        public
        override(ERC4626)
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        _settleFees();
        return super.deposit(assets, receiver);
    }

    /**
     * @notice Withdraw base asset from the vault, burning shares.
     * @dev The depositor always withdraws. Management fee is settled before shares are burned.
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override(ERC4626)
        whenNotPaused
        nonReentrant
        returns (uint256 shares)
    {
        _settleFees();
        return super.withdraw(assets, receiver, owner);
    }

    // ─── Rebalancer Operations ──────────────────────────────────────────────

    /**
     * @notice Execute a swap within the vault's holdings.
     * @dev Only callable by REBALANCER_ROLE. Enforces token allowlist, router allowlist,
     *      and daily swap limit. Protocol fee is skimmed from the output.
     *
     * @param tokenIn Token to sell (must be allowlisted)
     * @param tokenOut Token to buy (must be allowlisted)
     * @param amountIn Amount of tokenIn to swap
     * @param minAmountOut Minimum acceptable output (after fee)
     * @param router DEX router address (must be allowlisted)
     * @param swapData Encoded swap calldata for the router
     */
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address router,
        bytes calldata swapData
    ) external onlyRole(REBALANCER_ROLE) whenNotPaused nonReentrant {
        if (amountIn == 0) revert ZeroAmount();
        if (!allowedTokens[tokenIn]) revert TokenNotAllowed(tokenIn);
        if (!allowedTokens[tokenOut]) revert TokenNotAllowed(tokenOut);
        if (!allowedRouters[router]) revert RouterNotAllowed(router);

        // Check daily limit
        _rolloverDay();
        if (dailySwapVolume + amountIn > dailySwapLimit) {
            revert DailyLimitExceeded(dailySwapVolume + amountIn, dailySwapLimit);
        }

        // Record balance before
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));

        // Approve router to spend tokenIn
        IERC20(tokenIn).forceApprove(router, amountIn);

        // Execute swap through router
        (bool success, bytes memory result) = router.call(swapData);
        if (!success) {
            // Bubble up revert reason if available
            if (result.length > 0) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
            revert SwapFailed("Router call failed");
        }

        // Calculate output
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        uint256 amountOut = balanceAfter - balanceBefore;

        // Skim protocol fee from output
        uint256 feeAmount = 0;
        if (swapFeeBps > 0 && amountOut > 0) {
            feeAmount = (amountOut * swapFeeBps) / 10000;
            if (feeAmount > 0) {
                IERC20(tokenOut).safeTransfer(feeRecipient, feeAmount);
                totalFeesCollected += feeAmount;
            }
        }

        uint256 netOut = amountOut - feeAmount;
        if (netOut < minAmountOut) {
            revert SwapFailed("Slippage exceeded");
        }

        // Update daily volume
        dailySwapVolume += amountIn;

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, netOut, feeAmount, router);
    }

    // ─── Admin Operations ───────────────────────────────────────────────────

    /**
     * @notice Add or remove a token from the allowlist.
     */
    function setTokenAllowlist(address token, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowedTokens[token] = allowed;
        emit TokenAllowlisted(token, allowed);
    }

    /**
     * @notice Add or remove a DEX router from the allowlist.
     */
    function setRouterAllowlist(address router, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowedRouters[router] = allowed;
        emit RouterAllowlisted(router, allowed);
    }

    /**
     * @notice Update daily swap limit.
     */
    function setDailySwapLimit(uint256 newLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldLimit = dailySwapLimit;
        dailySwapLimit = newLimit;
        emit DailyLimitUpdated(oldLimit, newLimit);
    }

    /**
     * @notice Update fee parameters.
     * @param _managementFeeBps Management fee in basis points (max 500 = 5%)
     * @param _swapFeeBps Swap fee in basis points (max 100 = 1%)
     */
    function setFeeParams(uint256 _managementFeeBps, uint256 _swapFeeBps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_managementFeeBps > 500) revert ExcessiveFee(_managementFeeBps);
        if (_swapFeeBps > 100) revert ExcessiveFee(_swapFeeBps);
        managementFeeBps = _managementFeeBps;
        swapFeeBps = _swapFeeBps;
        emit FeeParamsUpdated(_managementFeeBps, _swapFeeBps);
    }

    /**
     * @notice Update fee recipient.
     */
    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRecipient == address(0)) revert InvalidFeeRecipient();
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ─── View Functions ─────────────────────────────────────────────────────

    /**
     * @notice Remaining daily swap capacity (in base asset units).
     */
    function remainingDailyCapacity() external view returns (uint256) {
        if (_dayStart(block.timestamp) != currentDayStart) {
            return dailySwapLimit; // New day, reset
        }
        return dailySwapLimit > dailySwapVolume ? dailySwapLimit - dailySwapVolume : 0;
    }

    /**
     * @notice Total value locked in the vault (base asset equivalent).
     */
    function totalValueLocked() external view returns (uint256) {
        return totalAssets();
    }

    // ─── Internal ───────────────────────────────────────────────────────────

    /**
     * @dev Settle accrued management fees by minting shares to feeRecipient.
     *      Called automatically on deposit/withdraw.
     *      Pro-rated daily: shares = (totalShares * annualRate / 365) * daysSinceLastSettle
     */
    function _settleFees() internal {
        if (managementFeeBps == 0 || totalSupply() == 0) return;

        uint256 daysSinceLast = (block.timestamp - currentDayStart) / 1 days;
        if (daysSinceLast == 0) return;

        // Management fee shares to mint to feeRecipient
        uint256 feeShares = (totalSupply() * managementFeeBps * daysSinceLast) / (10000 * 365);
        if (feeShares > 0) {
            _mint(feeRecipient, feeShares);
            totalFeesCollected += feeShares; // Track in share units (approximate)
        }

        currentDayStart = _dayStart(block.timestamp);
    }

    /**
     * @dev Rollover daily swap volume counter if it's a new day.
     */
    function _rolloverDay() internal {
        uint256 today = _dayStart(block.timestamp);
        if (today != currentDayStart) {
            dailySwapVolume = 0;
            currentDayStart = today;
        }
    }

    function _dayStart(uint256 timestamp) internal pure returns (uint256) {
        return timestamp - (timestamp % 1 days);
    }
}
