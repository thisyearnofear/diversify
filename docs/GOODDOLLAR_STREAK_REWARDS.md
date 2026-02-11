# GoodDollar $G Streak Rewards Integration

## Concept: "Save to Claim"

Users can claim their free daily $G allocation directly through DiversiFi, but only if they maintain an active savings streak. Creates engagement loop: save → claim → save again.

## Core Mechanics

### 1. Streak Requirements
```typescript
interface StreakRequirement {
  minSaveAmount: number;      // $10 USD minimum daily save
  tokenTypes: ['USDC', 'cUSD', 'cEUR'];  // Qualifying stablecoins
  holdDuration: number;       // 24 hours (must hold, not just swap)
  gracePeriods: number;       // 1 miss allowed per week
}
```

### 2. Claim Interface
```typescript
interface GClaimStatus {
  canClaim: boolean;
  reason: 'streak_active' | 'no_streak' | 'already_claimed_today';
  nextClaimTime: Date;
  estimatedReward: string;    // "~$0.25 worth of $G"
  streakDays: number;
  multiplier: number;         // 1x base, up to 3x for long streaks
}
```

### 3. Social Proof Features
- **Live Claim Counter**: "47 users claimed $G in the last hour"
- **Streak Leaderboard**: Top 10 savers by streak length
- **Friend Activity**: "3 friends claimed today" (if Farcaster connected)
- **Daily Stats**: Total $G claimed by DiversiFi users today

## Technical Implementation

### Smart Contract (Minimal)

Since $G claims happen on GoodDollar's contract, we only need:

```solidity
// StreakVerifier.sol - Tracks saving activity
contract StreakVerifier {
    struct Streak {
        uint256 startTime;
        uint256 lastActivity;
        uint16 daysActive;
        uint16 gracePeriodsUsed;
    }

    mapping(address => Streak) public streaks;
    mapping(address => uint256) public lastClaimDay;

    uint256 public constant MIN_SAVE_USD = 10e18;  // $10
    uint256 public constant HOLD_DURATION = 24 hours;
    uint8 public constant GRACE_PERIODS = 1;

    event ActivityRecorded(address user, uint256 amount, uint16 streakDays);
    event StreakBroken(address user, uint256 previousStreak);

    function recordSave(
        address user,
        uint256 amountUSD,
        uint256 timestamp
    ) external onlyDiversiFi {
        // Validate minimum
        require(amountUSD >= MIN_SAVE_USD, "Below minimum");

        Streak storage streak = streaks[user];
        uint256 dayNumber = timestamp / 1 days;
        uint256 lastDay = streak.lastActivity / 1 days;

        if (dayNumber == lastDay) {
            // Already active today, update amount
            return;
        } else if (dayNumber == lastDay + 1) {
            // Consecutive day - streak continues
            streak.daysActive++;
        } else if (dayNumber <= lastDay + 2 && streak.gracePeriodsUsed < GRACE_PERIODS) {
            // Used grace period
            streak.gracePeriodsUsed++;
            streak.daysActive++;
        } else {
            // Streak broken
            emit StreakBroken(user, streak.daysActive);
            streak.daysActive = 1;
            streak.gracePeriodsUsed = 0;
            streak.startTime = timestamp;
        }

        streak.lastActivity = timestamp;
        emit ActivityRecorded(user, amountUSD, streak.daysActive);
    }

    function canClaim(address user) external view returns (bool) {
        Streak memory streak = streaks[user];
        uint256 today = block.timestamp / 1 days;

        // Must have active streak (saved today or yesterday)
        uint256 lastDay = streak.lastActivity / 1 days;
        if (today > lastDay + 1) return false;

        // Must not have claimed today
        if (lastClaimDay[user] == today) return false;

        return true;
    }

    function recordClaim(address user) external {
        require(canClaim(user), "Cannot claim");
        lastClaimDay[user] = block.timestamp / 1 days;
    }
}
```

### Frontend Components

