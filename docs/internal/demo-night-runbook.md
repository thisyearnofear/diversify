# Demo night runbook: the walletless NGN walkthrough

Three minutes, no wallet, no keys on stage. The audience watches one
currency's story go from a number to a dated history to a question the
Guardian can take, and then sees where a wallet would come in. Nothing is
signed, nothing is bought, and nothing on screen is invented.

The path uses only controls that already exist:

**Explore app → HOME → Story of the NGN → headline (only if shown) → Ask
Guardian about the NGN → Close chat → Sign in / Connect Wallet (header)**

The story line to carry through: *you set the rules, the Guardian operates
within them, and every decision is explainable and verifiable.* Tonight we
show the "explainable" part from the saver's side. Do not stretch it into
claims about execution or returns.

---

## 1. Preflight (before the clock starts, about 15 minutes)

Do all of this off stage. None of it counts toward the 180 seconds.

### 1.1 Local app on port 3042

```bash
pnpm install
pnpm exec turbo run build --filter=@diversifi/shared --filter=@stable-station/mento-utils
pnpm dev            # Next.js on http://localhost:3042
```

- Open `http://localhost:3042/` once and wait for the first compile. A cold
  dev server can take 30 seconds or more for the first page; never let the
  audience see that.
- If you are presenting from the deployed app instead, run the same checks
  below against that URL. The checks matter more than where the app runs.

### 1.2 Two profiles: rehearsal and stage

You need two separate browser profiles (or two separate private windows that
share nothing), both set up the same way:

- No wallet extension signed in, no saved Privy session and no earlier
  DiversiFi tabs or site data.
- "Do Not Track" off if you want to see analytics emit in rehearsal (see
  1.6). The helper sends nothing when `navigator.doNotTrack === '1'`.
- The window size and zoom you will project, so the Home figure and the
  story trail are readable from the back row.
- Every other tab closed. The headline link opens a new tab, and you want
  to get back in one keystroke.

The two profiles have different jobs:

- **Rehearsal profile (throwaway).** Every tap in 1.3 to 1.6 happens here:
  `Explore app`, Home, the story, the news check, the Guardian ask, `Connect
  Wallet` and the analytics check. Treat it as used up afterwards.
- **Stage profile (untouched).** Open `http://localhost:3042/` in it, wait
  until the welcome screen shows "Make a plan for your money." and the
  `Explore app` button, and then stop. Do not click anything in it before
  the clock starts.

Why the stage profile must stay untouched: `Explore app` completes
onboarding and saves that in the profile's local storage. From then on, the
page opens straight into the app on every load. **Reloading the tab does not
bring the welcome screen back**, so a stage profile that has been explored
can no longer show the 0:00 cold open. If you touch it by mistake, throw it
away and open a new fresh profile; do not try to reset it by hand.

Right before you walk on, look at the stage profile once more: the welcome
screen with `Explore app` must be visible. If it is not, swap in a new fresh
profile.

### 1.3 Walk the real controls once (rehearsal profile)

In the rehearsal profile, tap through the whole path and confirm each label
exists exactly as written:

| Step | Control you should see |
|---|---|
| Welcome | `Explore app` |
| Dock | `HOME` (the app lands on `SHIELD` first) |
| Home | `Story of the NGN` and the line "Country not detected — showing Nigeria by default. Sample figures until you connect." |
| Story stage | year chips in the trail (for example `2025 · First annual gain in 13 years`), the line `Curated history · checked <date>`, and `Ask Guardian about the NGN →` |
| Guardian | the chat opens with the NGN question already sent, and a `Close chat` button |
| Header | `Sign in` when Privy is configured (and no browser wallet is injected), otherwise `Connect Wallet` |

If Home shows a different currency (because your network reports a
country), the button reads `Story of the <code>`. That is fine. Do not pick
a currency in the stage profile to "fix" it, because that means exploring
it. The script already has lines for both states, and you choose between
them on stage at 0:15 from what the stage screen shows:

- **Not detected:** the "Country not detected — showing Nigeria by default.
  Sample figures until you connect." line is on screen. Use the
  *not detected* lines.
- **Detected:** that line is absent. Use the *detected or picked* lines, and
  say the currency name and code shown on screen wherever the script says
  NGN or naira.

