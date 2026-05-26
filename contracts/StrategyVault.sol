// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StrategyVault
 * @notice Allows Curators to create and stake on diversification baskets.
 * Users can 'Shield' their capital by depositing into these vaults.
 */
contract StrategyVault is Ownable, ReentrancyGuard {
    IERC20 public immutable cUSD;

    struct Strategy {
        address curator;
        string name;
        uint256 curatorStake;      // Collateral provided by curator
        uint256 totalDeposits;     // Total user assets in vault
        bool active;
    }

    mapping(uint256 => Strategy) public strategies;
    uint256 public strategyCount;

    event StrategyCreated(uint256 indexed id, address indexed curator, string name);
    event ShieldApplied(uint256 indexed strategyId, address indexed user, uint256 amount);
    event CuratorStaked(uint256 indexed strategyId, uint256 amount);

    constructor(address _cUSD, address _initialOwner) Ownable(_initialOwner) {
        cUSD = IERC20(_cUSD);
    }

    /**
     * @notice Curator creates a strategy and stakes cUSD as collateral.
     */
    function createStrategy(string memory _name, uint256 _stakeAmount) external nonReentrant {
        require(_stakeAmount > 0, "Stake required");
        require(cUSD.transferFrom(msg.sender, address(this), _stakeAmount), "Stake transfer failed");

        strategyCount++;
        strategies[strategyCount] = Strategy({
            curator: msg.sender,
            name: _name,
            curatorStake: _stakeAmount,
            totalDeposits: 0,
            active: true
        });

        emit StrategyCreated(strategyCount, msg.sender, _name);
        emit CuratorStaked(strategyCount, _stakeAmount);
    }

    /**
     * @notice User 'Shields' capital by depositing into a Curator's vault.
     */
    function shieldCapital(uint256 _strategyId, uint256 _amount) external nonReentrant {
        require(strategies[_strategyId].active, "Strategy inactive");
        require(cUSD.transferFrom(msg.sender, address(this), _amount), "Deposit failed");
        
        strategies[_strategyId].totalDeposits += _amount;

        emit ShieldApplied(_strategyId, msg.sender, _amount);
    }
}
