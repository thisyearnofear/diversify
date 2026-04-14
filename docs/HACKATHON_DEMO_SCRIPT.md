# DeFi Mullet Hackathon Demo Script
## DiversiFi - AI-Powered Wealth Protection with LI.FI Earn

**Track:** 🤖 AI × Earn  
**Duration:** 3-4 minutes  
**Tagline:** "Protect your savings from inflation with AI-guided yield optimization across 20+ protocols"

---

## 🎬 Demo Script

### Opening Hook (15 seconds)
> "Your savings are losing value to inflation every day. What if an AI could protect your wealth by automatically finding the best yield opportunities across 20+ DeFi protocols and 60+ chains?"

**[Screen: Landing page with inflation ticker showing real-time rates]**

---

### Problem Statement (30 seconds)
> "Meet Sarah. She has $1,000 in USDC sitting idle. With 3% inflation, she's losing $30 in purchasing power every year. Traditional banks offer 0.5% interest. DeFi offers 5-15% yields, but it's complex—different protocols, different chains, constant monitoring."

**[Screen: Show inflation calculator with real numbers]**

> "DiversiFi solves this with AI-powered protection plans that leverage LI.FI Earn to access the best yields across the entire DeFi ecosystem—in one click."

---

### Solution Demo (2 minutes)

#### Part 1: AI Protection Plan (30 seconds)
> "First, Sarah connects her wallet and sets up her protection plan. Our AI advisor asks about her goals."

**[Screen: Protection tab with AI chat open]**

**Actions:**
1. Click "Ask AI" button on Protection Plan card
2. AI asks: "What's your goal? Inflation protection, yield maximization, or geographic diversification?"
3. User selects: "Inflation Protection"
4. AI analyzes portfolio and recommends strategy

**Narration:**
> "The AI analyzes her portfolio across Celo and Arbitrum, calculates her inflation exposure, and recommends a protection strategy."

#### Part 2: Zero Balance Onboarding (20 seconds)
> "If Sarah has no funds yet, DiversiFi detects this and shows inline onramp options with AI guidance."

**[Screen: Swap tab with zero balance card]**

**Actions:**
1. Show zero-balance detection card
2. Click "Ask AI" button
3. AI explains: "Best onramp for your region, minimum deposit, fees"
4. User deposits $100 via Guardarian/Mt Pelerin

**Narration:**
> "No confusion, no drop-off. The AI guides her through every step."

#### Part 3: LI.FI Earn Integration (60 seconds)
> "Now here's where LI.FI Earn powers the magic. Sarah wants to earn yield on her USDC."

**[Screen: Yield Discovery Section]**

**Actions:**
1. Scroll to "Yield Opportunities" section
2. Show live vaults from LI.FI Earn API:
   - Morpho USDC on Base: 8.2% APY
   - Aave USDC on Arbitrum: 5.4% APY
   - EtherFi USDC on Ethereum: 6.1% APY
3. Click "Ask AI" on a vault card
4. AI explains: "Morpho offers the highest yield with moderate risk. Your funds will be deposited on Base via LI.FI's one-click execution."

**Narration:**
> "DiversiFi pulls real-time yield data from 20+ protocols across 60+ chains using LI.FI Earn. Sarah sees all opportunities in one place—no protocol-hopping, no manual bridging."

**Actions:**
5. Click "Deposit" on Morpho vault
6. Show swap interface pre-filled:
   - From: USDC (Celo)
   - To: Morpho USDC Vault (Base)
   - Amount: $100
7. Click "Execute Swap"
8. Show transaction executing via LI.FI Composer:
   - Step 1: Bridge USDC from Celo to Base
   - Step 2: Deposit into Morpho vault
   - Step 3: Receive yield-bearing vault tokens

**Narration:**
> "One click. LI.FI handles the cross-chain complexity—bridging from Celo to Base and depositing into Morpho—all in a single atomic transaction."

