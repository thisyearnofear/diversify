# Product Focus Plan

Product direction and simplification plan for DiversiFi.

## Core Product Story

DiversiFi helps people in volatile economies protect savings from inflation through simple, guided stablecoin diversification.

This is the product story that should win over every other story in the app.

## Product Principles

All product and engineering work should follow these principles:

- **ENHANCEMENT FIRST** — Always prioritize enhancing existing components over creating new ones.
- **CONSOLIDATION** — Delete unnecessary code rather than deprecating it.
- **PREVENT BLOAT** — Systematically audit and consolidate before adding new features.
- **DRY** — Keep a single source of truth for shared logic.
- **CLEAN** — Maintain clear separation of concerns with explicit dependencies.
- **MODULAR** — Build composable, testable, independent modules.
- **PERFORMANT** — Use adaptive loading, caching, and resource optimization.
- **ORGANIZED** — Preserve a predictable file structure with domain-driven design.

## What DiversiFi Is

- A savings protection app.
- A guided stablecoin diversification experience.
- A region-aware inflation protection tool.
- A calm, trustworthy interface with optional intelligence.

## What DiversiFi Is Not

- Not a general trading terminal.
- Not a multi-chain protocol showcase.
- Not an autonomous agent operating system.
- Not a crypto superapp.

## Keep

- Keep the inflation-first value proposition.
- Keep region-aware protection guidance.
- Keep demo mode to reduce trust friction.
- Keep guided onboarding, but make it shorter and clearer.
- Keep the protection analytics and recommendation core.
- Keep permissions, fee accounting, and execution safety as backend strengths.

## Rename

- Rename user-facing **Agent** language to **Advisor**.
- Rename **financial strategies** to **protection plans** where possible.
- Replace **autonomous wealth protection agents** with **automatic protection** in user-facing copy.
- Rework top-level navigation labels to reflect protection, not trading.

## Hide

- Hide advanced controls by default.
- Hide chain and infrastructure complexity from the main UX.
- Hide voice, automation, and expert controls until the user has completed a core protection flow.
- Hide raw portfolio complexity when a simpler recommendation can be shown.

## Cut

- Cut or heavily demote the trading-terminal identity from the main app.
- Cut protocol-first messaging from user-facing surfaces.
- Cut duplicate recommendation surfaces that explain the same idea in multiple places.
- Cut visible product breadth that weakens the core inflation-protection story.

## UX Direction

The app should feel like:

- A calm savings protection app.
- Clear enough for first-time crypto users.
- Helpful without sounding overly technical.
- Intelligent, but not intimidating.

The app should not feel like:

- A quant dashboard.
- A DeFi control panel.
- A hackathon demo with every feature exposed at once.

## Ideal Navigation

The intended primary navigation is:

- **Home** — Current inflation exposure, protection status, next best action.
- **Protect** — Choose or adjust a plan, preview allocation, execute protection.
- **Advisor** — Ask questions, understand recommendations, review recent actions.
- **Learn** — Trust, FAQs, and how protection works.

This means the product should move away from overlapping concepts like separate **Exchange** and **Protect** destinations when they represent the same user goal.

## Ideal First-Run Flow

1. Detect or ask for region.
2. Ask what the user wants most: stability, diversification, or ethical constraints.
3. Recommend a protection plan.
4. Offer demo mode or wallet connection.
5. Present one clear protection action.

## Current Priority Order

### P0

- Remove or strongly demote trading-centric pathways from the main story.
- Rename **Agent** to **Advisor** in primary user-facing surfaces.
- Merge overlapping protection flows so users have one obvious path.

### P1

- Rewrite top-level copy to be savings-first and inflation-first.
- Move advanced controls behind secondary entry points.
- Simplify onboarding to goal, region, recommendation, action.

### P2

- Reassess secondary systems such as rewards, side features, and ecosystem integrations only after the core story is clear.

## Terminology Guide

Use this guide to keep product, design, and engineering language aligned.

### User-Facing Terms

- Say **Advisor** instead of **Agent**.
- Say **Protection Plan** or **Plan** instead of **Strategy** when speaking to end users.
- Say **Protect** instead of **Exchange** when describing the main action flow.
- Say **Protection Balance** or **Protection Wallet** instead of **Agent Fuel** where the user sees it.
- Say **Automatic Protection** instead of **Guardian** unless the user explicitly needs the technical distinction.
- Say **Move into protection** or **protect savings** instead of overly technical swap-first language when possible.

### Internal Terms

- Internal code and service names may still use legacy terms such as `Agent`, `Guardian`, `Strategy`, or `Exchange` until a deliberate refactor is justified.
- Do not perform broad rename sweeps unless they reduce real team confusion.
- Prefer updating product copy, documentation, and high-traffic comments before renaming implementation details.

### Translation Map

- `Agent` → `Advisor`
- `Guardian` → `Automatic Protection`
- `Strategy` → `Protection Plan`
- `Exchange` → `Protect`
- `Agent Fuel` → `Protection Balance` / `Protection Wallet`
- `Swap` → `Protection move` when the user benefit matters more than the mechanism

### Usage Rule

When writing copy or discussing the product, default to the user-facing terms.

When discussing implementation, use the internal terms only if they make the technical conversation clearer.

If there is a conflict, optimize for product clarity first.

## Execution Rules

When implementing this plan:

- Prefer editing and simplifying existing tabs, flows, and copy before creating new surfaces.
- Remove duplicate concepts instead of preserving them behind legacy labels.
- Consolidate shared logic before changing UI structure.
- Keep architecture improvements in service of the core product story.
- Measure every visible feature against the question: does this help the user protect savings from inflation?

## Near-Term Execution Plan

1. Rework navigation labels and visible destinations around the protection journey.
2. Simplify first-run and connected dashboard copy.
3. Move advanced agent controls behind the Advisor surface or settings.
4. Demote or remove trading-oriented UI from the default path.
5. Consolidate duplicate recommendation and action surfaces.

## Decision Filter

Before shipping any feature, ask:

- Does this make DiversiFi feel more trustworthy?
- Does this make protection easier to understand?
- Does this reduce or increase cognitive load?
- Does this strengthen or dilute the inflation-protection story?

If the answer weakens the core story, do not ship it in the main experience.
