# Repository Guidelines

## Project Structure & Module Organization
DiversiFi is a pnpm monorepo structured for high-integrity AI agent operations. Core business logic is decoupled from the Next.js frontend into shared packages:
- `packages/shared`: Unified services for AI synthesis (`ai-service.ts`), data orchestration (`market-pulse-service.ts`), agent memory (`cognee-memory-service.ts`), and chain-settled research. Contains the AI provider strategy pattern under `services/ai/providers/`, decorator pattern under `services/ai/decorators/`, and shared type definitions under `types/`.
- `packages/shared/src/types/`: Shared TypeScript type definitions (`wallet-provider.ts`, `swap.ts`, `portfolio.ts`, `inflation.ts`, `intelligence.ts`, `strategy.ts`).
- `packages/shared-0g`: Dedicated integration for 0G Storage (audit trail) and Persistence (verifiable state).
- `hooks/`: Domain-driven React hooks for agent proactivity (`use-proactive-agent.ts`) and wallet-policy enforcement.
- `pages/api/agent/`: Core backend endpoints for x402 payment negotiation, AI-driven market intelligence, autonomous Guardian loop (`guardian-loop.ts`), and Firecrawl macro signal webhooks (`firecrawl-webhook.ts`).
- `scripts/`: Utility scripts including `setup-firecrawl-monitors.ts` for registering Firecrawl watchers.

## Build, Test, and Development Commands
- **Dev**: `pnpm dev` (starts Next.js on port 3042).
- **Build**: `pnpm build` (orchestrates turbo builds for shared packages before the application build).
- **Test**: `pnpm test` (runs the Vitest suite).
- **Lint**: `pnpm lint` (runs workspace-wide linting).
- **Format**: `pnpm format` (Prettier).

### Specialized Verification
- `pnpm test-x402`: Verifies the gateway challenge/response loop.
- `pnpm test-x402-comprehensive`: Validates the full research-payment-settlement cycle.
- `pnpm validate-agent`: Checks configuration integrity.

## Coding Style & Naming Conventions
- **Enhancement First**: Prioritize extending existing components and shared services before creating new ones.
- **Service Pattern**: All non-UI logic must reside in shared package services to maintain a single source of truth.
- **AI Routing**: Use `AIService` from `@diversifi/shared` for all LLM interactions. It handles multi-provider failover (Venice/Gemini/AI·ML API) and automatic 0G anchoring.
- **Verifiable AI**: Every high-impact recommendation must be anchored to 0G Storage via `zeroGStorageService` and recorded on-chain via `recommendationLedgerService`.
- **Agent Memory**: Use `cogneeMemoryService` from `@diversifi/shared` for cross-session persistent context (Cognee).
- **Autonomous Execution**: The Guardian loop (`/api/agent/guardian-loop`) runs server-side via cron, auto-executing within user-signed ERC-7715 permission bounds.

## Commit & Pull Request Guidelines
- **Conventional Commits**: Use `feat:`, `fix:`, `refactor:`, `docs:`, etc.
- **Signal-to-Noise**: Commit messages should focus on the "why" of the change.
- **Validation**: Never submit a PR without running the specialized verification commands if core agent logic is modified.