#### Part 4: AI Action Cards (20 seconds)
> "After the swap, our AI provides an action card with the results."

**[Screen: Success celebration modal with action card]**

**Actions:**
1. Show success modal with:
   - "✓ Deposited $100 into Morpho USDC"
   - "Expected annual earnings: $8.20"
   - "Protection score increased by 15%"
2. Show HOLD action card: "Portfolio well-balanced. Hold steady 💎"

**Narration:**
> "The AI confirms the action and provides ongoing guidance. If rebalancing is needed, it shows a SWAP action card. If the portfolio is optimal, it shows a HOLD card."

---

### Key Features Highlight (30 seconds)

**[Screen: Split screen showing multiple features]**

> "Let me show you what makes DiversiFi unique:"

**Features:**
1. **Contextual AI Buttons** - "Ask AI" on every card for instant help
2. **Zero-Balance Detection** - Inline onramp prevents user drop-off
3. **LI.FI Earn Integration** - 20+ protocols, 60+ chains, one API
4. **Action Cards** - AI provides executable recommendations (SWAP/HOLD)
5. **Cross-Chain Execution** - Atomic transactions via LI.FI Composer
6. **Real-Time Data** - Live APY, inflation rates, portfolio analysis

---

### Technical Deep Dive (30 seconds)

**[Screen: Code snippet or architecture diagram]**

> "Under the hood, here's how it works:"

**Architecture:**
```
User Action → AI Advisor → LI.FI Earn API → Vault Discovery
                                          ↓
                                   LI.FI Composer
                                          ↓
                        Bridge + Swap + Deposit (atomic)
                                          ↓
                                  Yield-bearing tokens
```

**Narration:**
> "We use LI.FI Earn's vault discovery API to fetch opportunities, then LI.FI Composer to execute cross-chain deposits atomically. Our AI layer provides context-aware guidance at every step."

**Code Example:**
```typescript
// Fetch vaults from LI.FI Earn
const vaults = await lifi.getVaults({
  chains: [42161, 8453], // Arbitrum, Base
  tokens: ['USDC'],
  minApy: 5
});

// Execute deposit via Composer
const route = await lifi.getRoute({
  fromChain: 42220, // Celo
  toChain: 8453,    // Base
  fromToken: 'USDC',
  toToken: vaults[0].asset.address,
  fromAmount: '100'
});
```

---

### Impact & Results (20 seconds)

**[Screen: Dashboard showing portfolio growth]**

> "Sarah's results after one week:"

**Metrics:**
- Initial deposit: $100
- Current value: $100.15 (0.15% weekly return)
- Projected annual: $8.20 (8.2% APY)
- Inflation protection: ✅ Beating 3% inflation by 5.2%
- Protection score: 85/100 (up from 70)

**Narration:**
> "Sarah's savings are now protected and growing. She's earning 8.2% APY while the AI monitors for better opportunities."

---

### Closing (15 seconds)

> "DiversiFi combines AI guidance with LI.FI Earn's infrastructure to make DeFi yield accessible to everyone. No complexity, no confusion—just protection and growth."

**[Screen: Call to action]**

**Text on screen:**
- Try it: diversifi.app
- GitHub: github.com/thisyearnofear/diversify
- Built with: LI.FI Earn API
- Track: AI × Earn

**Narration:**
> "Built in one week for the DeFi Mullet Hackathon. Try it at diversifi.app."

---

## 🎥 Video Production Notes

### Equipment Needed
- Screen recording software (Loom, OBS, or QuickTime)
- Microphone (clear audio is critical)
- Stable internet connection

### Recording Tips
1. **Practice 3 times** before recording final version
2. **Keep cursor movements smooth** - no erratic clicking
3. **Pause briefly** between sections for editing
4. **Show real transactions** - use testnet or small amounts
5. **Keep energy high** - enthusiasm is contagious

