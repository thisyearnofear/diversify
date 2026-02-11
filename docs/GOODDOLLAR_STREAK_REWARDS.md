# GoodDollar $G Streak Rewards Integration

## Overview

A gamified savings streak system that unlocks access to GoodDollar's free daily UBI ($G tokens) for users who maintain consistent saving habits through DiversiFi.

**Key Point: NO SMART CONTRACT NEEDED** - This is a simple UI gating mechanism. Users claim their $G directly on GoodDollar's site.

## How It Works

```
User saves $0.50+ → Streak recorded in localStorage → Claim button unlocked
                                    ↓
User clicks "Claim $G" → Opens GoodDollar wallet → User claims their UBI
```

1. **Track Saves**: We track when users swap/save $0.50+ through DiversiFi (accessible!)
2. **Build Streak**: Consecutive daily activity builds their streak (1 grace miss/week allowed)
3. **Unlock Claim**: Active streak unlocks the GoodDollar claim link
4. **User Claims**: User claims $G directly on GoodDollar's wallet site

## Accessibility First 🌍

**Why $0.50/day (or $5/week)?**
- **More accessible** for emerging markets (Africa, LatAm, Asia)
- **Lower barrier** to entry = more users engaged
- **Still meaningful** commitment (not trivial)
- **Aligns with micro-savings** behavior
- **~$15/month** = realistic for target users
- **Inclusive** - doesn't exclude low-income users

### Comparison
| Threshold | Daily | Weekly | Monthly | Accessibility |
|-----------|-------|--------|---------|---------------|
| $10/day   | $10   | $70    | $300    | ❌ Too high   |
| $5/day    | $5    | $35    | $150    | ⚠️ Still high |
| **$0.50/day** | **$0.50** | **$3.50** | **$15** | **✅ Accessible** |

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

- **Minimum Save**: $0.50 USD per day to count (accessible!)
- **Consecutive Days**: Must save within 24h of last activity
- **Grace Period**: 1 missed day allowed per week (resets Sunday)
- **Break Streak**: Miss 2+ days (or use grace) → streak resets to 1

## Configuration

```typescript
const STREAK_CONFIG = {
  MIN_SAVE_USD: 0.50,              // Accessible threshold
  GRACE_PERIODS_PER_WEEK: 1,       // Allowed misses
  G_CLAIM_URL: 'https://wallet.gooddollar.org/?utm_source=diversifi',
  G_TOKEN_ADDRESS: '0x62B8B11039CBcfba9E2676772F2E96C64BCbc9d9', // Celo
};
```

## User Flows

### New User (Emerging Market)

1. Connects wallet
2. Sees "Unlock Daily Rewards" card
3. Swaps $0.50 USDm → KESm (Kenya example)
4. Sees "🔥 1-Day Streak"
5. Next day: Swaps another $0.50
6. Sees "🔥 2-Day Streak"
7. Day 3: "💚 Claim $G" button appears
8. Claims free G$ on GoodDollar wallet
9. Continues saving to maintain streak

### Returning User (Building Habit)

1. Opens app, sees "🔥 7 day streak" in header
2. Overview shows "💚 Claim Your $G"
3. Clicks claim → GoodDollar wallet
4. Claims daily UBI
5. Swaps $0.50+ to extend streak
6. Builds long-term savings habit

### Power User (Maximizing)

1. Maintains 30+ day streak
2. Claims G$ daily
3. Swaps G$ → USDm or holds for appreciation
4. Stakes stablecoins on GoodDollar for GOOD tokens
5. Participates in GoodDAO governance

## Why This Works

### 1. Zero Cost to DiversiFi
- We don't pay for rewards, GoodDollar does
- No smart contracts to maintain
- No token economics to manage

### 2. Accessible & Inclusive
- $0.50/day = ~$15/month (realistic for target users)
- Doesn't exclude low-income users
- Aligns with micro-savings behavior
- Builds financial inclusion

### 3. Engaging Mechanics
- Streak system drives daily active usage
- Grace period prevents frustration
- Visual progress (🔥 emoji, day count)
- Social proof (community stats)

### 4. Mission Aligned
- Both DiversiFi and GoodDollar focus on financial inclusion
- Both target emerging markets
- Both promote savings behavior
- Both use Celo blockchain

### 5. Viral Potential
- Users talk about their streaks
- Social sharing opportunities
- Referral incentives possible
- Community building

## Key Metrics

Track these to measure success:

### Engagement
- **Streak Start Rate**: % of users who start a streak
- **Claim Rate**: % of eligible users who claim
- **Avg Streak Length**: How long users maintain streaks
- **Retention Correlation**: Do streak users have higher retention?

### Accessibility Impact
- **Geographic Distribution**: Where are streak users located?
- **Average Save Amount**: Is $0.50 threshold working?
- **Completion Rate**: % who reach 7-day streak
- **Drop-off Points**: When do users break streaks?

### Financial Inclusion
- **First-time Savers**: % of users who never saved before
- **Habit Formation**: % who continue after streak ends
- **Portfolio Growth**: Average portfolio value over time
- **G$ Utilization**: What do users do with claimed G$?

## Future Enhancements

### Phase 1: Live (Current) ✅
- ✅ LocalStorage streak tracking
- ✅ Claim link gating
- ✅ Accessible $0.50 threshold
- ✅ Social proof stats (mock data)

### Phase 2: Enhanced
- [ ] Backend API for cross-device sync
- [ ] Real claim statistics from subgraph
- [ ] Farcaster frame for social sharing
- [ ] Push notifications ("Don't break your streak!")
- [ ] Weekly summary emails

### Phase 3: Partnership
- [ ] Official GoodDollar partnership
- [ ] Boosted rewards for DiversiFi users
- [ ] In-app claim (iframe or SDK)
- [ ] G$ balance display
- [ ] Leaderboards & achievements

### Phase 4: Gamification
- [ ] Streak milestones (7, 30, 90, 365 days)
- [ ] Badges & achievements
- [ ] Referral bonuses
- [ ] Community challenges
- [ ] Seasonal events

## References

- GoodDollar Token (Celo): `0x62B8B11039CBcfba9E2676772F2E96C64BCbc9d9`
- GoodDollar Wallet: https://wallet.gooddollar.org
- Docs: https://docs.gooddollar.org
- Stake for UBI: https://gooddollar.org/stake

## Testing

### Reset Streak (Dev Only)

```typescript
const { resetStreak } = useStreakRewards();
resetStreak(); // Clears localStorage
```

### Simulate Streak

1. Make a $0.50+ swap
2. Check localStorage: `diversifi_streak_v1_{address}`
3. Manually edit `lastActivity` to yesterday's timestamp
4. Make another swap → streak should increment

### Test Accessibility

1. Try with $0.25 swap → should NOT count
2. Try with $0.50 swap → should count
3. Try with $5 swap → should count
4. Verify messaging shows "$0.50+" not "$10+"

## Conclusion

By lowering the threshold to **$0.50/day**, we make GoodDollar UBI rewards accessible to everyone, especially users in emerging markets where DiversiFi provides the most value. This aligns perfectly with both platforms' missions of financial inclusion and creates a sustainable path to building savings habits.

**Impact:** More users engaged → More streaks maintained → More G$ claimed → More savings built → Better financial outcomes for all.
