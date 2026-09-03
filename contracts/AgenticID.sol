// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title AgenticID
 * @notice Minimal ERC-721 Guardian identity with ERC-7857-inspired pointer
 * semantics — NOT a complete ERC-7857 implementation (no sealed keys,
 * iTransfer/iClone, authorization, or proof-backed metadata transfer). The
 * on-chain identity of a DiversiFi Guardian agent, with its intelligence
 * 0G Storage. The token is a transferable pointer, not the agent itself —
 * the Guardian is an off-chain service; the URIs point at the evidence
 * bundle anchored by `RecommendationLedger`.
 *
 * Implemented 7857 surface (the subset the product needs):
 *   - `mint(to, agentURI, encryptedURI)` — owner-only; the backend service
 *     mints one Guardian ID per user
 *   - `tokenUri(tokenId)` — 7857 API-metadata pointer (public agent doc)
 *   - `encryptedTokenUri(tokenId)` — encrypted evidence bundle pointer
 *   - `updateAgent(tokenId, agentURI, encryptedURI)` — re-point as the
 *     evidence bundle grows (token owner or contract owner)
 *   - standard 721 transfers — the ID is transferable (AgentTransferred)
 *
 * Deliberately NOT implemented: on-chain AI, trust-processor attachments,
 * cloning. The spec evolves fast (see the Wave 3 risk register) — keep
 * this minimal and easy to redeploy.
 */
contract AgenticID is ERC721, Ownable2Step {
    // ====================================================================
    // EVENTS
    // ====================================================================

    event AgentMinted(uint256 indexed tokenId, address indexed to, string agentURI);
    event AgentUpdated(uint256 indexed tokenId, string agentURI, uint8 updateType);
    event AgentTransferred(uint256 indexed tokenId, address indexed from, address indexed to);

    // ====================================================================
    // ERRORS
    // ====================================================================

    error ZeroAddress();
    error EmptyAgentURI();
    error NotTokenOwnerOrContractOwner(address caller);
    error InvalidAgentId(uint256 tokenId);

    // ====================================================================
    // STATE
    // ====================================================================

    /// @notice Incremental agent token ID (first agent is #1).
    uint256 public totalAgents;

    /// @notice 7857 API-metadata pointer per agent (public agent doc).
    mapping(uint256 => string) public agentURIs;

    /// @notice Encrypted payload pointer per agent (0G Storage evidence bundle).
    mapping(uint256 => string) public encryptedURIs;

    /// @notice Original agent this was cloned from (address(0) = original).
    mapping(uint256 => address) public clonedFrom;

    /// @notice 7857 update type for a full-pointer refresh.
    uint8 private constant UPDATE_TYPE_FULL = 0;

    // ====================================================================
    // CONSTRUCTOR
    // ====================================================================

    constructor() ERC721("DiversiFi Agentic ID", "DFID") Ownable(msg.sender) {}

    // ====================================================================
    // CORE FUNCTIONS
    // ====================================================================

    /**
     * @notice Mint a Guardian Agentic ID for a user (backend service only).
     * @param to The user who owns this Guardian
     * @param agentURI 0G Storage pointer to the public agent metadata
     * @param encryptedURI 0G Storage pointer to the encrypted evidence bundle
     */
    function mint(address to, string calldata agentURI, string calldata encryptedURI)
        external
        onlyOwner
        returns (uint256)
    {
        if (to == address(0)) revert ZeroAddress();
        if (bytes(agentURI).length == 0) revert EmptyAgentURI();

        uint256 tokenId = ++totalAgents;
        _safeMint(to, tokenId);
        agentURIs[tokenId] = agentURI;
        encryptedURIs[tokenId] = encryptedURI;
        clonedFrom[tokenId] = address(0);

        emit AgentMinted(tokenId, to, agentURI);
        return tokenId;
    }

    /**
     * @notice Re-point an agent's URIs after its evidence bundle grew.
     * The Guardian service may update any agent; the token owner may
     * update their own (7857 leaves authorization to implementations).
     */
    function updateAgent(uint256 tokenId, string calldata agentURI, string calldata encryptedURI)
        external
    {
        if (tokenId == 0 || tokenId > totalAgents) revert InvalidAgentId(tokenId);
        if (msg.sender != ownerOf(tokenId) && msg.sender != owner()) {
            revert NotTokenOwnerOrContractOwner(msg.sender);
        }
        if (bytes(agentURI).length == 0) revert EmptyAgentURI();

        agentURIs[tokenId] = agentURI;
        encryptedURIs[tokenId] = encryptedURI;

        emit AgentUpdated(tokenId, agentURI, UPDATE_TYPE_FULL);
    }

    /**
     * @notice 7857 API-metadata URI (spelled per the spec, no dash).
     */
    function tokenUri(uint256 tokenId) external view returns (string memory) {
        if (tokenId == 0 || tokenId > totalAgents) revert InvalidAgentId(tokenId);
        return agentURIs[tokenId];
    }

    /**
     * @notice 7857 encrypted-payload URI.
     */
    function encryptedTokenUri(uint256 tokenId) external view returns (string memory) {
        if (tokenId == 0 || tokenId > totalAgents) revert InvalidAgentId(tokenId);
        return encryptedURIs[tokenId];
    }

    /// @notice Standard 721 metadata resolves to the same public pointer.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return agentURIs[tokenId];
    }

    // ====================================================================
    // INTERNAL OVERRIDES
    // ====================================================================

    /**
     * @dev Emit the 7857 transfer event alongside the 721 Transfer. Mints
     * (from = 0) are covered by AgentMinted and don't re-emit.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = super._update(to, tokenId, auth);
        if (from != address(0) && to != from) {
            emit AgentTransferred(tokenId, from, to);
        }
        return from;
    }
}
