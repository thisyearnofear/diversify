# The Agent Fuel Model (2026)

The **Agent Fuel Model** is the economic engine of DiversiFi's Autonomous AI. It replaces the traditional "Gas Sponsorship" model with a sustainable, user-funded "Machine-to-Machine" (M2M) economy.

## Core Philosophy

1.  **User Sovereignty**: The user owns the capital. The AI is a *leaser* of that capital, operating within strict boundaries.
2.  **Pay-as-you-Go**: No subscriptions. Users pay only for the compute, data, and execution they actually use.
3.  **Invisible Complexity**: The user sees "Fuel" (USDC). The Agent handles gas tokens, bridging, and execution fees.

## Architecture: The "Fuel Tank"

The **Fuel Tank** is a dedicated **Circle MPC Sub-Wallet** created for each user on **Arc L1**.

*   **Currency**: **USDC (Native)**. On Arc L1, USDC is the gas token. This eliminates the need for users to hold ETH, MATIC, or CELO just to power their agent.
*   **Funding**: Users "Top Up" their Fuel Tank by sending USDC to their unique Agent Address (displayed in the UI).
*   **Security**: The wallet is custodied by Circle's MPC infrastructure but "controlled" programmatically by the DiversiFi Agent logic, scoped by **ERC-6900** permissions.

## Economic Flows

### 1. Nanopayments (Data & Oracle)
The Agent uses **EIP-3009 (Transfer with Authorization)** to pay for premium data feeds (x402 protocol) instantly.
*   **Cost**: ~$0.01 - $0.05 per query.
*   **Mechanism**: Agent signs an authorization; Data Provider submits it to the chain.
*   **User View**: "Fuel Level" decreases slightly.

### 2. Execution (Yield & Swaps)
When the Agent identifies an opportunity (e.g., higher yield on Arbitrum), it uses **Circle CCTP** to teleport fuel.
*   **Step 1**: Agent burns USDC on Arc L1.
*   **Step 2**: Circle mints USDC on Arbitrum.
*   **Step 3**: Agent executes the swap/deposit on Arbitrum.
*   **Step 4**: Agent bridges the *profit* back to the Fuel Tank (or reinvests it).

### 3. Autonomy Leases (The "Allowance")
The user sets a **Daily Spending Limit** (e.g., $10/day).
*   The Agent *cannot* spend more than this limit without explicit user approval.
*   This creates a "Sandbox" where the AI can be aggressive with small amounts (searching for alpha) without risking the user's life savings.

## User Experience (UI)

*   **The Gauge**: A visual "Fuel Tank" showing the remaining USDC balance.
*   **The Top-Up**: A simple QR code / Address copy to send funds.
*   **The Receipt**: A real-time feed of "What did my Agent spend money on?" (e.g., "Paid $0.02 for Real-Time Inflation Data").

## Why Arc L1?
*   **Native USDC Gas**: The single biggest friction point in Web3 (gas tokens) is removed.
*   **Sub-Second Finality**: Essential for "High-Frequency" AI decisions.
*   **Institutional Grade**: Circle's compliance infrastructure ensures the Agent operates within regulatory guardrails.

## Future Roadmap
*   **Fuel Sharing**: Allow a "Family Plan" where multiple agents draw from a shared Fuel Tank.
*   **Agent-to-Agent Commerce**: Your Agent pays another user's Agent for a specific dataset or strategy.
