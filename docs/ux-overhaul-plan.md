# DiversiFi UX Overhaul — Implementation Plan

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task, phase by phase.

**Goal:** Fix the 4 weakest UX issues in one focused pass — giving users a clear primary action on landing, fixing the broken "Protect" tab label, persisting onboarding state so it doesn't re-appear every visit, and splitting the monolithic index.tsx.

**Critical path:** Phase 1 → Phase 2A → Phase 2B → Phase 2C → verify. Everything else is additive.

**Architecture:** This plan touches the landing/onboarding overlay, the tab navigation system, the experience mode persistence, and the page-level orchestrator. All phases produce independently verifiable output.

**Tech Stack:** Next.js (pages router), React 18, TypeScript, Framer Motion, Tailwind CSS, context-based state management.

---

## Phase 1: Quick Wins — Label Fixes, Persistence, Accessibility (3 tasks, ~30 min)

### Task 1.1: Fix tab labels in TabNavigation

**Objective:** Rename the nav labels so "Protect" actually opens the protection tab and "Exchange" opens the exchange tab. Currently the nav label "Protect" maps to tab ID "exchange" (swap interface), and nav label "Plan" maps to tab ID "protect" (protection features).

**Files:**
- Modify: `components/ui/TabNavigation.tsx` (lines 30-37 — exchange tab label, lines 48-55 — protect tab label)

**Step 1: Update the exchange tab label**

In `TabNavigation.tsx`, find the exchange tab item (currently labeled "Protect"):

```typescript
{
  id: "exchange",
  label: "Protect",    // ← change to "Exchange" or "Swap"
  icon: (...)
}
```

Change `label: "Protect"` to `label: "Exchange"`.

**Step 2: Update the protect tab label**

Find the protect tab item (currently labeled "Plan"):

```typescript
{
  id: "protect",
  label: "Plan",       // ← change to "Protect"
  icon: (...)
}
```

Change `label: "Plan"` to `label: "Protect"`.

**Step 3: Verify**

Run type check:
```bash
cd /Users/udingethe/Dev/diversifi
npx tsc --noEmit --skipLibCheck
```
Expected: 0 errors.

Run build:
```bash
pnpm build
```
Expected: Compilation succeeds, no warnings for missing exports.

### Task 1.2: Persist onboarding completion to localStorage

**Objective:** The StrategyModal (onboarding overlay with region selector) re-appears on every page load. Add a localStorage flag so it only shows once for returning users.

**Files:**
- Modify: `pages/index.tsx` (around line 167 — `useStrategyModal()` call)
- Modify or create: component that checks localStorage for onboarding state

**Step 1: Find the StrategyModal state control**

In `pages/index.tsx`, find the `useStrategyModal()` hook:

```typescript
const { isOpen: isStrategyModalOpen, closeModal: closeStrategyModal } = useStrategyModal();
```

**Step 2: Add onboarding persistence logic**

Create a new hook or extend the existing `useStrategyModal` to read/write a `onboardingCompleted` flag in localStorage.

If modifying `useStrategyModal`, add something like:

```typescript
useEffect(() => {
  const completed = localStorage.getItem('onboardingCompleted');
  if (completed === 'true') {
    closeModal(); // or don't open in the first place
  }
}, []);
```

**Step 3: Mark completed on modal close/dismiss**

When the user dismisses or completes the onboarding, set:

```typescript
localStorage.setItem('onboardingCompleted', 'true');
```

**Step 4: Verify**

- Clear localStorage (`localStorage.clear()` in browser console)
- Reload the page — modal should appear
- Dismiss the modal
- Reload again — modal should NOT appear
- Clear localStorage again — modal should re-appear

### Task 1.3: Remove user-scalable=no from viewport meta

**Objective:** The viewport meta tag disables pinch-zoom, which is an accessibility violation. Remove it.

**Files:**
- Modify: `pages/index.tsx` (line 218)

**Step 1: Find the viewport meta tag**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

**Step 2: Change to accessibility-friendly version**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

Remove `maximum-scale=1.0` and `user-scalable=no`.

**Step 3: Verify**

Open the app on mobile (or use Chrome DevTools device emulation). Pinch-zoom should now work.

---

## Phase 2A: Split Landing from App Layer (3 tasks, ~1.5h)

