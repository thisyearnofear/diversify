// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "./DiversiFiVault.sol";

/**
 * @title DiversiFiVaultFactory
 * @notice Deploys isolated ERC-4626 vault instances per user.
 *
 * @dev Why a factory instead of a shared pool:
 *   - Each user's funds, strategy, and allocations are fully isolated
 *   - No strategy conflicts (User A's Africa preference doesn't affect User B's LatAm preference)
 *   - Fair fee accounting (each vault tracks its own AUM, fees, high-water mark)
 *   - The agent manages each vault independently with per-vault REBALANCER_ROLE
 *
 * @dev Architecture:
 *   - Factory has ADMIN_ROLE (sets rebalancer, manages parameters)
 *   - Each deployed vault: user is depositor, agent is rebalancer, factory admin is vault admin
 *   - User can only have one active vault (tracked by ownerOf mapping)
 *   - Vaults are deployed via CREATE2 (deterministic addresses)
 */
contract DiversiFiVaultFactory is AccessControl {

    // ─── State ──────────────────────────────────────────────────────────────

    /// @notice The base asset for all vaults (e.g. cUSD on Celo)
    address public immutable baseAsset;

    /// @notice The rebalancer role holder for all deployed vaults (the agent)
    address public rebalancer;

    /// @notice The protocol fee recipient for all vaults
    address public feeRecipient;

    /// @notice Daily swap limit for new vaults (in base asset units)
    uint256 public defaultDailySwapLimit;

    /// @notice Vault contract address for a given user
    mapping(address => address) public ownerToVault;

    /// @notice Whether a deployed vault is active
    mapping(address => bool) public isActiveVault;

    /// @notice Total vaults deployed
    uint256 public vaultCount;

    /// @notice All deployed vault addresses (indexed)
    address[] public allVaults;

    // ─── Events ─────────────────────────────────────────────────────────────
    event VaultCreated(
        address indexed owner,
        address indexed vault,
        string strategy,
        uint256 vaultIndex
    );

    event RebalancerUpdated(address oldRebalancer, address newRebalancer);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event DefaultDailyLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event VaultDeactivated(address indexed owner, address indexed vault);

    // ─── Errors ─────────────────────────────────────────────────────────────
    error VaultAlreadyExists(address owner, address existingVault);
    error VaultNotFound(address owner);
    error InvalidRebalancer();
    error InvalidFeeRecipient();
    error EmptyStrategy();

    // ─── Constructor ────────────────────────────────────────────────────────
    constructor(
        address _baseAsset,
        address _admin,
        address _rebalancer,
        address _feeRecipient,
        uint256 _defaultDailySwapLimit
    ) {
        baseAsset = _baseAsset;
        rebalancer = _rebalancer;
        feeRecipient = _feeRecipient;
        defaultDailySwapLimit = _defaultDailySwapLimit;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    // ─── Core ───────────────────────────────────────────────────────────────

    /**
     * @notice Create an isolated vault for a user.
     * @dev Each user can only have one active vault. Call deactivateVault() first to create a new one.
     *
     * @param owner The user who will own this vault (receives shares on deposit)
     * @param strategy The investment strategy identifier (e.g. "africapitalism", "islamic", "global")
     * @param name Vault share token name (e.g. "DiversiFi - Africapitalism")
     * @param symbol Vault share token symbol (e.g. "dV-AFRI")
     * @return vault The deployed vault address
     */
    function createVault(
        address owner,
        string calldata strategy,
        string calldata name,
        string calldata symbol
    ) external onlyRole(DEFAULT_ADMIN_ROLE) returns (address vault) {
        if (ownerToVault[owner] != address(0) && isActiveVault[ownerToVault[owner]]) {
            revert VaultAlreadyExists(owner, ownerToVault[owner]);
        }
        if (bytes(strategy).length == 0) revert EmptyStrategy();

        // Deploy new vault via CREATE2
        // Salt includes vaultCount to ensure unique addresses even for re-created vaults
        vault = address(new DiversiFiVault{salt: keccak256(abi.encodePacked(owner, vaultCount))}(
            baseAsset,
            name,
            symbol,
            address(this), // Factory is vault admin (manages allowlist, pause, fees)
            rebalancer,
            feeRecipient,
            defaultDailySwapLimit
        ));

        // Grant admin role on the vault to the factory's admin so they can manage it directly
        DiversiFiVault(vault).grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        ownerToVault[owner] = vault;
        isActiveVault[vault] = true;
        allVaults.push(vault);
        vaultCount++;

        emit VaultCreated(owner, vault, strategy, vaultCount - 1);
    }

    /**
     * @notice Deactivate a vault (user withdraws, closes their account).
     * @dev Does not destroy the contract — funds must be withdrawn first.
     *      Owner can create a new vault after deactivation.
     */
    function deactivateVault(address owner) external {
        address vault = ownerToVault[owner];
        if (vault == address(0) || !isActiveVault[vault]) {
            revert VaultNotFound(owner);
        }

        isActiveVault[vault] = false;
        emit VaultDeactivated(owner, vault);
    }

    // ─── Admin Operations (propagated to all vaults) ────────────────────────

    /**
     * @notice Update the rebalancer for all vaults.
     */
    function setRebalancer(address newRebalancer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRebalancer == address(0)) revert InvalidRebalancer();
        address old = rebalancer;
        rebalancer = newRebalancer;
        emit RebalancerUpdated(old, newRebalancer);
    }

    /**
     * @notice Update fee recipient for all vaults.
     */
    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRecipient == address(0)) revert InvalidFeeRecipient();
        address old = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(old, newRecipient);
    }

    /**
     * @notice Update default daily swap limit for new vaults.
     */
    function setDefaultDailySwapLimit(uint256 newLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 old = defaultDailySwapLimit;
        defaultDailySwapLimit = newLimit;
        emit DefaultDailyLimitUpdated(old, newLimit);
    }

    /**
     * @notice Allowlist a token on a specific user's vault.
     */
    function setTokenAllowlistForVault(address owner, address token, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        address vault = ownerToVault[owner];
        if (vault == address(0)) revert VaultNotFound(owner);
        DiversiFiVault(vault).setTokenAllowlist(token, allowed);
    }

    /**
     * @notice Allowlist a router on a specific user's vault.
     */
    function setRouterAllowlistForVault(address owner, address router, bool allowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        address vault = ownerToVault[owner];
        if (vault == address(0)) revert VaultNotFound(owner);
        DiversiFiVault(vault).setRouterAllowlist(router, allowed);
    }

    // ─── View ───────────────────────────────────────────────────────────────

    /**
     * @notice Get the vault address for a user.
     */
    function getVault(address owner) external view returns (address) {
        return ownerToVault[owner];
    }

    /**
     * @notice Check if a user has an active vault.
     */
    function hasActiveVault(address owner) external view returns (bool) {
        address vault = ownerToVault[owner];
        return vault != address(0) && isActiveVault[vault];
    }

    /**
     * @notice Get all deployed vaults.
     */
    function getAllVaults() external view returns (address[] memory) {
        return allVaults;
    }
}