```typescript
// components/rewards/GClaimCard.tsx
export function GClaimCard() {
  const { streak, claimStatus } = useStreakRewards();
  const { claimG } = useGClaim();

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-100">
      <CardHeader>
        <div className="flex items-center gap-2">
          <GoodDollarLogo className="w-8 h-8" />
          <CardTitle>Daily $G Rewards</CardTitle>
        </div>
      </CardHeader>

      <CardContent>
        {/* Streak Status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="text-orange-500" />
            <span className="text-2xl font-bold">{streak.days} day streak</span>
          </div>
          <Badge variant={streak.isActive ? "default" : "secondary"}>
            {streak.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Claim Button */}
        <Button
          onClick={claimG}
          disabled={!claimStatus.canClaim}
          className="w-full"
        >
          {claimStatus.canClaim ? (
            <>Claim ~{claimStatus.estimatedReward} $G</>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" />
              Save ${MIN_SAVE} to unlock
            </>
          )}
        </Button>

        {/* Social Proof */}
        <div className="mt-4 text-sm text-muted-foreground">
          <p>🔥 {claimStats.todayClaims} users claimed today</p>
          <p>💰 {claimStats.totalClaimed} $G claimed by DiversiFi users</p>
        </div>

        {/* Next Claim Timer */}
        {!claimStatus.canClaim && claimStatus.nextClaimTime && (
          <p className="mt-2 text-xs text-center">
            Next claim available in <Countdown target={claimStatus.nextClaimTime} />
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### Claim Flow

```typescript
// hooks/use-g-claim.ts
export function useGClaim() {
  const { address } = useAccount();

  const claimG = async () => {
    // 1. Check eligibility via our contract
    const canClaim = await streakVerifier.canClaim(address);
    if (!canClaim) throw new Error("Save first to unlock claim");

    // 2. Record claim attempt (prevents double-claim)
    await streakVerifier.recordClaim(address);

    // 3. Open GoodDollar claim in new tab/wallet
    // User claims directly from GoodDollar's contract
    window.open(`https://wallet.gooddollar.org/?claim=true&referrer=diversifi`, '_blank');

    // 4. Poll for successful claim
    await pollForClaimSuccess(address);

    // 5. Show celebration + update stats
    toast.success("$G claimed successfully!");
  };

  return { claimG };
}
```

## Features Breakdown

### Phase 1: Basic Claim (MVP)
- [ ] Streak verification contract
- [ ] Claim card in UI
- [ ] Simple eligibility check
- [ ] Link to GoodDollar wallet

### Phase 2: Social Proof
- [ ] Live claim counter (Firebase/Supabase realtime)
- [ ] Streak leaderboard
- [ ] "Friends claimed" (Farcaster integration)
- [ ] Push notifications: "Don't break your streak! Claim $G now"

### Phase 3: Enhanced Rewards
- [ ] Multiplier for long streaks (via GoodDollar partnership)
- [ ] Streak recovery (spend $G to restore broken streak)
- [ ] Bonus rewards for referrals
- [ ] Exclusive strategies for 30+ day streakers

## Notification Strategy

```typescript
// notifications/g-rewards.ts
export const gRewardNotifications = {
  streakAtRisk: {
    title: "⚠️ Streak at Risk!",
    body: "Save $10 today to keep your {days}-day streak alive",
    timing: "20:00 local time",
  },
  claimAvailable: {
    title: "💰 Free $G Available!",
    body: "{count} users already claimed today. Don't miss out!",
    timing: "09:00 local time",
  },
  streakMilestone: {
    title: "🔥 {days} Day Streak!",
    body: "You're in the top {percentile}% of savers. Keep going!",
    timing: "immediate",
  },
  fomoTrigger: {
    title: "Your friends are claiming",
    body: "{friendCount} friends claimed $G today. Save to join them!",
    timing: "14:00 local time",
  },
};
```

## Revenue/Retention Impact

**For Users:**
- Free daily rewards ($0.10-$0.50 worth)
- Gamified saving experience
- Social validation from leaderboard

**For DiversiFi:**
- Daily active user (DAU) boost
- Higher retention via streak mechanics
- Differentiation from other DeFi apps
- Potential GoodDollar partnership/visibility

**Metrics to Track:**
- Claim rate (% of eligible who claim)
- Streak retention rate
- Avg streak length
- Correlation: streak length → TVL

## Integration Checklist

- [ ] Deploy `StreakVerifier` contract on Celo
- [ ] Integrate save tracking into swap flow
- [ ] Build claim card component
- [ ] Set up claim statistics tracking
- [ ] Configure notification system
- [ ] Test claim flow end-to-end
- [ ] Add to main dashboard
- [ ] Write "How to Claim" guide

## Open Questions

1. **Should we auto-claim for users?** (Requires holding their private keys - not recommended)
2. **What happens when streak breaks?** Reset to 0 or partial penalty?
3. **Should streaks be cross-chain?** (Save on Arbitrum = claim on Celo?)
4. **Partnership with GoodDollar?** Could get official support/marketing

## References

- GoodDollar Token (Celo): `0x62B8B11039CBcfba9E2676772F2E96C64BCbc9d9`
- GoodDollar Wallet: https://wallet.gooddollar.org
- Docs: https://docs.gooddollar.org
