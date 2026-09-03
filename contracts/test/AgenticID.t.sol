// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../AgenticID.sol";

contract AgenticIDTest is Test {
    AgenticID public agenticId;

    address public owner = makeAddr("owner");
    address public user = makeAddr("user");
    address public stranger = makeAddr("stranger");

    string constant AGENT_URI = "0g://storage/0xb1a2.../agent.json";
    string constant ENCRYPTED_URI = "0g://storage/0xb1a2.../evidence.enc";

    event AgentMinted(uint256 indexed tokenId, address indexed to, string agentURI, string encryptedURI);
    event AgentUpdated(uint256 indexed tokenId, string agentURI, string encryptedURI, uint8 updateType);
    event AgentTransferred(uint256 indexed tokenId, address indexed from, address indexed to);

    function setUp() public {
        vm.startPrank(owner);
        agenticId = new AgenticID();
        vm.stopPrank();
    }

    function _mintToUser() public returns (uint256 tokenId) {
        vm.prank(owner);
        tokenId = agenticId.mint(user, AGENT_URI, ENCRYPTED_URI);
    }

    // ── Constructor ────────────────────────────────────────────────────

    function testConstructorSetsOwnerAndMetadata() public view {
        assertEq(agenticId.owner(), owner);
        assertEq(agenticId.name(), "DiversiFi Agentic ID");
        assertEq(agenticId.symbol(), "DFID");
        assertEq(agenticId.totalAgents(), 0);
    }

    // ── Mint ───────────────────────────────────────────────────────────

    function testOwnerMintsAgentIdToUser() public {
        vm.expectEmit(true, true, false, true);
        emit AgentMinted(1, user, AGENT_URI, ENCRYPTED_URI);

        uint256 tokenId = _mintToUser();

        assertEq(tokenId, 1);
        assertEq(agenticId.totalAgents(), 1);
        assertEq(agenticId.balanceOf(user), 1);
        assertEq(agenticId.ownerOf(tokenId), user);
        assertEq(agenticId.tokenOf(user), tokenId);
        assertEq(agenticId.tokenUri(tokenId), AGENT_URI);
        assertEq(agenticId.encryptedTokenUri(tokenId), ENCRYPTED_URI);
        // 721 metadata resolves to the same public pointer.
        assertEq(agenticId.tokenURI(tokenId), AGENT_URI);
        assertEq(agenticId.clonedFrom(tokenId), address(0));
    }

    function testMintIncrementsTokenIds() public {
        vm.startPrank(owner);
        agenticId.mint(user, AGENT_URI, ENCRYPTED_URI);
        agenticId.mint(stranger, AGENT_URI, ENCRYPTED_URI);
        vm.stopPrank();

        assertEq(agenticId.totalAgents(), 2);
        assertEq(agenticId.tokenOf(user), 1);
        assertEq(agenticId.tokenOf(stranger), 2);
    }

    function testNonOwnerCannotMint() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        agenticId.mint(user, AGENT_URI, ENCRYPTED_URI);
    }

    function testMintRevertsOnZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(AgenticID.ZeroAddress.selector);
        agenticId.mint(address(0), AGENT_URI, ENCRYPTED_URI);
    }

    function testMintRevertsOnEmptyAgentURI() public {
        vm.prank(owner);
        vm.expectRevert(AgenticID.EmptyAgentURI.selector);
        agenticId.mint(user, "", ENCRYPTED_URI);
    }

    function testMintRevertsIfUserAlreadyHasAgentId() public {
        _mintToUser();

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AgenticID.AlreadyHasAgentId.selector, user));
        agenticId.mint(user, AGENT_URI, ENCRYPTED_URI);
    }

    function testTokenOfReturnsZeroWhenNoAgent() public view {
        assertEq(agenticId.tokenOf(user), 0);
    }

    // ── Update ─────────────────────────────────────────────────────────

    function testTokenOwnerCanUpdateAgent() public {
        uint256 tokenId = _mintToUser();

        string memory newUri = "0g://storage/0xc3b4.../agent-v2.json";
        string memory newEncryptedUri = "0g://storage/0xc3b4.../evidence-v2.enc";

        vm.expectEmit(true, false, false, true);
        emit AgentUpdated(tokenId, newUri, newEncryptedUri, 0);

        vm.prank(user);
        agenticId.updateAgent(tokenId, newUri, newEncryptedUri);

        assertEq(agenticId.tokenUri(tokenId), newUri);
        assertEq(agenticId.encryptedTokenUri(tokenId), newEncryptedUri);
        assertEq(agenticId.tokenURI(tokenId), newUri);
    }

    function testContractOwnerCanUpdateAnyAgent() public {
        uint256 tokenId = _mintToUser();

        vm.prank(owner);
        agenticId.updateAgent(tokenId, "0g://storage/0xd5e6.../agent.json", ENCRYPTED_URI);

        assertEq(agenticId.tokenUri(tokenId), "0g://storage/0xd5e6.../agent.json");
    }

    function testStrangerCannotUpdateAgent() public {
        uint256 tokenId = _mintToUser();

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(AgenticID.NotTokenOwnerOrContractOwner.selector, stranger));
        agenticId.updateAgent(tokenId, AGENT_URI, ENCRYPTED_URI);
    }

    function testUpdateAgentRevertsOnUnknownToken() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AgenticID.InvalidAgentId.selector, 99));
        agenticId.updateAgent(99, AGENT_URI, ENCRYPTED_URI);
    }

    function testUpdateAgentRevertsOnEmptyAgentURI() public {
        uint256 tokenId = _mintToUser();

        vm.prank(user);
        vm.expectRevert(AgenticID.EmptyAgentURI.selector);
        agenticId.updateAgent(tokenId, "", ENCRYPTED_URI);
    }

    // ── Transfer ───────────────────────────────────────────────────────

    function testTransferMovesOwnershipAndEmits7857Event() public {
        uint256 tokenId = _mintToUser();

        vm.expectEmit(true, true, true, false);
        emit AgentTransferred(tokenId, user, stranger);

        vm.prank(user);
        agenticId.transferFrom(user, stranger, tokenId);

        assertEq(agenticId.ownerOf(tokenId), stranger);
        assertEq(agenticId.tokenOf(user), 0);
        assertEq(agenticId.tokenOf(stranger), tokenId);
        // URIs travel with the token — the evidence bundle is the agent.
        assertEq(agenticId.tokenUri(tokenId), AGENT_URI);
        assertEq(agenticId.encryptedTokenUri(tokenId), ENCRYPTED_URI);
    }

    function testTransferRevertsIfRecipientAlreadyHasAgentId() public {
        uint256 tokenIdUser = _mintToUser();

        vm.prank(owner);
        agenticId.mint(stranger, AGENT_URI, ENCRYPTED_URI);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(AgenticID.AlreadyHasAgentId.selector, stranger));
        agenticId.transferFrom(user, stranger, tokenIdUser);
    }

    function testMintDoesNotEmitAgentTransferred() public {
        // from == address(0) on mint: only AgentMinted should fire.
        vm.recordLogs();
        _mintToUser();
        Vm.Log[] memory logs = vm.getRecordedLogs();

        for (uint256 i = 0; i < logs.length; i++) {
            assertTrue(
                logs[i].emitter != address(agenticId)
                    || logs[i].topics[0] != AgenticID.AgentTransferred.selector,
                "AgentTransferred must not fire on mint"
            );
        }
    }

    // ── Views ──────────────────────────────────────────────────────────

    function testTokenUriRevertsOnUnknownToken() public {
        vm.expectRevert(abi.encodeWithSelector(AgenticID.InvalidAgentId.selector, 42));
        this.tokenUriExternal(42);
    }

    function tokenUriExternal(uint256 tokenId) external view {
        agenticId.tokenUri(tokenId);
    }

    function testEncryptedTokenUriRevertsOnUnknownToken() public {
        vm.expectRevert(abi.encodeWithSelector(AgenticID.InvalidAgentId.selector, 42));
        this.encryptedTokenUriExternal(42);
    }

    function encryptedTokenUriExternal(uint256 tokenId) external view {
        agenticId.encryptedTokenUri(tokenId);
    }

    function testTokenURIRevertsForUnmintedToken() public {
        vm.expectRevert();
        this.tokenURIExternal(42);
    }

    function tokenURIExternal(uint256 tokenId) external view {
        agenticId.tokenURI(tokenId);
    }
}