What the rehearsal tells you is what to **expect**, not what the stage will
show. The detected country, the figures, the trail's newest chip and its
"checked" date can all differ by the time you present. **Read every number
from the stage screen at the moment the script reaches it. Do not memorise
them from rehearsal or from this document.**

### 1.4 Readiness: four separate services

Each of these can be up or down on its own. Fixing one does not fix the
others. Check each in the rehearsal profile (or from a terminal) and note
the branch you **expect**. On stage you still take the branch the screen
shows.

| Service | What it powers | How to check | If it is down |
|---|---|---|---|
| **Research (Tavily)** | "In the news" headlines in the story | `curl -s "http://localhost:3042/api/agent/currency-news?code=NGN"` and look at `items`; then open the story in the rehearsal profile | Branch B in 1:35 |
| **Guardian AI** | The answer in the chat | Tap `Ask Guardian about the NGN →` in the rehearsal profile. An answer means ready. "Guardian is unavailable right now — no AI provider is configured…" means not ready | Branch B in 1:55 |
| **Login (Privy)** | What the header button (`Sign in` / `Connect Wallet`) opens | Tap the header button in the rehearsal profile and see what appears | Branch B in 2:25 |
| **Analytics emission** | Funnel counts of the walkthrough taps | In the rehearsal profile, Devtools → Network, filter `analytics/event`, then tap through | Not on stage. See 1.6 |

Notes on the research check:

- `items: []` means no news section will render. That is the empty-news
  fallback, and it is the real response, not a mock.
- `provider: "tavily"` on its own does **not** prove a search worked. A
  configured key whose search failed or timed out (the request gives up after
  12 seconds) still answers `provider: "tavily"` with `items: []`. Only
  non-empty `items` mean headlines will show.
- `provider: null` with `items: []` means Tavily is not configured on this
  server. That is what an unconfigured local checkout returns.