### Task 2A.1: Create LandingPage component

**Objective:** Extract the pre-authentication / onboarding landing UI into its own component. This is the "Your Personal Guardian" hero card + "Protect Your Savings" card + region selector overlay. Currently all of this renders inside index.tsx via conditional logic.

**Files:**
- Create: `components/landing/LandingPage.tsx`
- Modify: `pages/index.tsx` (reduce)

**Step 1: Identify what belongs in LandingPage**

The landing layer includes:
- "Your Personal Guardian" hero card (with "Let's Talk" button)
- Test Drive box (Arc/Celo faucet links)
- "Protect Your Savings" card (savings calculator, Connect Wallet button, Open Demo button)
- Region selector overlay (the StrategyModal integration)

Everything that renders ABOVE the tab-navigation area and is shown before the user enters the app.

**Step 2: Create LandingPage.tsx**

```tsx
// components/landing/LandingPage.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserRegion, type Region, REGIONS } from '@/hooks/use-user-region';
import { useMultichainBalances } from '@/hooks/use-multichain-balances';
import { useProtectionProfile } from '@/hooks/use-protection-profile';
import { useAdvisor } from '@/hooks/use-advisor';

interface LandingPageProps {
  onEnterApp: () => void;          // Called when user completes onboarding
  onConnectWallet: () => void;     // Called when user clicks Connect Wallet
  onOpenDemo: () => void;          // Called when user clicks Open Demo
  onOpenAdvisor: () => void;       // Called when user clicks AI Chat / Let's Talk
}

export default function LandingPage({ onEnterApp, onConnectWallet, onOpenDemo, onOpenAdvisor }: LandingPageProps) {
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const { region: detectedRegion, isLoading: isRegionLoading } = useUserRegion();
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-black p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Hero Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/80 rounded-3xl p-6 shadow-2xl border border-purple-500/20"
        >
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white text-2xl font-black">D</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-white text-center mb-2">
            Your Personal <span className="text-blue-400">Guardian</span>
          </h1>
          <p className="text-gray-400 text-center mb-6">
            I'm here to protect your wealth from inflation and find growth in any economy.
          </p>
          
          {/* CTA — single primary action */}
          <button
            onClick={() => setShowRegionSelector(true)}
            className="w-full bg-white text-gray-900 font-black rounded-2xl py-4 px-6 text-lg hover:bg-gray-100 active:scale-[0.98] transition-all shadow-xl"
          >
            Get Started →
          </button>
          
          {/* Test Drive info — secondary, no CTA */}
          <div className="mt-4 p-4 rounded-2xl border border-purple-500/30 bg-purple-900/20">
            <p className="text-xs text-purple-300 font-bold uppercase tracking-wider mb-1">TEST DRIVE — NO REAL MONEY</p>
            <p className="text-xs text-gray-400 mb-2">Connect a wallet on the Arc Testnet to try with free USDC and earn badges.</p>
            <div className="flex gap-3">
              <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline hover:no-underline">Arc faucet →</a>
              <a href="https://faucet.celo.org/sepolia" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline hover:no-underline">Celo faucet →</a>
            </div>
          </div>
        </motion.div>

        {/* Savings Protection Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gray-900/80 rounded-3xl p-6 shadow-2xl border border-emerald-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛡️</span>
              <h2 className="text-xl font-black text-white">Protect Your Savings</h2>
            </div>
          </div>
          <p className="text-emerald-400 text-sm font-bold mb-4">
            A calmer way to protect savings from inflation.
          </p>
          <div className="bg-black/40 rounded-2xl p-4 mb-4">
            <p className="text-gray-400 text-sm">If you protect $1,000 →</p>
            <p className="text-3xl font-black text-emerald-400 mt-1">Save $23/year</p>
            <div className="flex gap-4 mt-3 text-sm">
              <div>
                <p className="text-gray-500">Per month</p>
                <p className="text-emerald-400 font-bold">$1.90</p>
                <p className="text-gray-500 text-xs">lost to inflation</p>
              </div>
              <div>
                <p className="text-gray-500">Per year</p>
                <p className="text-emerald-400 font-bold">$23</p>
                <p className="text-gray-500 text-xs">protected value</p>
              </div>
            </div>
          </div>
          <button
            onClick={onConnectWallet}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-2xl py-4 px-6 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <span>Connect Wallet</span>
          </button>
          <p className="text-gray-500 text-xs text-center mt-3">
            Connect a wallet to personalize, or try demo mode first.
          </p>
        </motion.div>

        {/* Demo Mode — clearly secondary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between bg-gray-800/50 rounded-2xl p-4 border border-gray-700/50"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎮</span>
            <div>
              <p className="text-white font-bold text-sm">Try Demo Mode</p>
              <p className="text-gray-400 text-xs">No wallet needed</p>
            </div>
          </div>
          <button
            onClick={onOpenDemo}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-5 py-2.5 text-sm transition-all"
          >
            Open Demo
          </button>
        </motion.div>
      </div>

      {/* Region Selector Overlay */}
      <AnimatePresence>
        {showRegionSelector && (
          <LandingRegionSelector
            selectedRegion={selectedRegion}
            onSelect={setSelectedRegion}
            onContinue={() => {
              setShowRegionSelector(false);
              if (selectedRegion) {
                localStorage.setItem('userRegion', selectedRegion);
              }
              onEnterApp();
            }}
            onBack={() => setShowRegionSelector(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
```

