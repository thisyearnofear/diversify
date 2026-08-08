# Hooks

Domain React hooks for the Next.js app. Keep non-UI logic in `@diversifi/shared` services; hooks orchestrate client state, Privy/wallet, and API calls.

## Start here

| Hook / area | Use for |
|---|---|
| `use-agent-chat.ts` | AI chat drawer (SSE) |
| `use-currency-risk.ts` | Non-prescriptive currency risk |
| `use-protection-profile.ts` | Profile + philosophy (prefer over ad-hoc strategy state) |
| `use-best-yield.ts` | Yield card data |
| `use-fx-netting.ts` | Caribbean / regional FX matching UI |
| `use-multichain-balances.ts` | Portfolio balances across rails |
| `use-session-key.ts` / `use-vault.ts` | Guardian permissions + vault |
| `use-proactive-agent.ts` | Proactive rebalance intents |

Co-located tests: `__tests__/`. UI consumers live under `components/` (especially `components/tabs/` and `components/agent/`).
