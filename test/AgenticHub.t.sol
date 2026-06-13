// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/AgenticHub.sol";
import "./mocks/MockERC20.sol";

contract AgenticHubTest is Test {
    AgenticHub public hub;
    MockERC20 public paymentToken;

    address public owner = makeAddr("owner");
    address public user = makeAddr("user");
    address public stranger = makeAddr("stranger");

    function setUp() public {
        vm.startPrank(owner);
        paymentToken = new MockERC20("Test USD", "tUSD", 18);
        hub = new AgenticHub(address(paymentToken), owner);
        vm.stopPrank();

        paymentToken.mint(user, 100 ether);
    }

    function testConstructorSetsTokenAndOwner() public view {
        assertEq(address(hub.paymentToken()), address(paymentToken));
        assertEq(hub.owner(), owner);
        assertEq(hub.insightPrice(), 0.01 ether);
    }

    function testPurchaseInsightTransfersTokens() public {
        uint256 price = hub.insightPrice();

        vm.prank(user);
        paymentToken.approve(address(hub), price);

        vm.prank(user);
        hub.purchaseInsight();

        assertEq(paymentToken.balanceOf(user), 100 ether - price);
        assertEq(paymentToken.balanceOf(address(hub)), price);
    }

    function testOwnerCanSetInsightPrice() public {
        vm.prank(owner);
        hub.setInsightPrice(0.05 ether);
        assertEq(hub.insightPrice(), 0.05 ether);
    }

    function testNonOwnerCannotSetInsightPrice() public {
        vm.prank(stranger);
        vm.expectRevert();
        hub.setInsightPrice(0.05 ether);
    }

    function testOwnerCanWithdraw() public {
        uint256 price = hub.insightPrice();

        vm.prank(user);
        paymentToken.approve(address(hub), price);

        vm.prank(user);
        hub.purchaseInsight();

        uint256 ownerBefore = paymentToken.balanceOf(owner);

        vm.prank(owner);
        hub.withdraw();

        assertEq(paymentToken.balanceOf(owner), ownerBefore + price);
        assertEq(paymentToken.balanceOf(address(hub)), 0);
    }

    function testWithdrawWithZeroBalanceReverts() public {
        vm.prank(owner);
        vm.expectRevert(AgenticHub.NoFundsToWithdraw.selector);
        hub.withdraw();
    }

    function testNonOwnerCannotWithdraw() public {
        vm.prank(stranger);
        vm.expectRevert();
        hub.withdraw();
    }

    function testZeroAddressConstructorReverts() public {
        // OpenZeppelin Ownable catches address(0) owner before our check.
        vm.expectRevert();
        new AgenticHub(address(0), owner);

        vm.expectRevert();
        new AgenticHub(address(paymentToken), address(0));
    }
}