**Step 3: Create LandingRegionSelector sub-component**

Extract the region selector from the StrategyModal into a dedicated component for the landing flow.

Create: `components/landing/LandingRegionSelector.tsx`

Copy the 5-region card layout from the existing StrategyModal/SelectionScreen but as a standalone full-screen overlay.

**Step 4: Replace inline landing UI in index.tsx**

In `pages/index.tsx`, replace the pre-app conditional rendering block with:

```tsx
// Instead of rendering hero cards + savings card inline
if (showLanding && !hasCompletedOnboarding) {
  return (
    <LandingPage
      onEnterApp={markOnboardingComplete}
      onConnectWallet={connectWallet}
      onOpenDemo={handleOpenDemo}
      onOpenAdvisor={openAdvisor}
    />
  );
}
```

**Step 5: Verify**

```bash
npx tsc --noEmit --skipLibCheck
pnpm build
```

Expected: clean compile. The landing page should render identically to before.

### Task 2A.2: Create AppShell component

**Objective:** Extract the main app layout (header + tab nav + tab content area + AI Chat FAB) into an AppShell component. This is everything that renders AFTER the landing/onboarding layer.

**Files:**
- Create: `components/app/AppShell.tsx`
- Modify: `pages/index.tsx`

**Step 1: Identify what goes in AppShell**

- Header bar (logo, mode toggle, voice button, wallet button)
- TabNavigation (bottom nav)
- Tab content area (AnimatePresence + 5 tab render blocks)
- AI Chat FAB (floating button above nav)
- WalletTutorial modal
- GuidedTour
- TourTrigger
- Testnet warning banner (optional — could stay in page layer)
- GuardianStreakWidget (inside OverviewTab)

**Step 2: Create AppShell.tsx**

The AppShell receives all the data it needs as props from the page layer, plus callbacks for tab changes, wallet actions, and AI chat.

Props interface:
```typescript
interface AppShellProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  experienceMode: UserExperienceMode;
  setExperienceMode: (mode: UserExperienceMode) => void;
  address?: string;
  connectWallet: () => void;
  openAdvisor: () => void;
  unreadCount: number;
  isWalletConnected: boolean;
  // ... portfolio data, region, etc.
}
```

**Step 3: Wire into index.tsx**

```tsx
// pages/index.tsx
export default function DiversiFiPage() {
  // ... all hooks stay in the page layer ...
  
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('onboardingCompleted') === 'true';
  });

  if (!onboardingComplete) {
    return (
      <LandingPage
        onEnterApp={() => {
          localStorage.setItem('onboardingCompleted', 'true');
          setOnboardingComplete(true);
        }}
        onConnectWallet={connectWallet}
        onOpenDemo={() => setOnboardingComplete(true)}
        onOpenAdvisor={openAdvisor}
      />
    );
  }

  return (
    <AppShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      // ... pass all props ...
    />
  );
}
```

**Step 4: Verify**

```bash
npx tsc --noEmit --skipLibCheck
pnpm build
```

Expected: The app should render the same, but the code is now split into LandingPage + AppShell with a clean condition in index.tsx.

### Task 2A.3: Clean up index.tsx to be a thin orchestrator

