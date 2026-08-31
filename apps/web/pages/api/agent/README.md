# Agent API routes

Server endpoints for the DiversiFi Guardian, advisor chat, x402 gateway, and related agent surfaces.

## Start here

| Route / file | Role |
|---|---|
| `advisor.ts` + `_advisor-core.ts` | AI chat (SSE streaming) |
| `guardian-loop.ts` | Cron autonomous execution within permission bounds |
| `guardian-heartbeat.ts` | Advisory heartbeat + ledger writes |
| `x402-gateway.ts` / `x402-metrics.ts` | Paid intelligence gateway + metrics |
| `firecrawl-webhook.ts` | Macro signal ingestion |
| `best-yield.ts` | Personalized / free yield picks |
| `web-search.ts` | TinyFish free-first search |
| `speak.ts` / `transcribe.ts` | ElevenLabs voice |
| `business/` | SME cycles / graduation signals |
| `enterprise/` | Enterprise audit surfaces |

Shared helpers in this folder are prefixed with `_` (e.g. `_guardian-event-bus.ts`).

Auth, rate limits, and env tables: [`docs/integrations.md`](../../../../docs/integrations.md). Enforcement model: [`docs/guardian.md`](../../../../docs/guardian.md).
