# Cultural Framing Strategy: Beyond Western Financial Values

## The Problem We're Solving

**Current State**: DiversiFi unconsciously imposes Western financial values
- "Diversification is always good"
- "Inflation protection is the goal"
- "Global assets are safer than local"
- "Yield maximization is smart"

**Reality**: Different cultures have different financial philosophies
- **Africapitalism**: Keep wealth in African economies to build local prosperity
- **Regionalism**: Support neighboring countries and regional integration
- **Nationalism**: Strengthen local currency and economy
- **Community Wealth**: Collective prosperity over individual optimization
- **Cultural Heritage**: Financial decisions tied to identity and values

---

## User Archetypes & Their Authentic Goals

### 1. The Africapitalist
**Philosophy**: "My wealth should build Africa"

**Strategy**:
- Swap between African stablecoins (KESm → GHSm → ZARm → NGNm)
- Avoid USD/EUR exposure
- Support pan-African economic integration

**Our Current Messaging** ❌:
- "You're not diversified enough"
- "Your inflation risk is high"
- "Consider global stablecoins"

**Better Messaging** ✅:
- "Supporting 4 African economies"
- "Building regional resilience"
- "Pan-African portfolio"

---

### 2. The Nationalist
**Philosophy**: "I believe in my country's future"

**Strategy**:
- Hold local currency stablecoins (NGNm, BRLm, etc.)
- Resist "dollarization"
- Support local economy

**Our Current Messaging** ❌:
- "Your currency is losing value"
- "Swap to USD for safety"
- "Protect yourself from local inflation"

**Better Messaging** ✅:
- "Supporting local economy"
- "Maintaining purchasing power in [currency]"
- "Hedging within your region"

---

### 3. The Regionalist
**Philosophy**: "My region's success is my success"

**Strategy**:
- Diversify within region (LatAm, Africa, Asia)
- Support regional trade and integration
- Hedge against specific country risk while staying regional

**Our Current Messaging** ❌:
- "Add global exposure"
- "You need USD/EUR"

**Better Messaging** ✅:
- "Regional diversification: 3 countries"
- "Supporting [region] economic integration"
- "Hedging country risk, supporting region"

---

### 4. The Diaspora Builder
**Philosophy**: "Send wealth home, build there"

**Strategy**:
- Convert earnings to home country stablecoins
- Remittance optimization
- Support family/community back home

**Our Current Messaging** ❌:
- "Diversify globally"
- "Don't concentrate in one country"

**Better Messaging** ✅:
- "Optimized remittance path"
- "Supporting home economy"
- "Building wealth back home"

---

### 5. The Global Citizen
**Philosophy**: "I'm a citizen of the world"

**Strategy**:
- True global diversification
- Multiple continents
- Currency hedging

**Our Current Messaging** ✅:
- This is the ONLY archetype we currently serve well

---

### 6. The Yield Maximizer
**Philosophy**: "Money should work for me"

**Strategy**:
- RWA tokens (USDY, SYRUPUSDC)
- Yield-bearing stablecoins
- APY optimization

**Our Current Messaging** ❌:
- "You're taking smart contract risk"
- "Consider safer options"

**Better Messaging** ✅:
- "Earning 5% APY"
- "Yield-optimized portfolio"
- "Making money work harder"

---

## The Core Issue: Value Judgment vs. Value Neutrality

### What We're Doing Wrong:

```typescript
// Imposing our values
if (diversificationScore < 70) {
  return "⚠️ Needs attention - Add more regions";
}

if (hasOnlyAfricanTokens) {
  return "❌ Poor diversification - Consider global assets";
}
```

### What We Should Do:

```typescript
// Respecting their strategy
if (user.strategy === 'africapitalism') {
  return "✅ Supporting 4 African economies";
}

if (user.strategy === 'nationalism') {
  return "✅ Maintaining local economic ties";
}

if (user.strategy === 'diversification') {
  return "✅ Global exposure across 5 regions";
}
```

---

## Implementation Strategy

### Phase 1: User Strategy Selection (Onboarding)

**Question**: "What's your wealth philosophy?"

**Options**:
1. 🌍 **Global Diversification** - "Spread risk across the world"
2. 🌍 **Regional Focus** - "Support my region's growth"
3. 🏠 **Local First** - "Build my country's economy"
4. 💰 **Yield Maximization** - "Earn the highest returns"
5. 🎯 **Custom Strategy** - "I'll choose my own path"

### Phase 2: Strategy-Aware Recommendations

**Instead of**: "You should diversify more"

**Say**: 
- **Africapitalist**: "Consider adding GHSm to support Ghana's economy"
- **Nationalist**: "BRLm is available if you want to hedge within Brazil"
- **Global**: "Add EURm for European exposure"
- **Yield**: "USDY offers 5% APY on your stablecoins"

