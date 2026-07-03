# Agent Identity — ERC-8004 + Self Protocol

The DiversiFi Guardian agent has two on-chain identity registrations:

1. **ERC-8004 Identity Registry** (8004scan) — portable, censorship-resistant
   agent identity. Discoverable across the agent ecosystem.
2. **Self Protocol Agent ID** — ERC-8004 compliant registry on Celo with
   Proof-of-Human extension. Sybil-resistant: each agent is backed by a ZK
   passport verification, so one human = one agent.

Both are ERC-8004 compliant. Self Protocol adds the human-verification layer
on top.

## Current Registration Status

| Registry | Agent ID | Chain | Owner | Verified |
|---|---|---|---|---|
| ERC-8004 Identity Registry | 9654 | Celo mainnet (42220) | `0x3542916a…Af48` | N/A (no proof-of-human on this registry) |
| Self Protocol Agent ID | *(mainnet)* | Celo mainnet (42220) | `0xE8cDb7CA…f170` | Yes — real passport, mainnet verification |

**ERC-8004 tx:** [`0xb698d493…`](https://celoscan.io/tx/0xb698d493282c1826546cb4a78258cf1cdff33f325770917cd215c4c90f14e5d1)

**Self Protocol:** Registered on Celo mainnet (registry `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944`) with a real passport scan via the Self app. The agent is verified on-chain with proof-of-human — sybil-resistant, one agent per human. Agent address: `0xE8cDb7CA…f170`.

**Agent signing key:** `0xE8cDb7CAB1D28CbeE97dE85c27b7ab1f7661f170` (Self Protocol mainnet agent address).

---

## ERC-8004 Registration (8004scan)

### What it is

The ERC-8004 Identity Registry is an ERC-721 + URIStorage contract. Each
agent is an NFT: `tokenId` = `agentId`, `tokenURI` = `agentURI` → a JSON
registration file describing the agent.

Deployed at the same address on all supported mainnets:
`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`

Testnet address: `0x8004A818BFB912233c491871b3d84c89A494BD9e`

### Files

| File | Purpose |
|---|---|
| `public/.well-known/erc8004.json` | The agent registration file (hosted at the agentURI). Describes the agent per the ERC-8004 schema: type, name, description, image, services, x402Support, supportedTrust. |
| `scripts/register-erc8004.ts` | Mints the agent NFT on the Identity Registry. Reads the registration file URL, calls `register(agentURI)`, parses the `Registered` event for the agentId, and updates the registration file with the real agentId. |

### How to register

```bash
# Celo mainnet (requires funded wallet with CELO for gas)
npx tsx scripts/register-erc8004.ts

# Celo Sepolia (testnet)
npx tsx scripts/register-erc8004.ts --testnet

# Other chains
npx tsx scripts/register-erc8004.ts --chain=arbitrum
```

Requires `PRIVATE_KEY` or `VAULT_PRIVATE_KEY` (see `.env.example`).

After registration, the agent appears on [8004scan.io](https://8004scan.io/agents)
and the agentId is written back into `public/.well-known/erc8004.json`.

### Updating the registration file

If the agent's metadata changes (new services, updated description), update
`public/.well-known/erc8004.json` and call `setAgentURI(agentId, newURI)` on
the registry. The registration file is served via the live app at
`https://diversifiapp.vercel.app/.well-known/erc8004.json`.

---

## Self Protocol Agent ID

### What it is

Self Protocol's Agent ID is an on-chain identity registry on Celo that binds
AI agent identities to Self Protocol human proofs. Each agent receives a
soulbound (non-transferable) ERC-721 NFT backed by a ZK passport verification.

It implements the ERC-8004 Identity Registry interface **plus** the
`IERC8004ProofOfHuman` extension — adding sybil resistance (one human → one
agent via nullifier tracking).

| Network | Chain ID | Registry Address |
|---|---|---|
| Celo Mainnet | `42220` | `0xaC3DF9ABf80d0F5c020C06B04Cced27763355944` |
| Celo Sepolia | `11142220` | `0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379` |

### Files

| File | Purpose |
|---|---|
| `packages/shared/src/services/self-agent-service.ts` | Service layer: `getSelfSigningAgent()` for signing outbound requests, `getSelfAgentVerifier()` for verifying inbound agent requests, `isVerifiedAgent()` for on-chain status checks. |
| `components/agent/SelfAgentRegistration.tsx` | React component rendering a QR code. The agent owner scans with the Self app → ZK proof submitted on-chain → soulbound NFT minted. |

### How to register

Registration is interactive — it requires the agent owner to scan their
passport with the Self app (ZK proof generated locally on phone, no personal
data leaves the device).

1. Mount `<SelfAgentRegistration humanAddress={walletAddress} />` in the app.
2. The user scans the QR with the Self app.
3. On testnet, mock documents can be generated in the app — no real passport.
4. On success, a soulbound NFT is minted. **Save the agent private key** —
   it's the agent's signing key and cannot be recovered.
5. Store the private key securely — it is the agent's signing key and cannot be recovered.

### Signing requests as the agent

```typescript
import { getSelfSigningAgent } from '@diversifi/shared';

const agent = getSelfSigningAgent();
const res = await agent.fetch('https://some-service.example.com/api', {
  method: 'POST',
  body: JSON.stringify({ action: 'rebalance' }),
});
```

The SDK attaches three headers to every request:
- `x-self-agent-address` — the agent's Ethereum address
- `x-self-agent-signature` — ECDSA signature
- `x-self-agent-timestamp` — Unix timestamp (seconds)

### Verifying agent requests (middleware)

```typescript
import { getSelfAgentVerifier } from '@diversifi/shared';

const verifier = getSelfAgentVerifier();
// Use as middleware on API routes that accept agent requests
```

Default security: Self Protocol provider required, one agent per human,
replay protection enabled, 5-minute timestamp window.

---

## Relationship between the two

Both registries implement ERC-8004. The 8004scan registry is the generic,
cross-chain standard. Self Protocol's registry is ERC-8004 + Proof-of-Human,
deployed on Celo.

Registering on both gives the DiversiFi Guardian:
- **Discoverability** via 8004scan.io (the ERC-8004 explorer)
- **Sybil resistance** via Self Protocol (proof-of-human on Celo)

The `agentURI` for both can point to the same registration file
(`public/.well-known/erc8004.json`), since the schema is compatible.

---

## Environment variables

| Variable | Purpose |
|---|---|
| `PRIVATE_KEY` or `VAULT_PRIVATE_KEY` | Used by `register-erc8004.ts` to pay gas for the mint transaction. |
| `AGENT_PRIVATE_KEY` | The Self Protocol agent's signing key. Used by `self-agent-service.ts` to sign outbound requests. Store securely — never commit to the repo. |
| `AGENT_URI` | URL where the ERC-8004 registration file is hosted. Defaults to `https://diversifiapp.vercel.app/.well-known/erc8004.json`. |
