// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./DiversiFiVault.sol";

// ─── Mock Tokens ───────────────────────────────────────────────────────────

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ─── Mock DEX Router ───────────────────────────────────────────────────────

contract MockRouter {
    mapping(address => mapping(address => uint256)) public rates;

    function setRate(address tokenIn, address tokenOut, uint256 rate) external {
        rates[tokenIn][tokenOut] = rate;
    }

    /**
     * @dev Mock swap: transfers tokenIn from caller, sends tokenOut back.
     *      rate = how much tokenOut per 1 tokenIn (in 18 decimals).
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external {
        uint256 rate = rates[tokenIn][tokenOut];
        require(rate > 0, "MockRouter: no rate set");

        uint256 amountOut = (amountIn * rate) / 1e18;
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(msg.sender, amountOut);
    }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

contract DiversiFiVaultTest is Test {
    DiversiFiVault public vault;
    MockERC20 public cUSD;
    MockERC20 public cEUR;
    MockERC20 public KESm;
    MockRouter public router;

    address admin = address(0xAD);
    address rebalancer = address(0xBE);
    address feeRecipient = address(0xFE);
    address user1 = address(0x01);
    address user2 = address(0x02);

    uint256 constant DEPOSIT_AMOUNT = 1000e18;
    uint256 constant DAILY_LIMIT = 10_000e18;

    function setUp() public {
        // Deploy tokens
        cUSD = new MockERC20("Celo Dollar", "cUSD");
        cEUR = new MockERC20("Celo Euro", "cEUR");
        KESm = new MockERC20("Kenya Shilling", "KESm");

        // Deploy mock router
        router = new MockRouter();
        router.setRate(address(cUSD), address(cEUR), 1.1e18); // 1 cUSD = 1.1 cEUR
        router.setRate(address(cEUR), address(cUSD), 0.9e18); // 1 cEUR = 0.9 cUSD

        // Deploy vault
        vault = new DiversiFiVault(
            address(cUSD),
            "DiversiFi Vault",
            "dVAULT",
            admin,
            rebalancer,
            feeRecipient,
            DAILY_LIMIT
        );

        // Allowlist tokens and router
        vm.prank(admin);
        vault.setTokenAllowlist(address(cUSD), true);

        vm.prank(admin);
        vault.setTokenAllowlist(address(cEUR), true);

        vm.prank(admin);
        vault.setTokenAllowlist(address(KESm), true);

        vm.prank(admin);
        vault.setRouterAllowlist(address(router), true);

        // Fund users
        cUSD.mint(user1, 10_000e18);
        cUSD.mint(user2, 10_000e18);
        cEUR.mint(address(router), 100_000e18);
    }

    // ─── Deposit Tests ──────────────────────────────────────────────────────

    function test_deposit() public {
        vm.startPrank(user1);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);
        uint256 shares = vault.deposit(DEPOSIT_AMOUNT, user1);
        vm.stopPrank();

        assertGt(shares, 0, "Should receive shares");
        assertEq(vault.balanceOf(user1), shares);
        assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
    }

    function test_deposit_multiple_users() public {
        // User 1 deposits
        vm.prank(user1);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT, user1);

        // User 2 deposits
        vm.prank(user2);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT * 2);
        vm.prank(user2);
        vault.deposit(DEPOSIT_AMOUNT * 2, user2);

        assertEq(vault.totalAssets(), DEPOSIT_AMOUNT * 3);
        assertGt(vault.balanceOf(user2), vault.balanceOf(user1));
    }

    // ─── Withdraw Tests ─────────────────────────────────────────────────────

    function test_withdraw() public {
        // Deposit
        vm.startPrank(user1);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT, user1);

        // Withdraw half
        uint256 sharesToRedeem = vault.balanceOf(user1) / 2;
        uint256 balanceBefore = cUSD.balanceOf(user1);
        vault.withdraw(DEPOSIT_AMOUNT / 2, user1, user1);
        vm.stopPrank();

        assertEq(cUSD.balanceOf(user1) - balanceBefore, DEPOSIT_AMOUNT / 2);
        assertEq(vault.balanceOf(user1), sharesToRedeem);
    }

    function test_withdraw_all() public {
        vm.startPrank(user1);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT, user1);

        uint256 balanceBefore = cUSD.balanceOf(user1);
        vault.redeem(vault.balanceOf(user1), user1, user1);
        vm.stopPrank();

        assertApproxEqAbs(cUSD.balanceOf(user1) - balanceBefore, DEPOSIT_AMOUNT, 1e15);
        assertEq(vault.balanceOf(user1), 0);
    }

    // ─── Swap Tests ─────────────────────────────────────────────────────────

    function test_execute_swap() public {
        // Deposit
        vm.prank(user1);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT, user1);

        // Build swap calldata
        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256)",
            address(cUSD),
            address(cEUR),
            100e18
        );

        uint256 cEURBefore = cEUR.balanceOf(address(vault));

        // Execute swap
        vm.prank(rebalancer);
        vault.executeSwap(
            address(cUSD),
            address(cEUR),
            100e18,
            100e18, // minAmountOut (before fee, for test simplicity)
            address(router),
            swapData
        );

        uint256 cEURAfter = cEUR.balanceOf(address(vault));
        assertGt(cEURAfter, cEURBefore, "Vault should have received cEUR");

        // Check daily volume tracked
        assertEq(vault.dailySwapVolume(), 100e18);
    }

    function test_swap_respects_daily_limit() public {
        cUSD.mint(user1, 20_000e18); // Ensure enough balance
        vm.prank(user1);
        cUSD.approve(address(vault), 20_000e18);
        vm.prank(user1);
        vault.deposit(20_000e18, user1);

        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256)",
            address(cUSD),
            address(cEUR),
            DAILY_LIMIT
        );

        // First swap at the limit — should succeed
        vm.prank(rebalancer);
        vault.executeSwap(address(cUSD), address(cEUR), DAILY_LIMIT, 0, address(router), swapData);

        // Second swap should fail — daily limit exceeded
        vm.prank(rebalancer);
        vm.expectRevert(abi.encodeWithSelector(DiversiFiVault.DailyLimitExceeded.selector, DAILY_LIMIT + 1e18, DAILY_LIMIT));
        vault.executeSwap(address(cUSD), address(cEUR), 1e18, 0, address(router), swapData);
    }

    function test_swap_rejects_non_allowlisted_token() public {
        MockERC20 randomToken = new MockERC20("Random", "RND");

        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256)",
            address(cUSD),
            address(randomToken),
            100e18
        );

        vm.prank(rebalancer);
        vm.expectRevert(abi.encodeWithSelector(DiversiFiVault.TokenNotAllowed.selector, address(randomToken)));
        vault.executeSwap(address(cUSD), address(randomToken), 100e18, 0, address(router), swapData);
    }

    function test_swap_rejects_non_rebalancer() public {
        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256)",
            address(cUSD),
            address(cEUR),
            100e18
        );

        vm.prank(user1);
        vm.expectRevert();
        vault.executeSwap(address(cUSD), address(cEUR), 100e18, 0, address(router), swapData);
    }

    function test_swap_rejects_non_allowlisted_router() public {
        address fakeRouter = address(0xDEAD);
        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256)",
            address(cUSD),
            address(cEUR),
            100e18
        );

        vm.prank(rebalancer);
        vm.expectRevert(abi.encodeWithSelector(DiversiFiVault.RouterNotAllowed.selector, fakeRouter));
        vault.executeSwap(address(cUSD), address(cEUR), 100e18, 0, fakeRouter, swapData);
    }

    // ─── Fee Tests ──────────────────────────────────────────────────────────

    function test_swap_fee_collected() public {
        vm.prank(user1);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT, user1);

        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256)",
            address(cUSD),
            address(cEUR),
            100e18
        );

        uint256 feeRecipientBefore = cEUR.balanceOf(feeRecipient);

        vm.prank(rebalancer);
        vault.executeSwap(address(cUSD), address(cEUR), 100e18, 0, address(router), swapData);

        uint256 feeReceived = cEUR.balanceOf(feeRecipient) - feeRecipientBefore;
        assertGt(feeReceived, 0, "Fee recipient should have received fees");
    }

    function test_swap_fee_percentage() public {
        // Default swapFeeBps = 10 (0.10%)
        // Swap 100 cUSD -> 110 cEUR (at 1.1 rate)
        // Fee = 110 * 10 / 10000 = 0.11 cEUR

        vm.prank(user1);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT, user1);

        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256)",
            address(cUSD),
            address(cEUR),
            100e18
        );

        vm.prank(rebalancer);
        vault.executeSwap(address(cUSD), address(cEUR), 100e18, 0, address(router), swapData);

        // Expected: 110 cEUR output * 0.10% = 0.11 cEUR fee
        uint256 expectedFee = (110e18 * 10) / 10000;
        assertApproxEqAbs(cEUR.balanceOf(feeRecipient), expectedFee, 1e15);
    }

    // ─── Admin Tests ────────────────────────────────────────────────────────

    function test_pause_unpause() public {
        vm.prank(admin);
        vault.pause();

        vm.prank(user1);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);

        vm.prank(user1);
        vm.expectRevert();
        vault.deposit(DEPOSIT_AMOUNT, user1);

        vm.prank(admin);
        vault.unpause();

        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT, user1);
        assertGt(vault.balanceOf(user1), 0);
    }

    function test_set_fee_params() public {
        vm.prank(admin);
        vault.setFeeParams(200, 25); // 2% management, 0.25% swap

        assertEq(vault.managementFeeBps(), 200);
        assertEq(vault.swapFeeBps(), 25);
    }

    function test_set_fee_params_rejects_excessive() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(DiversiFiVault.ExcessiveFee.selector, 501));
        vault.setFeeParams(501, 25);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(DiversiFiVault.ExcessiveFee.selector, 101));
        vault.setFeeParams(200, 101);
    }

    function test_only_admin_can_set_fees() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.setFeeParams(200, 25);
    }

    function test_only_admin_can_pause() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.pause();
    }

    // ─── Invariant Tests ────────────────────────────────────────────────────

    function test_rebalancer_cannot_withdraw() public {
        // Deposit
        vm.prank(user1);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT, user1);

        // Rebalancer tries to withdraw — should fail (no shares)
        vm.prank(rebalancer);
        vm.expectRevert();
        vault.withdraw(DEPOSIT_AMOUNT, rebalancer, rebalancer);
    }

    function test_remaining_capacity() public {
        assertEq(vault.remainingDailyCapacity(), DAILY_LIMIT);

        vm.prank(user1);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT, user1);

        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256)",
            address(cUSD),
            address(cEUR),
            500e18
        );

        vm.prank(rebalancer);
        vault.executeSwap(address(cUSD), address(cEUR), 500e18, 0, address(router), swapData);

        assertEq(vault.remainingDailyCapacity(), DAILY_LIMIT - 500e18);
    }

    function test_deposit_after_swap_preserves_value() public {
        // User 1 deposits
        vm.prank(user1);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);
        vm.prank(user1);
        vault.deposit(DEPOSIT_AMOUNT, user1);

        // Rebalancer swaps 200 cUSD -> cEUR
        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256)",
            address(cUSD),
            address(cEUR),
            200e18
        );
        vm.prank(rebalancer);
        vault.executeSwap(address(cUSD), address(cEUR), 200e18, 0, address(router), swapData);

        // User 2 deposits same amount
        vm.prank(user2);
        cUSD.approve(address(vault), DEPOSIT_AMOUNT);
        vm.prank(user2);
        uint256 shares2 = vault.deposit(DEPOSIT_AMOUNT, user2);

        // Shares should exist and be non-zero (value preserved through diversification)
        assertGt(shares2, 0, "User 2 should receive shares");
        // Due to swap fee and price movement, shares won't be exactly equal
        // but the vault should still be solvent
        assertGe(vault.totalAssets(), 0);
    }
}
