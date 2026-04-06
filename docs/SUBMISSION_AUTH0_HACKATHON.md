# DiversiFi × Auth0 Token Vault: Authorized to Act

### _Authorized to Act Hackathon — April 2026_

## Project Overview

DiversiFi is an AI-powered savings protection agent for people in volatile economies. It monitors inflation, recommends stablecoin diversification, and executes rebalances autonomously — all within user-defined permission boundaries.

**What Token Vault adds:** DiversiFi's agent currently operates with app-owned API keys for external services. Token Vault upgrades this to **user-delegated OAuth credentials**, enabling the agent to act on the user's behalf across their own connected services — Slack, Google Sheets, email — with explicit consent, scoped access, and revocable permissions.

**Tagline:** Your savings advisor that protects your wealth _and_ respects your boundaries.

## The Problem

AI agents that manage money need to communicate with users — alerts, receipts, reports. Today this means:

1. **App-owned integrations** — The app posts to _its_ Slack, _its_ webhook. Users get generic notifications, not personalized ones.
2. **Credential sprawl** — Users paste webhook URLs, API keys, and bot tokens into settings pages. No standard consent, no revocation, no audit trail.
3. **No permission boundaries** — Once an agent has a token, there's no scoping, no step-up auth for high-stakes actions, no transparency about what it can access.

## The Solution: Token Vault as the Agent's Identity Layer

Auth0 Token Vault manages the OAuth lifecycle so our agent can securely access user-connected services:

### Connected Services

| Service | What the Agent Does | OAuth Scope |
|---------|-------------------|-------------|
| **Slack** | Sends portfolio alerts, rebalance receipts, and inflation warnings to the user's chosen channel | `chat:write`, `channels:read` |
| **Google Sheets** | Logs every rebalance, fee, and P&L entry to the user's spreadsheet — their audit trail | `spreadsheets`, `drive.file` |
| **Gmail / Email** | Sends weekly protection summaries and urgent devaluation alerts | `gmail.send` |
| **Zapier** | Triggers user-defined automations (e.g., "when agent rebalances, update my Notion") | Zapier OAuth |

### How It Works

```
User connects Slack via Auth0 Universal Login
  → Auth0 handles OAuth consent + token exchange
  → Token Vault stores + refreshes tokens
  → Agent requests token from Vault at execution time
  → Agent posts rebalance receipt to user's #diversifi-alerts channel
  → User revokes access anytime from their DiversiFi dashboard
```

### Security Model (Maps to Judging Criteria)

| Principle | Implementation |
|-----------|---------------|
| **Explicit permission boundaries** | Agent can only access services the user has connected. On-chain actions bounded by ERC-7715 session keys (spending limit + time). Off-chain actions bounded by OAuth scopes via Token Vault. |
| **Credential protection** | No OAuth tokens stored in our database. Token Vault handles storage, rotation, and refresh. Agent receives short-lived tokens at execution time only. |
| **Scoped access** | Slack: write-only to a specific channel. Sheets: single spreadsheet. Gmail: send-only. No read access to messages, contacts, or files. |
| **Step-up authentication** | High-value rebalances (>$500) or new service connections trigger step-up auth via Auth0. |
| **User control & transparency** | Dashboard shows all connected services, what scopes are granted, when tokens were last used, and one-click revocation. |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   DiversiFi Frontend                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Protection   │  │ Advisor Chat │  │ Connected       │ │
│  │ Dashboard    │  │              │  │ Services Panel  │ │
│  └─────────────┘  └──────────────┘  └────────┬────────┘ │
└──────────────────────────────────────────────┬───────────┘
                                               │
                              Auth0 Universal Login (OAuth consent)
                                               │
┌──────────────────────────────────────────────┼───────────┐
│                   DiversiFi Backend                       │
│                                              │           │
│  ┌─────────────────────────────────────────┐ │           │
│  │ Guardian Agent (Autonomous Execution)    │ │           │
│  │                                         │ │           │
│  │  1. Analyze inflation data              │ │           │
│  │  2. Decide rebalance action             │ │           │
│  │  3. Execute swap (ERC-7715 session key) │ │           │
│  │  4. Request tokens from Token Vault ◄───┼─┘           │
│  │  5. Post receipt to user's Slack        │             │
│  │  6. Log to user's Google Sheet          │             │
│  └─────────────────────────────────────────┘             │
│                         │                                │
│              ┌──────────┼──────────┐                     │
│              ▼          ▼          ▼                      │
│         ┌────────┐ ┌────────┐ ┌────────┐                 │
│         │ Mento  │ │OpenClaw│ │ Token  │                 │
│         │ (Swap) │ │ (Exec) │ │ Vault  │                 │
│         └────────┘ └────────┘ └────────┘                 │
└──────────────────────────────────────────────────────────┘
```

### Dual Permission Model

DiversiFi uniquely combines two authorization layers:

1. **On-chain (ERC-7715):** User signs a session key granting the agent permission to swap up to $X/day for Y days. Enforced by smart contract policy.
2. **Off-chain (Auth0 Token Vault):** User grants OAuth consent for the agent to access their Slack/Sheets/Email. Enforced by Auth0 + provider scopes.

Both layers are user-initiated, explicitly scoped, time-bounded, and independently revocable.

## User Control & Consent UX

### Connected Services Panel

Users manage all agent permissions from one place:

- **See** which services are connected and what scopes are active
- **Connect** new services via Auth0 Universal Login (familiar OAuth consent screen)
- **Revoke** any service with one click — agent immediately loses access
- **Audit** when the agent last used each connection and what it did

### Async Authorization

When the agent needs a service the user hasn't connected yet:

1. Agent pauses the action
2. User receives an in-app prompt: _"Your advisor wants to send rebalance receipts to Slack. Connect?"_
3. User completes OAuth flow at their convenience
4. Agent resumes with the new token

This maps directly to Token Vault's async auth capability.

## Potential Impact

- **Emerging market users** get personalized, multi-channel financial alerts in the tools they already use
- **Pattern for the ecosystem:** Demonstrates how financial AI agents should handle off-chain credential delegation — not just on-chain permissions
- **Trust through transparency:** Users see exactly what their agent can do, both on-chain and off-chain, in one dashboard

## Technical Stack

| Layer | Technology |
|-------|------------|
| Auth & Token Management | **Auth0 for AI Agents (Token Vault)** |
| Smart Accounts | Privy + Safe (ERC-4337) |
| Agent Permissions (on-chain) | ERC-7715 session keys |
| AI Reasoning | Venice AI (primary), Gemini (fallback) |
| Execution | Mento Protocol, OpenClaw Gateway |
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Data | World Bank, IMF, FRED (public APIs) |

## Links

- **GitHub:** [https://github.com/thisyearnofear/diversify](https://github.com/thisyearnofear/diversify)
- **Live App:** [https://diversifiapp.vercel.app](https://diversifiapp.vercel.app)
- **Demo Video:** [Link TBD]

---

_Submitted for the Authorized to Act: Auth0 for AI Agents Hackathon (April 2026)._
