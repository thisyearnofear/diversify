# GoodDollar $G Streak Rewards Integration

## Overview

A gamified savings streak system that unlocks access to GoodDollar's free daily UBI ($G tokens) for users who maintain consistent saving habits through DiversiFi.

**Key Point: NO SMART CONTRACT NEEDED** - This is a simple UI gating mechanism. Users claim their $G directly on GoodDollar's site.

## How It Works

```
User saves $10+ → Streak recorded in localStorage → Claim button unlocked
                                    ↓
User clicks "Claim $G" → Opens GoodDollar wallet → User claims their UBI
```

1. **Track Saves**: We track when users swap/save $10+ through DiversiFi
2. **Build Streak**: Consecutive daily activity builds their streak (1 grace miss/week allowed)
3. **Unlock Claim**: Active streak unlocks the GoodDollar claim link
4. **User Claims**: User claims $G directly on GoodDollar's wallet site

## Implementation

### No Smart Contract Required

Unlike the initial design, **we don't need a smart contract**. GoodDollar is a UBI system where:
- Users claim their OWN daily allocation
- Claims happen on GoodDollar's interface
- We simply gate access to the claim link behind our streak system

### Data Storage

Streak data is stored in `localStorage` per wallet address:

```typescript
interface StreakData {
  startTime: number;        // When streak started
  lastActivity: number;     // Last save timestamp
  daysActive: number;       // Current streak length
  gracePeriodsUsed: number; // Misses forgiven this week
  totalSaved: number;       // Total $ saved during streak
}
```

Key: `diversifi_streak_v1_{walletAddress}`

### Streak Rules

- **Minimum Save**: $10 USD per day to count
- **Consecutive Days**: Must save within 24h of last activity
- **Grace Period**: 1 missed day allowed per week (resets Sunday)
- **Break Streak**: Miss 2+ days (or use grace) → streak resets to 1

## Components

### 1. useStreakRewards Hook

Single source of truth for streak state.

```typescript
const {
  streak,           // Current streak data
  canClaim,         // Has streak and can claim $G
  isEligible,       // Has ever started a streak
  estimatedReward,  // "~$0.25" (varies by streak length)
  recordSave,       // Call when user saves $10+
  claimG,           // Opens GoodDollar wallet
} = useStreakRewards();
```

### 2. StreakRewardsCard

Main UI component showing streak status.

**States:**
- **Not Connected**: "Connect wallet to start earning"
- **No Streak**: "Save $10+ to unlock daily rewards"
- **Active Streak**: "🔥 5-Day Streak" with countdown to next claim
- **Claim Ready**: "💚 Claim Your $G" button (opens GoodDollar)

### 3. RewardsStats

Social proof component showing community activity:
- Claims today
- Total $G earned by DiversiFi users
- Active streaks

### 4. StreakBadge

Compact header badge for persistent visibility:
- Shows "🔥 5 day streak" or "💚 Claim $G"
- Animates when claim is available
- Click scrolls to rewards card

## Integration Points

### Swap Flow

Streak is automatically recorded when swap completes:

```typescript
// In useSwapController
useEffect(() => {
  if (swapStep === "completed") {
    const amountNum = parseFloat(amount);
    if (amountNum >= 10) {
      recordSave(amountNum); // Triggers streak update
    }
  }
}, [swapStep, amount]);
```

### Overview Tab

```tsx
<StreakRewardsCard onSaveClick={() => setActiveTab("swap")} />
<RewardsStats />
```

### Layout Header

```tsx
<StreakBadge /> // Persistent across all pages
```

## User Flow

### New User

1. Connects wallet
2. Sees "Unlock Daily Rewards" card
3. CTA: "Start Saving" → goes to Swap tab
4. Completes $10+ swap
5. Sees "🔥 1-Day Streak" 
6. Next day: "💚 Claim $G" button appears
7. Clicks claim → opens GoodDollar wallet
8. Claims their daily UBI on GoodDollar's site

### Returning User

1. Opens app
2. Header shows "🔥 5 day streak"
3. Overview shows "💚 Claim Your $G"
4. Clicks claim → GoodDollar wallet
5. Saves more to extend streak

## Configuration

```typescript
const STREAK_CONFIG = {
  MIN_SAVE_USD: 10,              // Minimum to count as "save"
  GRACE_PERIODS_PER_WEEK: 1,     // Allowed misses
  G_CLAIM_URL: 'https://wallet.gooddollar.org/?utm_source=diversifi',
  G_TOKEN_ADDRESS: '0x62B8B...', // Celo mainnet
};
```

## Future Enhancements

### Phase 1: Live (Current)
- ✅ LocalStorage streak tracking
- ✅ Claim link gating
- ✅ Social proof stats (mock data)

### Phase 2: Enhanced
- [ ] Backend API for cross-device sync
- [ ] Real claim statistics from subgraph
- [ ] Farcaster frame for social sharing
- [ ] Push notifications ("Don't break your streak!")

### Phase 3: Partnership
- [ ] Official GoodDollar partnership
- [ ] Boosted rewards for DiversiFi users
- [ ] In-app claim (iframe or SDK)
- [ ] G$ balance display

## Testing

### Reset Streak (Dev Only)

```typescript
const { resetStreak } = useStreakRewards();
resetStreak(); // Clears localStorage
```

### Simulate Streak

1. Make a $10+ swap
2. Check localStorage: `diversifi_streak_v1_{address}`
3. Manually edit `lastActivity` to yesterday's timestamp
4. Make another swap → streak should increment

## Key Metrics

Track these to measure success:

- **Streak Start Rate**: % of users who start a streak
- **Claim Rate**: % of eligible users who claim
- **Avg Streak Length**: How long users maintain streaks
- **Retention Correlation**: Do streak users have higher retention?

## References

- GoodDollar Token (Celo): `0x62B8B11039CBcfba9E2676772F2E96C64BCbc9d9`
- GoodDollar Wallet: https://wallet.gooddollar.org
- Docs: https://docs.gooddollar.org

## Why This Works

1. **Zero Cost**: We don't pay for rewards, GoodDollar does
2. **Simple**: No contracts, no complex integrations
3. **Engaging**: Streak mechanics drive daily active usage
4. **Aligned**: Both DiversiFi and GoodDollar focus on financial inclusion
5. **Viral**: Users talk about their streaks, creating organic growth