When the Guardian is configured, the rehearsal ask uses one of the visitor's
daily Guardian questions in that profile (the chat shows "3 of 3 questions
left today"). That is one more reason the rehearsal and stage profiles must
be different.

### 1.5 Caches can fake either state

Headlines can come from a cache instead of from Tavily, and the rehearsal
result does not carry over to the stage profile. A news check in the
rehearsal profile tells you what the server answered then; it guarantees
nothing about what the stage profile will receive minutes later.

- **In an open tab:** once a story has loaded non-empty headlines, the page
  keeps them in memory for the rest of that page load. Re-opening the story
  will not refetch. Empty results are not kept, so they are retried on the
  next open. This memory belongs to one tab, so the stage profile starts
  without it.
- **At the edge (deployed app):** a configured route answers with
  `Cache-Control: public, s-maxage=900, stale-while-revalidate=3600`. A CDN
  can serve the previous answer, full or empty, for up to 15 minutes, and a
  stale copy for up to an hour more, after Tavily changes state.
- **On the server:** the search service also caches Tavily results in its
  own short-lived cache.

So the stage story makes its own request when you open it at 0:55. Choose
the news branch at 1:35 from what the stage screen shows then: an "In the
news" section means Branch A, no section means Branch B. Both branches take
the same 20 seconds.

### 1.6 Analytics: emission, not storage

Check this in the rehearsal profile only. The walkthrough emits these events
through `trackFunnelEvent` to `POST /api/analytics/event`:

| Tap | Event | Props |
|---|---|---|
| `Story of the NGN` (walletless Home) | `currency_story_opened` | `currency: NGN`, `source: home_walletless` |
| A headline (only when headlines show) | `currency_headline_tapped` | `currency: NGN`, `source: currency_story` |
| `Ask Guardian about the NGN →` | `ask_guardian_tapped` | `currency: NGN`, `source: currency_story` |
| Header `Sign in` / `Connect Wallet` while disconnected | `walletless_connect_tapped` | `source: wallet_button`, `attempt: primary` (or `retry` from `Try again`) |

No address, question text, headline, URL or balance is sent. The endpoint
always answers `204`, including when no database is configured, so a `204`
proves the event was **sent**, not that it was **stored**. Do not tell the
audience the demo is being counted unless you have checked storage
separately.

### 1.7 Expected branches, chosen on stage

From the rehearsal, note what you expect:

- Currency state: **not detected** or **detected**.
- Headlines: **A** (shown) or **B** (empty-news fallback).
- Guardian: **A** (answers) or **B** (unavailable).
- Login: **A** (Privy sign-in opens) or **B** (wallet guidance only).

These notes only prepare you. On stage, each choice is made from the stage
screen at its own time slot: currency state at 0:15, headlines at 1:35,
Guardian at 1:55 and login at 2:25. Every branch fits the same time slot, so
the total stays 180 seconds.

---

## 2. The 180-second script

Bold lines are spoken. Plain text is what you do. Times are wall clock from
when you start talking.

| Segment | Duration |
|---|---|
| 0:00–0:15 Cold open | 15 s |
| 0:15–0:30 Into Home | 15 s |
| 0:30–0:55 The reading | 25 s |
| 0:55–1:35 The story | 40 s |
| 1:35–1:55 The news, or its absence | 20 s |
| 1:55–2:25 Hand it to the Guardian | 30 s |
| 2:25–2:45 Where a wallet comes in | 20 s |
| 2:45–3:00 Close | 15 s |
| **Total** | **180 s** |

### 0:00–0:15 — Cold open (15 s)

Screen: welcome screen, "Make a plan for your money."

> **"Most savings apps start by asking for your wallet. This one starts by
> asking what your money has been through. No wallet, no sign-up. Watch."**

### 0:15–0:30 — Into Home (15 s)

Click `Explore app`. The app lands on Shield. Click `HOME` in the dock.

Say the line that matches what the stage screen shows now (see 1.3).

*Not detected:*

> **"Explore app, then Home. Home is one reading about one currency. It
> guessed Nigeria because it can't see my country, and it says so."**

Point at "Country not detected — showing Nigeria by default."

*Detected or picked:*

> **"Explore app, then Home. Home is one reading about one currency, here
> [currency on screen]."**

Point at the currency control. Do not say the app guessed or detected
anything unless the screen says so.

### 0:30–0:55 — The reading (25 s)

Point at the big figure and the line under it. Read them exactly as shown,
including whether buying power fell, rose or held steady, and the benchmark
named on screen.

*Not detected:*

> **"[Period on screen] against [benchmark on screen], naira buying power
> [fell / rose / held steady, as shown] [figure on screen]. Notice the line
> above it: sample figures until you connect. The amount is illustrative.
> The change is the currency's, not mine."**

*Detected or picked:*

> **"[Period on screen] against [benchmark on screen], [currency on screen]
> buying power [fell / rose / held steady, as shown] [figure on screen].
> The amount is one you can change. The change is the currency's, not
> mine."**

In the detected or picked state there is no "sample figures" line on
screen, so do not point at one. Both versions fit the same 25 seconds. Do
not change the amount, period or benchmark. Every extra tap costs time.

### 0:55–1:35 — The story (40 s)

Click `Story of the NGN`. The Home stage turns into the story in place.

> **"A number tells you that something happened. The story tells you
> what."**

Pause on the newest chip, then click one older chip in the trail (for
example the 2025 chip). Read its one line.

> **"Each of these is a dated event someone checked by hand. Here's
> [year]: [the line on screen]."**

Point at `Curated history · checked [date]`.

> **"And it tells you when it was checked. This is history, not a feed. It
> doesn't pretend to be today's news, and it doesn't predict tomorrow."**

### 1:35–1:55 — The news, or its absence (20 s)

**Branch A — "In the news" is shown.**
Click one headline. It opens the source in a new tab. Show the source for a
second, close that tab (`Ctrl/Cmd+W`) and come back to the story.

> **"When there is fresh reporting, it sits below the history with its
> source and date, and it opens the original. Cited, not summarised into a
> forecast."**

**Branch B — no news section (empty-news fallback).**
Do not scroll looking for it. Stay on the trail.

> **"Live headlines aren't available right now, so the app shows none. It
> doesn't make any up. What you're looking at is curated, dated currency
> history, not fresh news, and that's enough to ask a good question."**

### 1:55–2:25 — Hand it to the Guardian (30 s)

Click `Ask Guardian about the NGN →`. The story closes first, then the
Guardian chat opens with the NGN question already sent.

> **"One tap carries the question, and the context, to the Guardian. I
> didn't type anything."**

**Branch A — the Guardian answers.**
Read the first sentence of the answer aloud, nothing more.

> **"It explains. It doesn't trade for me. Anything it ever proposes, I
> approve, and the decision record can be checked."**

**Branch B — "Guardian is unavailable right now…"**
Leave the message on screen.

> **"Tonight the AI service isn't connected, and it tells you that instead
> of pretending. The hand-off is the same either way: the question arrives
> with its context, and the answer would be an explanation, never a
> trade."**

### 2:25–2:45 — Where a wallet comes in (20 s)

Click `Close chat`. Click the header `Sign in` (or `Connect Wallet` when Privy is not configured). Optionally open `What happens when I sign in?` first: four plain trust statements.

> **"Everything so far needed no wallet. A wallet only comes in when you
> want to act on your own savings."**

**Branch A — a Privy sign-in opens.**
Point at it, then close it. Do not sign in on stage.

**Branch B — "Choose a wallet to continue" with `Try again`.**
Point at "You can keep exploring without connecting." Click the ✕
(`Dismiss wallet guidance`).

> **"And nothing moves without your signature. Not tonight, not ever."**

### 2:45–3:00 — Close (15 s)

Leave Home on screen.

> **"A number, a dated story, a question you can hand off, and a wallet
> only when you choose. You set the rules, the Guardian works inside them,
> and every step explains itself. Thank you."**

---

## 3. Contingencies

These are independent. Use the one that matches what failed, and keep
the rest of the script as written.

### 3.1 Tavily unreachable or unconfigured (empty news)

What the app actually does:

- `/api/agent/currency-news?code=NGN` answers `200` with `items: []`
  (`provider: null` when unconfigured, `provider: "tavily"` when a
  configured search failed or found nothing).
- The story renders **no** "In the news" section. There is no placeholder
  and no sample headline.
- The curated, dated trail and `Curated history · checked [date]` stay, as
  does `Ask Guardian about the NGN →`. The question simply carries no
  headlines.

What to do: take Branch B at 1:35. Say plainly that current headlines are
unavailable. Do not describe the trail as news, do not read a headline you
remember from rehearsal, and do not invent one.

What not to promise:

- No failover. TinyFish is only an alternative provider for the generic
  `/api/agent/web-search` route when Tavily is not configured. It does not
  fill the currency story when Tavily is down.
- No "it'll be back in a second". Recovery may also be masked by the caches
  in 1.5.

The 12-month chart above the trail comes from a separate FX feed. If it
shows "Historical path unavailable", skip pointing at the chart. The dated
trail still carries the segment.

### 3.2 Guardian AI unavailable

What the app actually does: the hand-off still works. The story closes,
the chat opens and the NGN question is sent, then the Guardian replies
"Guardian is unavailable right now — no AI provider is configured. Please
try again later or contact support."

What to do: take Branch B at 1:55. Show the hand-off and say that the
service is not connected. Do not read a remembered answer, and do not
promise one is coming. Restoring Tavily does not bring the Guardian back.
They are separate services.

If the chat hangs instead (no reply after about 5 seconds), say the same
line, then click `Close chat` and move on at 2:25.

### 3.3 Login unavailable

What the app actually does: with no Privy app configured, the header reads
`Connect Wallet` and opens the "Choose a wallet to continue" guidance with `Try again`. No
sign-in, no address and no signature.

What to do: take Branch B at 2:25. Show the guidance, dismiss it, and say
a wallet is only needed to act. Do not tap `Try again` repeatedly on stage,
and do not promise that login works. Restoring Tavily or the Guardian does
not restore login.

### 3.4 If the app itself is not responding

If the page does not load or the dock does not respond, stop driving the
app. Do not refresh repeatedly on stage. Say:

> **"The app is taking a break, so let me tell you what you'd see."**

Then speak the remaining segments from this script over the last screen
that worked, keeping the same timings. Do not show screenshots from an
earlier run as if they were live.

---

## 4. Never on stage

- No wallet connection, signature, swap, funding or transaction.
- No figure that is not on the screen at that moment.
- No headline that the screen is not showing.
- No claim that history is current news, or that a headline is a forecast.
- No claim that the Guardian answered, that login worked, or that analytics
  stored anything unless you saw it happen.
- No API keys, `.env` values or devtools panels with credentials on the
  projector.