**Objective:** After extracting LandingPage and AppShell, index.tsx should be reduced from 539 lines to ~100 lines — just hooks and the conditional render.

**Files:**
- Modify: `pages/index.tsx` (final trim)

**Step 1: Verify index.tsx structure**

After the extraction, index.tsx should contain:
- Imports (hooks, components)
- Default export function with all hooks
- Conditional: if !onboardingComplete → `<LandingPage>` else → `<AppShell>`
- Head/SEO meta tags
- No inline JSX for landing UI, app layout, or tab content

**Step 2: Remove dead code**

Delete all inline JSX that was moved to LandingPage.tsx and AppShell.tsx.

**Step 3: Final verification**

```bash
npx tsc --noEmit --skipLibCheck
pnpm build
pnpm lint
```

All clean.

---

## Phase 2B: Fix Landing Page CTAs (2 tasks, ~1h)

### Task 2B.1: Consolidate to one primary CTA

**Objective:** The landing page currently has 3 competing CTAs ("Let's Talk", "Connect Wallet", "Open Demo"). Make "Get Started" the single primary action. Move "Connect Wallet" and "Open Demo" to secondary positions.

**Files:**
- Modify: `components/landing/LandingPage.tsx`

**Step 1: Restructure the three CTAs**

Current layout:
1. Hero card → "Let's Talk" (big white button) → opens region selector
2. Savings card → "Connect Wallet" (big blue button) → opens wallet modal
3. Bottom card → "Open Demo" (blue button) → opens demo

New layout (from the LandingPage code in Task 2A.1):
1. Hero card → "Get Started" (big white button) → opens region selector
2. Savings card → "Connect Wallet" (big blue button) → opens wallet modal
3. Bottom card → "Open Demo" → opens demo

The key change: "Get Started" is the FIRST thing the user sees. It replaces "Let's Talk" as the primary entry. "Connect Wallet" stays visible but is contextual. "Open Demo" stays as the clearly secondary option.

**Step 2: Add a "skip to app" affordance**

Add a small text link at the bottom of the page:
```
Already have a wallet? Connect →   or   Skip to App →
```

This gives experienced users a fast path without going through the region selector.

**Step 3: Verify**

```bash
npx tsc --noEmit --skipLibCheck
```

### Task 2B.2: Fix the "Open Demo" path

**Objective:** "Open Demo" currently may not navigate anywhere productive. Fix it to either (a) open the app in demo mode with sample data, or (b) if demo isn't built yet, show a clear "Coming soon" state rather than a dead button.

**Files:**
- Modify: `components/landing/LandingPage.tsx`
- Possibly create: `components/demo/DemoOverlay.tsx`

**Step 1: Investigate current demo behavior**

Check what `handleOpenDemo` currently does in index.tsx. If it's just setting state or navigating to the app with no sample data, the demo path is broken.

**Step 2: Fix or remove**

Option A (preferred): When user clicks "Open Demo", set `onboardingComplete = true` AND set a `demoMode` flag in context/state. The app renders in demo mode with mock data.

Option B (fallback): Show a toast or overlay explaining the demo is coming soon and redirect to the app anyway.

Option C (cleanest for now): If demo isn't built, redirect "Open Demo" to the same flow as "Get Started" (opens region selector). The app already works without a wallet.

**Step 3: Verify**

Click "Open Demo" → either enters the app with sample data, or opens the region selector, or shows a clear message. No dead state.

---

## Phase 2C: Brand & Visual Alignment (2 tasks, ~45 min)

### Task 2C.1: Align LandingPage brand with App brand

**Objective:** The landing page uses "Guardian" branding (purple, guardian metaphor) while the app uses "DiversiFi" branding (blue, neutral). Pick one and apply consistently.

**Files:**
- Modify: `components/landing/LandingPage.tsx`

**Step 1: Decide on the brand**

Recommendation: Keep "DiversiFi" as the brand name throughout. Change the hero card headline from:

```
Your Personal Guardian
```

To:

```
Your Savings Guardian
```

