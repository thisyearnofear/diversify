# Security notes

**Last pass:** 2026-07-12 — three-agent review (API routes, secrets/config,
on-chain money movement), every finding verified against the code before fixing.

## Standing model

- **Frontend** on Vercel (static + client bundle); **backend API** on Hetzner.
  Only `NEXT_PUBLIC_*` env vars are inlined into the client bundle — every other
  `process.env.*` is server-only (`undefined` in the browser). Secrets must
  therefore NEVER be prefixed `NEXT_PUBLIC_`.
- Secrets live in gitignored `.env.local` and on the server via surgical
  env-append (backup first, no clobber). Session keys that appeared in chat get
  rotated. No secrets are committed (verified against git history).
- The paid money surfaces (`best-yield`/vaults.fyi, `speak`/`transcribe`,
  `web-search`) are **unauthenticated** — the app has no wallet-auth yet. Until
  it does, they are protected by defense-in-depth: per-IP rate limits + a
  process-global daily budget breaker on the paid call itself.

## 2026-07-12 findings & fixes

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 1 | **CRITICAL** | `best-yield` trusts client-claimed engagement (`savedUsd`/`streak`) to unlock paid vaults.fyi calls (~$0.20 each); unique addresses bust the cache → unbounded cost-drain. | Process-global daily budget breaker in `vaults-fyi.service` (`VAULTS_FYI_MAX_PAID_CALLS_PER_DAY`, default 50) consumed only on a real cache miss + per-IP rate limit on the route. Bounds worst-case spend regardless of client lies. |
| 2 | HIGH | `speak`/`transcribe` unauthenticated paid TTS/STT → cost amplification. | Per-IP rate limit (20/min each). |
| 3 | MED | `analytics/event` unauthenticated write sink → Mongo flood. | Per-IP rate limit (60/min), silently drops over-limit (204). NOTE: this route is same-origin on **Vercel serverless**, so the in-memory limiter is best-effort (cold instances reset it) — adequate for a PII-free 90-day-TTL sink; move to Redis if it needs to be a hard cap. |
| 4 | MED | GMX GM receiver was caller-supplied `params.userAddress`, not bound to the funding signer → mismatch = signer pays, other address receives GM. | Bind receiver to `signer.getAddress()`; refuse if a supplied `userAddress` disagrees. (Not exploitable in the live `useSwap` flow, which already sets `userAddress = signer`; defense-in-depth.) |
| 5 | MED | GM-price slippage floor trusts the caller's RPC + tickers host with no bounds/timeout → inflated price collapses the floor. | Sanity-band the GM price ($0.05–$1000, out-of-band ⇒ refuse); 5s fetch timeout; `maximize:false` for a conservative floor. |
| 6 | LOW | Execution fee scales with `getGasPrice()` with no ceiling → spoofed gas locks large ETH until refund. | Cap `executionFee` at 0.02 ETH. |
| 7 | LOW | `web-search` (free TinyFish) unauthenticated → quota burn / open search proxy. | Per-IP rate limit (20/min). |
| 8 | LOW | `setup-arc-agent.js` instructed `NEXT_PUBLIC_CIRCLE_API_KEY` (would bake a secret into the client). Inert (nothing reads it). | Guidance corrected to server-only `CIRCLE_API_KEY` with a warning. |

**Sound, no action (money movement):** exact `approve(router, shortAmount)`
(never MaxUint); ExchangeRouter/Router/DepositVault hardcoded + Arbiscan-verified
+ mainnet-validated; blue-chip WBTC/WETH index filter (a spoofed market reverts,
can't redirect funds); single atomic multicall, `callbackContract = AddressZero`
(no reentrancy); GMX refunds excess execution fee to the receiver; the deposit
flag is build-time inlined (can't be flipped on at runtime).

## Durable follow-ups (not yet done)

- **Wallet auth** on the money routes (sign-in-with-Ethereum / signature over a
  nonce) so `userAddress` is *proven*, then derive engagement server-side from
  the authenticated address's real on-chain balance + streak. This retires the
  "trusts client engagement" root cause; the budget breaker + rate limits are
  the interim damage cap, not the cure.
- Move the rate-limit / budget counters to Redis/Mongo if the API is ever
  sharded (they're in-memory / single-process today). The paid surfaces
  (best-yield/speak/transcribe/web-search) run on the **Hetzner API** (PM2,
  persistent single process), so the in-memory counters ARE effective there;
  only `analytics/event` (Vercel serverless) is best-effort.
- Pre-existing: some free-tier price API keys are `NEXT_PUBLIC_` (client-baked).
  Low risk (free, rate-limited providers) but worth proxying server-side later.
