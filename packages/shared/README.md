# `@diversifi/shared`

Domain services and types shared by the Next.js app and scripts. Prefer extending these over adding one-off logic in `pages/` or `components/`.

## Start here

| Concern | Path |
|---|---|
| AI routing / providers | `src/services/ai/` (`AIService`, provider failover) |
| Recommendation ledger | `src/services/recommendation-ledger.service.ts` |
| Guardian helpers | `src/services/guardian/` |
| FX netting | `src/services/fx-netting/` |
| FX drag math | `src/services/fx-drag/` |
| Wallet / streak modules | `src/modules/wallet/`, `src/modules/rewards/streak/` |
| Memory (Cognee / Tablestore) | `src/services/cognee-memory-service.ts`, `tablestore-memory-service.ts` |
| Shared types | `src/types/` |

Entry barrel: `src/index.ts` (avoid deep-importing the barrel from `_app` — see `docs/architecture.md` § Dependency Architecture Audit).

Build: filtered via turbo from the repo root (`pnpm build`). Tests live next to source under `__tests__/` and run with root `pnpm test`.
