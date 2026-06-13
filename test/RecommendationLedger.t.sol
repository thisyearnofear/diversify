// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/RecommendationLedger.sol";

contract RecommendationLedgerTest is Test {
    RecommendationLedger public ledger;

    address public owner = makeAddr("owner");
    address public agent = makeAddr("agent");
    address public user = makeAddr("user");
    address public stranger = makeAddr("stranger");

    function setUp() public {
        vm.prank(owner);
        ledger = new RecommendationLedger();
    }

    function testOwnerIsAuthorized() public view {
        assertTrue(ledger.authorizedAgents(owner));
    }

    function testOwnerCanAuthorizeAgent() public {
        vm.prank(owner);
        ledger.setAgentAuthorization(agent, true);
        assertTrue(ledger.authorizedAgents(agent));
    }

    function testNonOwnerCannotAuthorizeAgent() public {
        vm.prank(stranger);
        vm.expectRevert();
        ledger.setAgentAuthorization(agent, true);
    }

    function testAgentCanRecordRecommendation() public {
        vm.prank(owner);
        ledger.setAgentAuthorization(agent, true);

        vm.prank(agent);
        uint256 id = ledger.recordRecommendation(
            user, "SWAP", "USDY", keccak256("reasoning"), "QmEvidence", "deepseek-v4-pro", "0xSettlement", 8500
        );

        assertEq(id, 1);
        assertEq(ledger.totalRecommendations(), 1);

        RecommendationLedger.Recommendation memory rec = ledger.getRecommendation(id);
        assertEq(rec.user, user);
        assertEq(rec.action, "SWAP");
        assertEq(rec.targetToken, "USDY");
        assertEq(rec.reasoningHash, keccak256("reasoning"));
        assertEq(rec.evidenceCid, "QmEvidence");
        assertEq(rec.servingModel, "deepseek-v4-pro");
        assertEq(rec.confidence, 8500);
    }

    function testUserCanRecordForThemselves() public {
        vm.prank(user);
        uint256 id =
            ledger.recordRecommendation(user, "HOLD", "", keccak256("hold reasoning"), "QmHold", "venice", "", 5000);

        assertEq(id, 1);
    }

    function testStrangerCannotRecordForUser() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(RecommendationLedger.UnauthorizedRecorder.selector, stranger));
        ledger.recordRecommendation(user, "SWAP", "USDY", keccak256("x"), "", "", "", 1000);
    }

    function testCannotRecordWithZeroAddressUser() public {
        vm.prank(owner);
        vm.expectRevert(RecommendationLedger.ZeroAddress.selector);
        ledger.recordRecommendation(address(0), "SWAP", "USDY", keccak256("x"), "", "", "", 1000);
    }

    function testCannotRecordWithEmptyAction() public {
        vm.prank(owner);
        vm.expectRevert(RecommendationLedger.EmptyAction.selector);
        ledger.recordRecommendation(user, "", "USDY", keccak256("x"), "", "", "", 1000);
    }

    function testCannotRecordWithConfidenceAbove10000() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(RecommendationLedger.ConfidenceTooHigh.selector, 10001));
        ledger.recordRecommendation(user, "SWAP", "USDY", keccak256("x"), "", "", "", 10001);
    }

    function testGetUserRecommendationsPagination() public {
        vm.startPrank(owner);
        for (uint256 i = 0; i < 5; i++) {
            ledger.recordRecommendation(user, "SWAP", "USDY", keccak256(abi.encode(i)), "Qm", "model", "", 8000);
        }
        vm.stopPrank();

        (RecommendationLedger.Recommendation[] memory results, uint256 total) =
            ledger.getUserRecommendations(user, 1, 2);

        assertEq(total, 5);
        assertEq(results.length, 2);
        assertEq(results[0].reasoningHash, keccak256(abi.encode(1)));
        assertEq(results[1].reasoningHash, keccak256(abi.encode(2)));
    }

    function testTwoStepOwnershipTransfer() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        ledger.transferOwnership(newOwner);

        assertEq(ledger.pendingOwner(), newOwner);
        assertEq(ledger.owner(), owner);

        vm.prank(newOwner);
        ledger.acceptOwnership();

        assertEq(ledger.owner(), newOwner);
        assertEq(ledger.pendingOwner(), address(0));
    }
}