### Phase 3: Strategy-Aligned Metrics

**Current Metrics** (One-size-fits-all):
- Diversification Score: 59%
- Inflation Risk: 12.4%
- Regional Exposure: 7 regions

**Strategy-Aligned Metrics**:

**For Africapitalist**:
- African Economic Support: 4 countries
- Pan-African Integration: High
- Regional Resilience: Strong

**For Nationalist**:
- Local Economy Support: 100%
- Currency Sovereignty: Maintained
- Community Impact: High

**For Global Diversifier**:
- Geographic Spread: 7 regions
- Currency Risk: Hedged
- Global Exposure: Excellent

**For Yield Maximizer**:
- Portfolio APY: 4.2%
- Yield Efficiency: 85%
- Risk-Adjusted Returns: Strong

---

## Messaging Framework

### Principle: Describe, Don't Prescribe

❌ **Prescriptive** (What we do now):
- "You need to diversify"
- "This is risky"
- "You should add USD"

✅ **Descriptive** (What we should do):
- "You're supporting 3 African economies"
- "You're focused on yield generation"
- "You're maintaining local economic ties"

---

## UI Changes Needed

### 1. Onboarding: Strategy Selection
```typescript
<StrategySelector
  options={[
    { id: 'global', label: 'Global Diversification', icon: '🌍' },
    { id: 'regional', label: 'Regional Focus', icon: '🌍' },
    { id: 'local', label: 'Local First', icon: '🏠' },
    { id: 'yield', label: 'Yield Maximization', icon: '💰' },
    { id: 'custom', label: 'Custom Strategy', icon: '🎯' },
  ]}
  onSelect={(strategy) => setUserStrategy(strategy)}
/>
```

### 2. Dashboard: Strategy-Aware Metrics
```typescript
<ProtectionScore
  strategy={userStrategy}
  metrics={getStrategyMetrics(portfolio, userStrategy)}
/>
```

### 3. Recommendations: Strategy-Aligned
```typescript
<Recommendations
  strategy={userStrategy}
  portfolio={portfolio}
  suggestions={getStrategySuggestions(portfolio, userStrategy)}
/>
```

---

## Cultural Sensitivity Guidelines

### 1. Language Matters
- ❌ "Protect yourself from local inflation"
- ✅ "Hedge currency volatility"

- ❌ "Your country's currency is weak"
- ✅ "Currency experiencing volatility"

- ❌ "Diversify away from Africa"
- ✅ "Explore additional options"

### 2. Respect Local Knowledge
- Users know their economies better than we do
- Local context matters more than global metrics
- Cultural values are valid financial strategies

### 3. Avoid Paternalism
- Don't assume Western finance is "correct"
- Don't judge strategies as "good" or "bad"
- Provide tools, not prescriptions

---

## Success Metrics (By Strategy)

### Africapitalist Success:
- Number of African economies supported
- Intra-African swap volume
- Regional economic impact

### Nationalist Success:
- Local currency stability maintained
- Community wealth building
- Economic sovereignty preserved

### Global Diversifier Success:
- Geographic spread
- Currency risk hedged
- Portfolio resilience

### Yield Maximizer Success:
- APY achieved
- Risk-adjusted returns
- Yield efficiency

---

## Next Steps

1. **Add Strategy Selection** to onboarding
2. **Store User Strategy** in profile
3. **Create Strategy-Specific Metrics** components
4. **Rewrite Recommendations** to be strategy-aware
5. **Update Messaging** to be descriptive, not prescriptive
6. **Test with Users** from different cultural backgrounds

---

## The Bigger Picture

**We're not just building a DeFi app.**

**We're building a platform that respects:**
- Cultural diversity in financial philosophy
- Regional economic strategies
- National sovereignty in currency choices
- Individual autonomy in wealth management

**Our role**: Provide tools and information
**Not our role**: Judge what's "right" or "wrong"

**The shift**: From "financial advisor" to "financial enabler"

---

## Questions for Discussion

1. Should strategy selection be mandatory or optional?
2. How do we handle users who want to change strategies?
3. Should we show "alternative strategies" or only support their chosen one?
4. How do we balance education with respect for autonomy?
5. What metrics matter most for each strategy?

---

## Conclusion

**Current State**: We're a Western-centric diversification app

**Future State**: We're a culturally-aware financial autonomy platform

**The Change**: From judging strategies to enabling them

**The Impact**: Truly inclusive financial tools that respect cultural diversity

This is not just about being politically correct. It's about building a product that actually serves the diverse needs of a global user base, rather than imposing a single "correct" way to manage wealth.