### Editing Checklist
- [ ] Add intro title card (3 seconds)
- [ ] Add section transitions
- [ ] Highlight key UI elements with zoom/arrows
- [ ] Add background music (low volume)
- [ ] Add captions for key points
- [ ] Add outro with links
- [ ] Export at 1080p, 30fps
- [ ] Keep under 4 minutes

---

## 📱 Twitter Thread Template

### Tweet 1 (Main Post)
```
I just built DiversiFi with @lifiprotocol Earn 🤖💰

An AI-powered wealth protection platform that helps you beat inflation by finding the best yields across 20+ protocols and 60+ chains.

One click. Zero complexity. Real protection.

🧵 Here's how it works 👇

#DeFiMullet
```

### Tweet 2
```
The Problem:
Your savings lose 3% to inflation yearly. DeFi offers 5-15% yields, but it's complex—different protocols, chains, constant monitoring.

Most people give up before they start.
```

### Tweet 3
```
The Solution:
DiversiFi uses AI to guide you through:
✅ Protection plan setup
✅ Zero-balance onboarding
✅ Yield discovery (via LI.FI Earn)
✅ One-click cross-chain deposits
✅ Ongoing portfolio optimization
```

### Tweet 4
```
The Magic: LI.FI Earn Integration

One API gives us:
• 20+ vault protocols (Morpho, Aave, Euler, etc.)
• 60+ chains
• Real-time APY data
• Atomic cross-chain execution

Users see: "Deposit"
We handle: Bridge + Swap + Deposit in one tx
```

### Tweet 5
```
Key Innovation: Contextual AI Buttons

Every card has an "Ask AI" button with:
• Context-aware prompts
• Quick questions
• Custom input

No more confusion. Help exactly where you need it.

[Screenshot of AI button]
```

### Tweet 6
```
Real Example:

Sarah deposits $100 USDC on Celo
→ AI recommends Morpho vault on Base (8.2% APY)
→ One click via LI.FI Composer
→ Atomic: Bridge + Deposit
→ Earning yield in 30 seconds

[Demo video clip]
```

### Tweet 7
```
Built in one week for #DeFiMullet 🏗️

Tech Stack:
• Next.js 15
• LI.FI Earn API
• Venice AI
• Privy + Safe
• Mento Protocol

Track: AI × Earn

Try it: [link]
Code: [github]

@lifiprotocol @kenny_io
```

---

## 📋 Submission Checklist

### Before April 14, 9 AM ET:
- [ ] Record demo video (3-4 minutes)
- [ ] Edit video with captions and transitions
- [ ] Upload video to YouTube/Vimeo (unlisted)
- [ ] Write Twitter thread (7 tweets)
- [ ] Schedule Twitter thread for April 14, 9:00 AM ET
- [ ] Prepare GitHub repo (clean README, clear setup instructions)
- [ ] Deploy latest version to production
- [ ] Test all features one final time
- [ ] Prepare write-up for Google Form

### On April 14, 9:00 AM ET:
- [ ] Confirm Twitter thread posted
- [ ] Fill out Google Form: https://forms.gle/1PCvD9BymH1EyRmV8
- [ ] Include:
  - [ ] Project name: DiversiFi
  - [ ] Track: AI × Earn
  - [ ] Demo video link
  - [ ] Live app link: diversifi.app
  - [ ] GitHub repo link
  - [ ] Twitter post link
  - [ ] Write-up (what it does, how it uses Earn API, next steps, feedback)

---

## 💡 Talking Points for Write-Up

### What DiversiFi Does
DiversiFi is an AI-powered wealth protection platform that helps users beat inflation by automatically finding and accessing the best DeFi yields across 20+ protocols and 60+ chains. It combines conversational AI guidance with LI.FI Earn's infrastructure to make DeFi yield accessible to everyone—from crypto natives to complete beginners.