or keep "Your Personal Guardian" as the tagline but ensure the brand name "DiversiFi" appears prominently (it's already in the "D" logo at the top).

**Step 2: Check color consistency**

The landing page currently uses purple gradients. The app uses blue. Either:
- Keep the purple landing → blue app transition (create a visual "entering the app" animation)
- Or unify both to blue

For now, just ensure the "DiversiFi" brand name is prominent on the landing page. A color unification is lower priority.

### Task 2C.2: Strengthen the value proposition

**Objective:** "Save $23 on $1,000" is a weak value prop. Reframe or personalize it.

**Files:**
- Modify: `components/landing/LandingPage.tsx` (savings calculator section)

**Step 1: Personalize the calculation**

Instead of a fixed $1,000 assumption, add a simple input:

```
"I have [$______] in savings"
```

When the user types an amount, show the personalized calculation.

**Step 2: Reframe the messaging**

Instead of "Save $23/year", try:
- "Keep $23 from losing value every year"
- "Protect your purchasing power — every dollar counts"
- "Stop losing money to inflation. Diversify into stronger economies."

The negative framing ("lost to inflation") is powerful — lead with that.

**Step 3: Verification**

The personalized input should update the savings calculation in real-time. No API call needed — it's just a multiplication.

---

## Phase 3: Polish & Edge Cases (optional, ~1h)

### Task 3.1: Add empty states for each tab

**Objective:** Currently tabs have no visible empty/error states. Add an `<EmptyState>` component.

**Files:**
- Create: `components/ui/EmptyState.tsx`
- Modify: each tab component to use it

**Task 3.2: Fix AI Chat FAB overlap**

**Objective:** The FAB at `bottom-20` overlaps the content area above the bottom nav.

**Files:**
- Modify: `pages/index.tsx` (line 508) or `AppShell.tsx`

Change `bottom-20` to `bottom-24` or adjust the content padding from `pb-20` to `pb-24`.

**Task 3.3: Add tab URL routing**

**Objective:** Allow deep-linking to tabs via URL query params.

**Files:**
- Modify: `pages/index.tsx` (read `?tab=` from query params on mount)
- Modify: `NavigationContext.tsx` (sync activeTab to URL)

---

## Execution Priority

| Order | Task | Dimension | Effort | Impact | Why now |
|-------|------|-----------|--------|--------|---------|
| 1 | 1.1 — Fix tab labels | Intuitiveness | 5 min | 🔴 Critical | "Protect" tab leads to swap — cognitive dissonance |
| 2 | 1.2 — Persist onboarding | Intuitiveness | 10 min | 🟡 High | Modal re-appears every visit — user annoyance |
| 3 | 1.3 — Remove user-scalable=no | Accessibility | 2 min | 🟡 High | Legal/accessibility requirement |
| 4 | 2A.1 — Create LandingPage component | Architecture | 45 min | 🟢 Medium | Unblocks all landing iterations |
| 5 | 2A.2 — Create AppShell component | Architecture | 45 min | 🟢 Medium | Unblocks all app iterations |
| 6 | 2A.3 — Clean index.tsx | Architecture | 15 min | 🟢 Medium | Final payoff of the split |
| 7 | 2B.1 — Consolidate CTAs | Product | 20 min | 🔴 Critical | 3 competing CTAs = no clear path for user |
| 8 | 2B.2 — Fix "Open Demo" path | Product | 15 min | 🔴 Critical | Broken entry point = lost users |
| 9 | 2C.1 — Brand alignment | Visual | 10 min | 🟡 High | Two brands = distrust |
| 10 | 2C.2 — Strengthen value prop | Product | 20 min | 🟡 High | Weak value prop = no conversion |

**The critical path for the UX overhaul:**
Tasks **1.1 → 1.2 → 1.3 → 2B.1 → 2B.2** — these five tasks fix the weakest dimension (Intuitiveness, 3/10) with minimal code changes. Then **2A.1 → 2A.2 → 2A.3** enable future iteration velocity. Everything else is additive.

---

## Before vs After

| Dimension | Before | After (critical path) | After (all phases) |
|-----------|--------|----------------------|-------------------|
| UI / Visual | 6 | 6 | 7 |
| Frontend Architecture | 6 | 6 | 8 |
| Product Design | 4 | 6 | 7 |
| Intuitiveness | 3 | 7 | 8 |
| **Overall** | **4.75** | **6.25** | **7.5** |

The critical path alone adds ~1.5 points to the overall score, mostly from fixing Intuitiveness from 3 → 7. All phases together target 7.5.
