# Architecture

DiversiFi is a curator-led strategy marketplace built for MiniPay, focused on protecting wealth from volatility using stablecoin-based baskets.

## Core Value Proposition

- **The Recovery Trap**: We educate users on the mathematical asymmetry of losses (e.g., a 50% drop requires a 100% gain to recover).
- **Anti-Volatility Engine**: Curators build and maintain stable-asset baskets ('Baskets') to shield users from market drawdowns.
- **Curator-led Marketplace**: Expert users curate, stake collateral on, and market their strategies to the DiversiFi community.

## Core Components

| Component | Responsibility |
|-----------|----------------|
| `StrategyVault.sol` | Celo Mainnet contract managing stakes, deposits, and 'Shield' actions. |
| `components/portfolio/ProtectionAnalysis.tsx` | Dashboard surface for the 'Recovery Trap' calculator and Strategy discovery. |
| `hooks/use-strategy-shield.ts` | Frontend hook managing on-chain deposits into curator vaults. |

## Contract Architecture (Celo Mainnet)

- **Curator Staking**: Curators must stake `cUSD` to ensure performance alignment.
- **Shielding**: Users deposit `cUSD` into a Curator's vault to participate in a basket.
- **Traceability**: Strategies are anchored to narratives, ensuring transparent auditability.

### Deployed Contracts (Celo Mainnet)

| Contract | Address |
|----------|---------|
| `StrategyVault` | [`0x8c4804fd65d722536fb0c4eb4632e030962293a7`](https://explorer.celo.org/address/0x8c4804fd65d722536fb0c4eb4632e030962293a7) |

## Development Status

- **Mainnet**: Deployed and active on Celo Mainnet.
- **Activity Tracking**: Real-time on-chain events (`ShieldApplied`, `CuratorStaked`) are indexed by Talent App for Proof of Ship leaderboard scoring.
