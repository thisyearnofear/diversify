// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StrategyVault
 * @notice Allows Curators to create and stake on diversification baskets.
 * Users can 'Shield' their capital by depositing into these vaults, and redeem
 * their shares at any time. Authorized operators (e.g., the AgenticHub) can
 * allocate vault assets to on-chain liquidity venues with slippage and deadline
 * protection.
 *
 * Chain-agnostic: deploy with cUSD on Celo, USDC on Arbitrum, etc.
 */
contract StrategyVault is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;

    struct Strategy {
        address curator;
        string name;
        uint256 curatorStake; // Collateral provided by curator
        uint256 totalDeposits; // Total user assets in vault
        bool active;
    }

    mapping(uint256 => Strategy) public strategies;
    uint256 public strategyCount;

    /// @notice User deposits per strategy
    mapping(uint256 => mapping(address => uint256)) public userDeposits;

    /// @notice Addresses authorized to allocate vault capital (AgenticHub, keeper, etc.)
    mapping(address => bool) public operators;

    event StrategyCreated(uint256 indexed id, address indexed curator, string name);
    event ShieldApplied(uint256 indexed strategyId, address indexed user, uint256 amount);
    event CuratorStaked(uint256 indexed strategyId, uint256 amount);
    event Redeemed(uint256 indexed strategyId, address indexed user, uint256 amount);
    event OperatorSet(address indexed operator, bool authorized);
    event Allocated(
        uint256 indexed strategyId,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    );

    error StrategyInactive(uint256 strategyId);
    error UnauthorizedOperator(address caller);
    error DeadlineExpired(uint256 deadline);
    error SlippageExceeded(uint256 minOut, uint256 actualOut);
    error InsufficientDeposit(uint256 requested, uint256 available);
    error ZeroAddress();

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedOperator(msg.sender);
        }
        _;
    }

    constructor(address _paymentToken, address _initialOwner) Ownable(_initialOwner) {
        if (_paymentToken == address(0) || _initialOwner == address(0)) revert ZeroAddress();
        paymentToken = IERC20(_paymentToken);
    }

    /**
     * @notice Authorize or revoke an operator (AgenticHub, keeper, etc.).
     */
    function setOperator(address operator, bool authorized) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        operators[operator] = authorized;
        emit OperatorSet(operator, authorized);
    }

    /**
     * @notice Curator creates a strategy and stakes payment tokens as collateral.
     */
    function createStrategy(string memory _name, uint256 _stakeAmount) external nonReentrant {
        require(_stakeAmount > 0, "Stake required");

        paymentToken.safeTransferFrom(msg.sender, address(this), _stakeAmount);

        strategyCount++;
        strategies[strategyCount] =
            Strategy({curator: msg.sender, name: _name, curatorStake: _stakeAmount, totalDeposits: 0, active: true});

        emit StrategyCreated(strategyCount, msg.sender, _name);
        emit CuratorStaked(strategyCount, _stakeAmount);
    }

    /**
     * @notice User 'Shields' capital by depositing into a Curator's vault.
     */
    function shieldCapital(uint256 _strategyId, uint256 _amount) external nonReentrant {
        Strategy storage strategy = strategies[_strategyId];
        if (!strategy.active) revert StrategyInactive(_strategyId);
        require(_amount > 0, "Amount required");

        paymentToken.safeTransferFrom(msg.sender, address(this), _amount);

        userDeposits[_strategyId][msg.sender] += _amount;
        strategy.totalDeposits += _amount;

        emit ShieldApplied(_strategyId, msg.sender, _amount);
    }

    /**
     * @notice Redeem a user's deposit from a strategy.
     * @param _strategyId Strategy to redeem from
     * @param _amount Amount of payment tokens to withdraw (0 for full balance)
     */
    function redeem(uint256 _strategyId, uint256 _amount) external nonReentrant {
        Strategy storage strategy = strategies[_strategyId];
        if (!strategy.active) revert StrategyInactive(_strategyId);

        uint256 deposit = userDeposits[_strategyId][msg.sender];
        uint256 amountToWithdraw = _amount == 0 ? deposit : _amount;

        if (amountToWithdraw > deposit) {
            revert InsufficientDeposit(amountToWithdraw, deposit);
        }
        if (amountToWithdraw == 0) revert InsufficientDeposit(0, 0);

        userDeposits[_strategyId][msg.sender] = deposit - amountToWithdraw;
        strategy.totalDeposits -= amountToWithdraw;

        paymentToken.safeTransfer(msg.sender, amountToWithdraw);

        emit Redeemed(_strategyId, msg.sender, amountToWithdraw);
    }

    /**
     * @notice Operator allocates vault capital to another token via a DEX router.
     * Includes deadline and minimum-output slippage protection.
     *
     * @param _strategyId Strategy whose assets are being allocated
     * @param _router Approved DEX router (e.g., Uniswap V2/SushiSwap on Arbitrum)
     * @param _tokenOut Target output token
     * @param _amountIn Amount of paymentToken to swap
     * @param _minAmountOut Minimum acceptable output (slippage protection)
     * @param _deadline Unix timestamp by which the tx must execute
     */
    function allocate(
        uint256 _strategyId,
        address _router,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _minAmountOut,
        uint256 _deadline
    ) external onlyOperator nonReentrant {
        Strategy storage strategy = strategies[_strategyId];
        if (!strategy.active) revert StrategyInactive(_strategyId);
        if (block.timestamp > _deadline) revert DeadlineExpired(_deadline);
        require(_amountIn > 0, "Amount required");
        require(_router != address(0) && _tokenOut != address(0), "Zero address");

        // The vault approves the router and executes the swap. The output tokens
        // remain in the vault and increase the strategy's backing assets.
        paymentToken.forceApprove(_router, _amountIn);

        address[] memory path = new address[](2);
        path[0] = address(paymentToken);
        path[1] = _tokenOut;

        uint256[] memory amounts =
            IUniswapV2Router(_router).swapExactTokensForTokens(_amountIn, _minAmountOut, path, address(this), _deadline);

        uint256 amountOut = amounts[amounts.length - 1];
        if (amountOut < _minAmountOut) {
            revert SlippageExceeded(_minAmountOut, amountOut);
        }

        // Revoke approval as a defensive measure.
        paymentToken.forceApprove(_router, 0);

        // For accounting simplicity, we treat the swapped output as still
        // backing the strategy. A production vault would price all assets and
        // issue shares; here we track nominal deposit backing.
        strategy.totalDeposits = strategy.totalDeposits - _amountIn + amountOut;

        emit Allocated(_strategyId, address(paymentToken), _tokenOut, _amountIn, _minAmountOut, _deadline);
    }

    /**
     * @notice Withdraw accumulated non-payment-token assets to the owner.
     * Used if the vault holds swapped tokens that need to be recovered.
     */
    function recoverERC20(address _token, uint256 _amount) external onlyOwner {
        require(_token != address(paymentToken), "Cannot recover payment token");
        IERC20(_token).safeTransfer(owner(), _amount);
    }

    /**
     * @notice View a user's deposit balance in a strategy.
     */
    function balanceOf(uint256 _strategyId, address _user) external view returns (uint256) {
        return userDeposits[_strategyId][_user];
    }
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}
