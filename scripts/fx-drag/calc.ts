/**
 * FX drag math — moved to the shared package so the x402 gateway can import the
 * exact same computation via @diversifi/shared. This file re-exports it verbatim
 * so `npx tsx scripts/fx-drag-report.ts` keeps working unchanged.
 *
 * Canonical source: packages/shared/src/services/fx-drag/calc.ts
 */

export * from '../../packages/shared/src/services/fx-drag/calc';
