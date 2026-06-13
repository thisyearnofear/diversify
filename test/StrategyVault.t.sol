// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/StrategyVault.sol";
import "./mocks/MockERC20.sol";
import "./mocks/MockUniswapV2Router.sol";

contract StrategyVaultTest is Test {
    StrategyVault public vault;
    MockERC20 public paymentToken;
    MockERC20 public targetToken;
    MockUniswapV2Router public router;

    address public owner = makeAddr("owner");
    address public operator = makeAddr("operator");
    address public curator = makeAddr("curator");
    address public user = makeAddr("user");
    address public stranger = makeAddr("stranger");

    function setUp() public {
        vm.startPrank(owner);
        paymentToken = new MockERC20("Test USD", "tUSD", 18);
        targetToken = new MockERC20("Target", "TGT", 18);
        router = new MockUniswapV2Router();
        vault = new StrategyVault(address(paymentToken), owner);
        vault.setOperator(operator, true);
        vm.stopPrank();

        paymentToken.mint(curator, 1000 ether);
        paymentToken.mint(user, 1000 ether);
    }

    function testConstructorSetsTokenAndOwner() public view {
        assertEq(address(vault.paymentToken()), address(paymentToken));
        assertEq(vault.owner(), owner);
    }

    function testZeroAddressConstructorReverts() public {
        // OpenZeppelin Ownable catches address(0) owner before our check.
        vm.expectRevert();
        new StrategyVault(address(0), owner);

        vm.expectRevert();
        new StrategyVault(address(paymentToken), address(0));
    }

    function testCreateStrategy() public {
        uint256 stake = 100 ether;

        vm.prank(curator);
        paymentToken.approve(address(vault), stake);

        vm.prank(curator);
        vault.createStrategy("Emerging Markets", stake);

        assertEq(vault.strategyCount(), 1);
        (address stratCurator, string memory name, uint256 curatorStake, uint256 totalDeposits, bool active) =
            vault.strategies(1);
        assertEq(stratCurator, curator);
        assertEq(name, "Emerging Markets");
        assertEq(curatorStake, stake);
        assertEq(totalDeposits, 0);
        assertTrue(active);
        assertEq(paymentToken.balanceOf(address(vault)), stake);
    }

    function testShieldCapital() public {
        uint256 stake = 100 ether;
        uint256 deposit = 50 ether;

        vm.prank(curator);
        paymentToken.approve(address(vault), stake);
        vm.prank(curator);
        vault.createStrategy("Test", stake);

        vm.prank(user);
        paymentToken.approve(address(vault), deposit);
        vm.prank(user);
        vault.shieldCapital(1, deposit);

        assertEq(vault.balanceOf(1, user), deposit);
        assertEq(paymentToken.balanceOf(address(vault)), stake + deposit);

        (,,, uint256 totalDeposits,) = vault.strategies(1);
        assertEq(totalDeposits, deposit);
    }

    function testRedeemPartial() public {
        uint256 deposit = 50 ether;

        _createStrategyAndDeposit(deposit);

        uint256 userBefore = paymentToken.balanceOf(user);

        vm.prank(user);
        vault.redeem(1, 20 ether);

        assertEq(vault.balanceOf(1, user), 30 ether);
        assertEq(paymentToken.balanceOf(user), userBefore + 20 ether);
    }

    function testRedeemFullWhenAmountZero() public {
        uint256 deposit = 50 ether;

        _createStrategyAndDeposit(deposit);

        uint256 userBefore = paymentToken.balanceOf(user);

        vm.prank(user);
        vault.redeem(1, 0);

        assertEq(vault.balanceOf(1, user), 0);
        assertEq(paymentToken.balanceOf(user), userBefore + deposit);
    }

    function testRedeemMoreThanDepositReverts() public {
        _createStrategyAndDeposit(50 ether);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(StrategyVault.InsufficientDeposit.selector, 60 ether, 50 ether));
        vault.redeem(1, 60 ether);
    }

    function testNonOperatorCannotAllocate() public {
        _createStrategyAndDeposit(50 ether);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(StrategyVault.UnauthorizedOperator.selector, stranger));
        vault.allocate(1, address(router), address(targetToken), 10 ether, 9 ether, block.timestamp + 1 hours);
    }

    function testAllocateSlippageAndDeadlineProtection() public {
        _createStrategyAndDeposit(100 ether);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(StrategyVault.DeadlineExpired.selector, block.timestamp - 1));
        vault.allocate(1, address(router), address(targetToken), 10 ether, 9 ether, block.timestamp - 1);
    }

    function testAllocateSuccess() public {
        _createStrategyAndDeposit(100 ether);

        vm.prank(operator);
        vault.allocate(1, address(router), address(targetToken), 10 ether, 9 ether, block.timestamp + 1 hours);

        assertEq(targetToken.balanceOf(address(vault)), 10 ether);
        // Vault started with 100 ether stake + 100 ether deposit, then swapped out 10 ether.
        assertEq(paymentToken.balanceOf(address(vault)), 190 ether);
    }

    function testRecoverERC20() public {
        _createStrategyAndDeposit(100 ether);

        vm.prank(operator);
        vault.allocate(1, address(router), address(targetToken), 10 ether, 9 ether, block.timestamp + 1 hours);

        uint256 ownerBefore = targetToken.balanceOf(owner);

        vm.prank(owner);
        vault.recoverERC20(address(targetToken), 10 ether);

        assertEq(targetToken.balanceOf(owner), ownerBefore + 10 ether);
    }

    function testOwnerCanSetOperator() public {
        vm.prank(owner);
        vault.setOperator(stranger, true);
        assertTrue(vault.operators(stranger));
    }

    function testNonOwnerCannotSetOperator() public {
        vm.prank(stranger);
        vm.expectRevert();
        vault.setOperator(stranger, true);
    }

    function _createStrategyAndDeposit(uint256 deposit) internal {
        uint256 stake = 100 ether;

        vm.prank(curator);
        paymentToken.approve(address(vault), stake);
        vm.prank(curator);
        vault.createStrategy("Test", stake);

        vm.prank(user);
        paymentToken.approve(address(vault), deposit);
        vm.prank(user);
        vault.shieldCapital(1, deposit);
    }
}