### How It Uses LI.FI Earn API
1. **Vault Discovery**: Fetches real-time yield opportunities from 20+ protocols using `lifi.getVaults()`
2. **Cross-Chain Routing**: Uses LI.FI Composer to execute atomic bridge + deposit transactions
3. **Dynamic Recommendations**: AI analyzes vault data (APY, risk, protocol) to recommend optimal opportunities
4. **One-Click Execution**: Users deposit from any chain to any vault in a single transaction
5. **Portfolio Tracking**: Monitors positions across chains and suggests rebalancing when better opportunities appear

### What We'd Build Next
1. **Auto-Rebalancing**: AI automatically moves funds to better vaults when APY drops
2. **Risk Scoring**: ML model to assess vault risk based on protocol history, TVL, audits
3. **Social Deposits**: Send yield-bearing tokens to friends via phone number/email
4. **Yield Strategies**: Pre-built strategies (Conservative, Balanced, Aggressive) that auto-allocate
5. **Mobile App**: Native iOS/Android app with push notifications for yield changes

### Feedback on API Experience
**What Worked Well:**
- Vault discovery API is fast and comprehensive
- Composer makes cross-chain deposits trivial
- Documentation is clear with good examples
- TypeScript types are well-defined

**Suggestions:**
- Add historical APY data for trend analysis
- Include vault risk ratings in API response
- Support for batch deposits (multiple vaults at once)
- Webhook notifications for APY changes
- More granular filtering (by protocol, risk level, min TVL)

---

## 🎯 Judging Criteria Optimization

### API Integration (35%)
**What we showcase:**
- Deep integration with LI.FI Earn (vault discovery + execution)
- Cross-chain atomic transactions via Composer
- Real-time data fetching and display
- Error handling and fallbacks
- Multiple chains supported (Celo, Arbitrum, Base, Ethereum)

**Demo emphasis:** Show the code, explain the architecture, highlight atomic execution

### Innovation (25%)
**What makes us unique:**
- AI-guided yield optimization (not just aggregation)
- Contextual AI buttons on every card
- Zero-balance detection with inline onramp
- Action cards (SWAP/HOLD) for executable recommendations
- Inflation-aware portfolio analysis

**Demo emphasis:** Focus on AI features, show how it's different from typical yield aggregators

### Product Completeness (20%)
**What we have:**
- Fully deployed production app
- Working cross-chain deposits
- Real transaction execution
- Comprehensive UI (onboarding, swap, protection, earn)
- Mobile responsive
- Error handling
- Loading states

**Demo emphasis:** Show it's production-ready, not a prototype

### Presentation (20%)
**How we nail it:**
- Clear problem statement
- Compelling narrative (Sarah's story)
- High-quality video with captions
- Smooth demo flow
- Technical depth without jargon
- Strong Twitter thread
- Professional GitHub repo

**Demo emphasis:** Polish, clarity, energy

---

## 🚀 Launch Day Content Strategy

### Goal: Win "Best Launch Day Content" ($200)

**Strategy:**
1. **Thread Quality**: 7-tweet thread with clear narrative, visuals, and demo clips
2. **Engagement**: Ask questions, respond to comments quickly
3. **Visuals**: Include screenshots, GIFs, and video clips in thread
4. **Timing**: Post at 9:00 AM ET for maximum visibility
5. **Hashtags**: #DeFiMullet, #LiFi, #DeFi, #AI
6. **Cross-Promotion**: Share in Telegram group, ask team to retweet

**Content Hooks:**
- "Your savings are losing 3% to inflation. Here's how AI can protect them."
- "I built an AI that finds the best DeFi yields across 60+ chains. In one week."
- "What if earning 8% APY was as easy as clicking 'Deposit'?"

---

## 📞 Support Resources

- **Telegram**: https://t.me/lifibuilders
- **Docs**: https://docs.li.fi/earn/overview
- **Office Hours**: Check Telegram for schedule
- **Test Funds**: Request in Telegram group

---

**Good luck! 🚀**
