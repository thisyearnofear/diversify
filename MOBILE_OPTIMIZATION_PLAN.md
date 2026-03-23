# Mobile Optimization Plan — Week 1 Quick Wins

**Date**: 2026-03-23  
**Status**: Draft for Review

## Current State Analysis

### ✅ Already Implemented
- Safe-area padding utilities in `globals.css` (`pb-safe`, `pt-safe`, `px-safe`)
- "Beginner" mode simplifies UI for mobile/mini-app contexts
- Compact variants for `NetworkSwitcher`, `WalletButton`
- Disabled rubber-banding on pull-to-refresh
- Tap highlight color disabled

### ❌ Missing / Needs Work
- No persistent bottom CTA on mobile (Swap button scrolls out of view)
- No mobile detection hook (`useMediaQuery` / `useMobile`)
- Secondary cards always visible (clutter on small screens)
- Tap targets may be below 44px threshold
- No collapsible accordions for non-essential content

---

## Implementation Plan — Week 1

### Task 1: Mobile Detection Hook
**File**: `hooks/use-mobile.ts`

Create a reusable hook for mobile detection:
```ts
// Returns true for screens < 768px
const isMobile = useMobile();

// Also expose more granular info
const { isMobile, isTablet, isDesktop, width } useViewport();
```

**Effort**: ~15 min

---

### Task 2: Sticky Bottom CTA for Mobile
**Files**: 
- `components/swap/SwapActionButton.tsx` — add sticky mode
- `components/tabs/SwapTab.tsx` — use sticky CTA on mobile

**Changes**:
1. Add `sticky` prop to `SwapActionButton`
2. When `sticky=true` on mobile:
   - Fixed position at bottom of viewport
   - `bottom: env(safe-area-inset-bottom)` for iOS notch
   - High z-index to stay above content
   - Add shadow for elevation
3. In `SwapTab`, conditionally render:
   - Inline button (desktop) — current behavior
   - Sticky button (mobile) — always visible

**Effort**: ~30 min

---

### Task 3: Collapsible Secondary Cards
**Files**:
- `components/rewards/StreakRewardsCard.tsx`
- `components/swap/SwapInsightsPanel.tsx`
- `components/swap/YieldBridgePrompt.tsx`

**Changes**:
1. Wrap each in an accordion on mobile
2. Default collapsed on mobile, expanded on desktop
3. Use `details`/`summary` for native browser support (no JS overhead)
4. Add chevron indicator

**Effort**: ~45 min

---

### Task 4: Minimum 44px Tap Targets
**Files**: Audit all interactive elements

**Quick fixes**:
1. Add `min-h-11` (44px) to all buttons on mobile
2. Add padding to increase hit area without visual bloat
3. Audit: `NetworkSwitcher`, `TokenSelector`, `WalletButton`, `SwapActionButton`

**Effort**: ~20 min

---

### Task 5: Safe-Area Padding for Fixed Elements
**Files**: `globals.css` + components with fixed positioning

**Changes**:
1. Add utility classes for fixed bottom elements:
   ```css
   .fixed-bottom-safe {
     position: fixed;
     bottom: 0;
     left: 0;
     right: 0;
     padding-bottom: env(safe-area-inset-bottom);
   }
   ```
2. Apply to sticky CTA and any modals/bottom sheets

**Effort**: ~15 min

---

### Task 6: Mobile Guardian Status Simplification
**File**: `components/agent/GuardianWDKStatus.tsx`

**Changes**:
1. On mobile, show compact summary only
2. "Active limits" summary card
3. Tap to expand full details
4. Timeline cards for receipts

**Effort**: ~30 min

---

## Priority Order

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 🔴 P0 | Sticky Bottom CTA | High | 30 min |
| 🔴 P0 | Mobile Detection Hook | High | 15 min |
| 🟡 P1 | 44px Tap Targets | Medium | 20 min |
| 🟡 P1 | Safe-Area Padding | Medium | 15 min |
| 🟢 P2 | Collapsible Cards | Medium | 45 min |
| 🟢 P2 | Guardian Mobile Simplification | Medium | 30 min |

**Total estimated time**: ~2.5 hours

---

## Next Steps

1. Confirm this plan with user
2. Create feature branch: `feat/mobile-optimization-week1`
3. Implement in priority order
4. Test on mobile viewport (Chrome DevTools)
5. Create PR with before/after screenshots

---

## KPIs to Track (Post-Implementation)

- Connect wallet → first quote completion rate
- First quote → swap submitted conversion
- Median time to complete swap on mobile
- Drop-off in Guardian setup funnel
