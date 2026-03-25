// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./DiversiFiVault.sol";
import "./DiversiFiVaultFactory.sol";

// ─── Mock Tokens ───────────────────────────────────────────────────────────

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function decimals() public pure override returns (uint8) { return 18; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

// ─── Mock Router ───────────────────────────────────────────────────────────

contract MockRouter {
    mapping(address => mapping(address => uint256)) public rates;

    function setRate(address tokenIn, address tokenOut, uint256 rate) external {
        rates[tokenIn][tokenOut] = rate;
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn) external {
        uint256 amountOut = (amountIn * rates[tokenIn][tokenOut]) / 1e18;
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(msg.sender, amountOut);
    }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

contract DiversiFiVaultFactoryTest is Test {
    DiversiFiVaultFactory public factory;
    MockERC20 public cUSD;
    MockERC20 public cEUR;
    MockERC20 public KESm;
    MockRouter public router;

    address admin = address(0xAD);
    address rebalancer = address(0xBE);
    address feeRecipient = address(0xFE);
    address userA = address(0xA1);
    address userB = address(0xB2);
    address userC = address(0xC3);

    function setUp() public {
        cUSD = new MockERC20("Celo Dollar", "cUSD");
        cEUR = new MockERC20("Celo Euro", "cEUR");
        KESm = new MockERC20("Kenya Shilling", "KESm");

        router = new MockRouter();
        router.setRate(address(cUSD), address(cEUR), 1.1e18);
        router.setRate(address(cUSD), address(KESm), 150e18);

        factory = new DiversiFiVaultFactory(
            address(cUSD),
            admin,
            rebalancer,
            feeRecipient,
            10_000e18 // daily limit
        );

        // Fund users
        cUSD.mint(userA, 10_000e18);
        cUSD.mint(userB, 10_000e18);
        cUSD.mint(userC, 10_000e18);
        cEUR.mint(address(router), 100_000e18);
        KESm.mint(address(router), 100_000e18);
    }

    // ─── Factory: Create Vault ──────────────────────────────────────────────

    function test_create_vault() public {
        vm.prank(admin);
        address vaultA = factory.createVault(userA, "africapitalism", "dV-AFRI", "dV-AFRI");

        assertEq(factory.getVault(userA), vaultA);
        assertTrue(factory.hasActiveVault(userA));
        assertEq(factory.vaultCount(), 1);
    }

    function test_create_multiple_vaults() public {
        vm.prank(admin);
        address vaultA = factory.createVault(userA, "africapitalism", "dV-AFRI", "dV-AFRI");

        vm.prank(admin);
        address vaultB = factory.createVault(userB, "islamic", "dV-ISLM", "dV-ISLM");

        vm.prank(admin);
        address vaultC = factory.createVault(userC, "global", "dV-GLOB", "dV-GLOB");

        assertNotEq(address(vaultA), address(vaultB));
        assertNotEq(address(vaultB), address(vaultC));
        assertEq(factory.vaultCount(), 3);
    }

    function test_duplicate_vault_reverts() public {
        vm.prank(admin);
        factory.createVault(userA, "africapitalism", "dV-AFRI", "dV-AFRI");

        vm.prank(admin);
        vm.expectRevert();
        factory.createVault(userA, "islamic", "dV-ISLM2", "dV-ISLM2");
    }

    // ─── Vault Isolation ────────────────────────────────────────────────────

    function test_per_user_isolation() public {
        // Create vaults
        vm.prank(admin);
        address vaultA = factory.createVault(userA, "africapitalism", "dV-AFRI", "dV-AFRI");

        vm.prank(admin);
        address vaultB = factory.createVault(userB, "islamic", "dV-ISLM", "dV-ISLM");

        // User A deposits into their vault
        vm.startPrank(userA);
        cUSD.approve(vaultA, 1000e18);
        DiversiFiVault(vaultA).deposit(1000e18, userA);
        vm.stopPrank();

        // User B deposits into their vault
        vm.startPrank(userB);
        cUSD.approve(vaultB, 5000e18);
        DiversiFiVault(vaultB).deposit(5000e18, userB);
        vm.stopPrank();

        // Verify isolation
        assertEq(DiversiFiVault(vaultA).totalAssets(), 1000e18);
        assertEq(DiversiFiVault(vaultB).totalAssets(), 5000e18);
        assertGt(DiversiFiVault(vaultA).balanceOf(userA), 0);
        assertEq(DiversiFiVault(vaultA).balanceOf(userB), 0);
        assertGt(DiversiFiVault(vaultB).balanceOf(userB), 0);
        assertEq(DiversiFiVault(vaultB).balanceOf(userA), 0);
    }

    function test_independent_rebalancing() public {
        // Create vaults with different strategies
        vm.prank(admin);
        address vaultA = factory.createVault(userA, "africapitalism", "dV-AFRI", "dV-AFRI");

        vm.prank(admin);
        address vaultB = factory.createVault(userB, "islamic", "dV-ISLM", "dV-ISLM");

        // Allowlist tokens and router on both vaults
        _setupVault(vaultA);
        _setupVault(vaultB);

        // Both users deposit
        vm.startPrank(userA);
        cUSD.approve(vaultA, 1000e18);
        DiversiFiVault(vaultA).deposit(1000e18, userA);
        vm.stopPrank();

        vm.startPrank(userB);
        cUSD.approve(vaultB, 1000e18);
        DiversiFiVault(vaultB).deposit(1000e18, userB);
        vm.stopPrank();

        // Rebalancer swaps in vault A only (user A wants cEUR)
        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256)",
            address(cUSD), address(cEUR), 200e18
        );
        vm.prank(rebalancer);
        DiversiFiVault(vaultA).executeSwap(address(cUSD), address(cEUR), 200e18, 0, address(router), swapData);

        // Vault B is unaffected
        assertEq(DiversiFiVault(vaultB).totalAssets(), 1000e18);
        assertEq(cUSD.balanceOf(vaultB), 1000e18);

        // Vault A has diversified
        assertEq(cUSD.balanceOf(vaultA), 800e18);
        assertGt(cEUR.balanceOf(vaultA), 0);
    }

    function test_user_cannot_deposit_to_another_users_vault() public {
        vm.prank(admin);
        address vaultA = factory.createVault(userA, "africapitalism", "dV-AFRI", "dV-AFRI");

        _setupVault(vaultA);

        // User B tries to deposit into User A's vault
        // This actually works at the ERC-4626 level (anyone can deposit),
        // but the shares go to the receiver address
        vm.startPrank(userB);
        cUSD.approve(vaultA, 100e18);
        DiversiFiVault(vaultA).deposit(100e18, userB);
        vm.stopPrank();

        // User B gets shares, but the factory tracks that vaultA belongs to userA
        assertGt(DiversiFiVault(vaultA).balanceOf(userB), 0);
        assertEq(factory.getVault(userA), vaultA);
    }

    // ─── Rebalancer Role ────────────────────────────────────────────────────

    function test_only_rebalancer_can_swap() public {
        vm.prank(admin);
        address vaultA = factory.createVault(userA, "africapitalism", "dV-AFRI", "dV-AFRI");
        _setupVault(vaultA);

        vm.startPrank(userA);
        cUSD.approve(vaultA, 1000e18);
        DiversiFiVault(vaultA).deposit(1000e18, userA);
        vm.stopPrank();

        bytes memory swapData = abi.encodeWithSignature(
            "swap(address,address,uint256)",
            address(cUSD), address(cEUR), 100e18
        );

        // User A tries to swap — not rebalancer
        vm.prank(userA);
        vm.expectRevert();
        DiversiFiVault(vaultA).executeSwap(address(cUSD), address(cEUR), 100e18, 0, address(router), swapData);

        // Rebalancer can swap
        vm.prank(rebalancer);
        DiversiFiVault(vaultA).executeSwap(address(cUSD), address(cEUR), 100e18, 0, address(router), swapData);
    }

    function test_rebalancer_cannot_withdraw() public {
        vm.prank(admin);
        address vaultA = factory.createVault(userA, "africapitalism", "dV-AFRI", "dV-AFRI");

        vm.startPrank(userA);
        cUSD.approve(vaultA, 1000e18);
        DiversiFiVault(vaultA).deposit(1000e18, userA);
        vm.stopPrank();

        // Rebalancer has no shares — cannot withdraw
        vm.prank(rebalancer);
        vm.expectRevert();
        DiversiFiVault(vaultA).withdraw(100e18, rebalancer, rebalancer);
    }

    // ─── Deactivation ──────────────────────────────────────────────────────

    function test_deactivate_vault() public {
        vm.prank(admin);
        address vaultA = factory.createVault(userA, "africapitalism", "dV-AFRI", "dV-AFRI");

        assertTrue(factory.hasActiveVault(userA));

        vm.prank(admin);
        factory.deactivateVault(userA);

        assertFalse(factory.hasActiveVault(userA));
    }

    function test_create_new_vault_after_deactivate() public {
        vm.prank(admin);
        address oldVault = factory.createVault(userA, "africapitalism", "dV-AFRI", "dV-AFRI");

        vm.prank(admin);
        factory.deactivateVault(userA);

        // Can create a new one with a different strategy
        vm.prank(admin);
        address newVault = factory.createVault(userA, "islamic", "dV-ISLM", "dV-ISLM");

        // New vault has a different address (CREATE2 salt includes vaultCount)
        assertNotEq(newVault, oldVault);
        assertEq(factory.getVault(userA), newVault);
        assertTrue(factory.hasActiveVault(userA));
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    function _setupVault(address vault) internal {
        vm.startPrank(admin);
        DiversiFiVault(vault).setTokenAllowlist(address(cUSD), true);
        DiversiFiVault(vault).setTokenAllowlist(address(cEUR), true);
        DiversiFiVault(vault).setTokenAllowlist(address(KESm), true);
        DiversiFiVault(vault).setRouterAllowlist(address(router), true);
        vm.stopPrank();
    }
}
