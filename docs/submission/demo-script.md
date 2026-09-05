# Demo video script — DiversiFi × Future Caribbean

**Format:** Loom/Drive link, target **4:15** (hard cap 5:00 — we stay under so nothing can disqualify).
**Route:** guided screen recording. You record; this is the shot list + talk track. FX coordination first, savings surface second.

**Before recording (the disqualification checklist):**
- Private-window check: open the Drive link AND the GitHub repo logged-out. Both must load.
- Close every other tab; hide bookmarks bar; one clean browser profile.
- No credentials, no `.env`, no terminal with keys on screen — ever. The video is public and goes on Future Caribbean's social channels.
- Pick light or dark mode, keep it consistent for the whole video.
- Record at 1440p if Loom allows; keep the browser window ~1440×900 so text is readable after compression.

---

## Shot list + talk track

### 0:00–0:25 — The problem (voice over a static slide or the docs page)

**On screen:** One clean slide (or `docs/submission/future-caribbean.md` problem section).

**Say:** *"A hotel in Trinidad pays a supplier in Jamaica by routing Barbados dollars into US dollars, then into Jamaican dollars. That costs around seven percent in corridor fees, takes days, and depends on banks outside our region. The Caribbean has the liquidity — it can't see or coordinate it. DiversiFi is the coordination layer: match currency needs directly, net them, and settle — without the USD bridge."*

### 0:25–1:00 — The system diagram (voice over `docs/submission/agentic-workflow.md` rendered)

**On screen:** The mermaid flowchart from `agentic-workflow.md` (GitHub renders it natively — open it on the repo).

**Say:** *"Here's the whole loop. Businesses post what they need to sell and buy. A deterministic matching engine pairs opposing needs directly at mid-market — no USD anywhere. Many small matches net into a few large settlements. The debtor pays from their own wallet — nobody ever custodies funds — the server verifies the transfer on-chain, and the receipt lands on a public ledger on Celo, with the same contract address live on Arbitrum, HashKey, and 0G. The AI layer advises and explains — it never computes a settlement and never moves money. That division is deliberate."*

### 1:00–1:20 — Post the intent

**On screen:** App → Exchange tab → FX Corridor → Caribbean FX Net card. Fill the intent form: sell BBD, buy JMD, amount, deadline. Submit.

**Say:** *"Live product. I'm posting an intent: sell Barbados dollars, buy Jamaican dollars — a real Trinidad-to-Jamaica supplier payment. This lands in the hosted intent pool."*

### 1:20–1:50 — The match

**On screen:** Second browser profile (or a pre-recorded clip / picture-in-picture of it): the opposing intent — sell JMD, buy BBD. Then back to profile one: refresh, the match appears.

**Say:** *"A second participant — this is a separate browser, separate wallet — posts the opposing flow. The engine matches them directly, BBD to JMD, at mid-market. Watch the savings line: it computes what this just saved against the seven-percent bank corridor, per match. The system measures the value it creates."*

### 1:50–2:30 — Net settlement, on-chain

**On screen:** Match review → settlement plan. Show the net obligation. Execute: wallet popup (testnet), confirm. Then the explorer: switch to Celo explorer, show an FX_SETTLE receipt tx.

**Say:** *"Here's the netting: many matches collapse into one net obligation — that's the capital-efficiency piece banks care about. Settlement is zero-custody: I pay from my own wallet. The server doesn't trust my claim — it reads the Transfer event from the chain, checks token, debtor, creditor, and amount, and only then marks it settled. And it anchors the receipt on-chain. This is a real receipt on Celo mainnet — every anchor is publicly verifiable, including by the contract's own RPC check."*

### 2:30–3:10 — Verifiable proof (the trust layer)

**On screen:** The ledger/proof feed UI (Shield tab, unconnected — LiveProofTicker) → tap "Verified · Evidence mirrored" → show `?verify=` on a tx hash → Celo explorer tab with the Agentic ID contract `0x6815…` and token #1.

**Say:** *"Everything the AI touches leaves verifiable evidence. The Guardian — our autonomous advisory agent — runs on a heartbeat, and each recommendation is anchored to 0G Storage and recorded on-chain with its reasoning. This is our agent identity, an ERC-721 minted on 0G mainnet. The point: you don't have to trust our dashboard. Every claim resolves against a public chain."*

### 3:10–3:50 — The savings surface (liquidity on-ramp)

**On screen:** Home tab (Kenya/KES persona or a Caribbean persona — pick Jamaica/JMD for this video): the currency-risk moment, philosophy pick (Pan-Caribbean), the Shield ring.

**Say:** *"The coordination layer needs liquidity, and the region already has it — it's just scattered. This is the on-ramp. A visitor sees what their own money lost — Jamaican dollars against gold, against the US dollar — picks the lens that matches their values — this is the Pan-Caribbean plan — and gets a protection plan. Diaspora remittances and SME treasuries flow in as savings — and become matched FX liquidity. Remittance capital redirected into coordination, not just consumption."*

### 3:50–4:15 — Close

**On screen:** Back to the system diagram, or one closing slide.

**Say:** *"The Caribbean doesn't lack capital. It lacks systems that move it. DiversiFi is one working system — matched, netted, settled, verifiable — built Caribbean-first and generalized: the same engine nets GHS to NGN, any pair, any region. Open source, MIT licensed, live on mainnet today. Thank you."*

---

## Recording notes

- **The engine is the star.** If the two-profile matching demo feels heavy to coordinate live, pre-record the second profile's intent submission as a short clip and play it picture-in-picture — judges care that the flow is real, not that it's one continuous take.
- **Wallet popup:** blur/avoid any recovery phrases or account labels. A fresh testnet-only wallet on camera is safest.
- **If the app hiccups on camera:** keep the explorer + diagram fallbacks ready (shots 2 and 5 work standalone).
- **Speak slightly slower than feels natural** — compression eats consonants.
- **Loom upload settings:** public link, allow comments off if you prefer, then the logged-out private-window test of the exact link you'll submit. Do not edit/replace the video after the deadline — no edits after submissions close.
- **Also update `docs/submission/logbook.md`** with a final entry pointing at the video link — the logbook is a key judges' input and should reference the submission artifacts.
