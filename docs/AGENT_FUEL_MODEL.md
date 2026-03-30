# The Agent Fuel Model (2026)

The **Agent Fuel Model** is the economic engine of DiversiFi's autonomous layer. It replaces the traditional "Gas Sponsorship" model with a sustainable, user-funded "Machine-to-Machine" (M2M) economy.

## Core Philosophy

1.  **User Sovereignty**: The user owns the capital. The Guardian is a *leaser* of that capital, operating within strict boundaries.
2.  **Pay-as-you-Go**: No subscriptions. Users pay only for the compute, data, and execution they actually use.
3.  **Invisible Complexity**: The user sees "Fuel" (USDC). The Agent handles gas tokens, bridging, and execution fees.

## Architecture: The "Fuel Tank"

The **Fuel Tank** is a dedicated **Circle MPC Sub-Wallet** created for each user on **Arc L1**.

*   **Currency**: **USDC (Native)**. On Arc L1, USDC is the gas token. This eliminates the need for users to hold ETH, MATIC, or CELO just to power their agent.
*   **Funding**: Users "Top Up" their Fuel Tank by sending USDC to their unique Agent Address (displayed in the UI).
*   **Security**: The wallet is custodied by Circle's MPC infrastructure but "controlled" programmatically by DiversiFi Guardian logic, scoped by **ERC-7715 session-key permissions**.

## Economic Flows

### 1. Nanopayments (Data & Premium Signals)
The Guardian uses **EIP-3009 (Transfer with Authorization)** to pay for premium data feeds (x402 protocol) instantly.
*   **Cost**: ~$0.01 - $0.05 per query.
*   **Mechanism**: Agent signs an authorization; Data Provider submits it to the chain.
*   **User View**: "Fuel Level" decreases slightly.

### 2. Execution (Yield & Swaps)
When the Advisor identifies an opportunity and the Guardian is authorized to act, the Guardian bridges fuel or executes natively.
*   **Step 1**: Advisor or Guardian identifies a yield or risk-management opportunity.
*   **Step 2**: User either approves the action or relies on an existing Guardian permission scope.
*   **Step 3**: Guardian burns/teleports USDC using Circle CCTP to the target Spoke (Celo/Arbitrum).
*   **Step 4**: Guardian submits the transaction directly or via **OpenClaw Gateway** where appropriate.
*   **Step 5**: Execution completes on-chain and gas is covered from the Fuel Tank.
*   **Step 6**: Guardian records receipts and triggers downstream automation.

### 3. Autonomy Leases (The "Allowance")
The user sets a **Daily Spending Limit** (e.g., $10/day).
*   The Guardian *cannot* spend more than this limit without explicit user approval.
*   This creates a "Sandbox" where the AI can be aggressive with small amounts (searching for alpha) without risking the user's life savings.

### 4. OpenClaw Execution Tracks
OpenClaw supports multiple execution "tracks" for different agent behaviors:
*   **base-autonomous-trading** — Standard yield farming and rebalancing
*   **tether-galactica-wdk** — Tether WDK settlement with USD₮/XAU₮ across chains
*   **status-l2-gasless** — Gas-optimized L2 executions
*   **open-track** — Custom user-defined strategies

Each track has its own receipt stream and audit trail for transparent accounting.

## User Experience (UI)

*   **The Gauge**: A visual "Fuel Tank" showing the remaining USDC balance.
*   **The Top-Up**: A simple QR code / Address copy to send funds.
*   **The Receipt**: A real-time feed of "What did my Guardian spend money on?" (for example, "Paid $0.02 for real-time inflation data").
*   **Execution Status**: Guardian receipts show transaction hash, chain, status, duration, and explorer link for full transparency.
*   **Track Selection**: Users can view which execution track their Guardian is using (for example, "Tether WDK" for Galactica hackathon).

## Why Arc L1?
*   **Native USDC Gas**: The single biggest friction point in Web3 (gas tokens) is removed.
*   **Sub-Second Finality**: Essential for "High-Frequency" AI decisions.
*   **Institutional Grade**: Circle's compliance infrastructure ensures the Guardian operates within regulatory guardrails.

## Future Roadmap
*   **Fuel Sharing**: Allow a "Family Plan" where multiple Guardians draw from a shared Fuel Tank.
*   **Agent-to-Agent Commerce**: Your Guardian pays another user's agent for a specific dataset or strategy.
