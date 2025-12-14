## Live Dashboard Strategy + Requirements Spec (Pump / Expert)

**Status**: authoritative reference for future coding agents
**Audience**: maintainers/agents implementing backend ingest, analytics, and UI
**Scope**: the live ingest + live dashboard is intentionally purpose-built for a single strategy; correctness and decision-support take priority over generic dashboards.

**Related Documents:**
- [antebot-script.js](./antebot-script.js) — Working implementation example
- [Design Constraints](./design-constraints.md) — Backend constraints affecting live features
- [Documentation Index](./INDEX.md) — Full documentation catalog

---

## Strategy (what the user is doing)

### Primary decision the UI must support

- **Start / stop betting now**.
- **Identify a “good seed/stream” and ride it**.
- **Identify “good pockets” inside a good stream** where it’s beneficial to start betting, and similarly where to stop.
- **Difficulty is constant**: always **Pump / Expert**.

### Core edge hypothesis (what the user is looking for)

- The user watches **multiplier (“multi”) distribution vs nonce position**.
- Patterns are partly intuitive/visual (“seed feel”), but the main codified heuristic is **cadence consistency** for specific expert tier thresholds:
  - **1066.73×**, **3200.18×**, **11200.65×** are the primary tiers of interest (especially **1066** and **3200**).
  - **164.72×** and **400.02×** are also tracked for context.
- A seed is “good” when **hits for a tier occur at roughly the expected nonce cadence** and do so **consistently within a tolerance band**.
  - The stated tolerance is **±~400 nonces** (normal band).
  - Example: “~every 1000ish nonces a **1066× or higher** appears” as a main heuristic.
  - If 1066 cadence is consistently good, the user expects that **11200** will usually appear on a longer cycle (often “~7–10k” in observed samples; mathematically the mean is larger—see below).

### Tier semantics (critical)

- “1066 hit” means **\(roundResult \ge 1066.73\)** (>= exact expert threshold), not >=1066.00 and not exact equality.
- Similarly:
  - “3200 hit” means **\(roundResult \ge 3200.18\)**
  - “11200 hit” means **\(roundResult \ge 11200.65\)**
- The dashboard must avoid float “near equals”; it must treat tiers as **threshold buckets** (>= threshold).

---

## Terms & definitions (shared language for agents)

- **Round**: a single Pump game outcome with:
  - `nonce` (monotonic index within a stream/seed)
  - `round_result` multiplier (float, e.g. 12.34×, 1066.73×, …)
- **Stream**: the unit of analysis, keyed by `(serverSeedHashed, clientSeed)` and represented by a persistent stream id.
- **Hit** (for a tier): a round where `round_result >= tier.threshold`.
- **Gap** (for a tier): the nonce distance between consecutive hits of that tier (e.g., 1050, 1204, …).
- **Current streak** (for a tier): how many nonces since the last hit **based on the latest observed nonce**, not based on the last ingested “bet row”.
- **Last-K**: the last K gaps (e.g. K=10) for a tier.
- **Rolling window**: last N rounds (or last X nonces) for calculating recent hit rates/consistency.
- **Consistency band**: for a tier with expected gap \(E\), define deviation \(d = gap - E\).
  - “Within ±400” means \(|d| \le 400\).

---

## Expected gaps (why the “~1000 nonces for 1066” heuristic is sane)

### Expert tier thresholds that matter

The dashboard uses the Pump expert “tier table” thresholds:

- **34.68×**
- **73.21×**
- **164.72×**
- **400.02×**
- **1066.73×**
- **3200.18×**
- **11200.65×**

### Expected-gap intuition

For each tier threshold \(T\), let \(p_T = P(roundResult \ge T)\). Then:

- **Expected gap**: \(E_T \approx 1 / p_T\)

The user’s primary heuristic (“1066-ish every ~1000”) aligns with \(E_{1066}\) being around ~1.1k in expectation. Real samples will vary; the dashboard should therefore emphasize **consistency** and **deviation bands** rather than “exactly every 1088”.

**Important**: expected values are not guarantees; the UI must avoid implying certainty.

---

## Data correctness: why heartbeat rounds are required

### The original failure mode (“sparse ingest”)

The Antebot/qBot script historically sent ingest payloads only for **high multipliers** (e.g. >=34×) and often only when betting. That means:

- If we compute “since last hit” using only ingested bet rows, then:
  - The “current nonce” is stale during dry stretches.
  - “Since last hit” and “current streak” become **wrong** (often undercounting heavily).

### Required fix: continuous nonce tracking

We must ingest **every round’s nonce + result** (lightweight), separate from “high hit bet rows”.

This repo implements that via **heartbeat** messages:

- Heartbeat: emitted for every round, contains at minimum:
  - `type: "heartbeat"`
  - `nonce`
  - `roundResult`
  - `clientSeed`
  - `serverSeedHashed`
- Bet: still emitted only for “interesting” rounds (e.g. >=34×) for the stream tape:
  - `type: "bet"` plus richer fields (id, amount, payout, dateTime, etc.)

This is documented/implemented in `docs/antebot-script.js`.

---

## Ingest contract (external tool → app)

### Endpoint

- Local endpoint: **`POST /live/ingest`** (hosted by the desktop app)
- Typical local URL: `http://127.0.0.1:<port>/live/ingest`

### Payload types

#### Heartbeat payload (required on every round)

- Minimal fields:
  - `type`: `"heartbeat"`
  - `nonce`: number
  - `roundResult`: number
  - `clientSeed`: string
  - `serverSeedHashed`: string

#### Bet payload (optional, filtered)

- Minimal fields (common):
  - `type`: `"bet"`
  - `id`: string
  - `dateTime`: ISO string
  - `nonce`: number
  - `roundResult`: number
  - `difficulty`: `"expert"`
  - `clientSeed`, `serverSeedHashed`
- Extra fields (for tape/PnL):
  - `amount`, `payout`, `roundTarget`, etc.

### Eventing model (desktop real-time UI)

- Backend emits Wails events per stream:
  - `live:tick:{streamId}` for heartbeats (round cadence updates)
  - `live:newrows:{streamId}` for new bet rows (tape updates)

Frontend must subscribe to both; heartbeats drive “truthful nonce time”.

---

## Analytics requirements (what the dashboard must compute)

### Per-tier cadence stats (for each tracked tier)

For each tier threshold \(T\):

- **Current streak**: `latestObservedNonce - lastHitNonce(T)`
- **Expected gap**: \(E_T\) (from tier table)
- **Δ to expected**: `expectedGap - currentStreak`
  - Positive: “**due in N**”
  - Negative: “**overdue by N**”
- **Last-K gaps**: list of `{gap, deviation, atNonce}`
- **Last-K distribution**:
  - median gap
  - mean gap
  - percentile(s) optional
- **Consistency score**:
  - `withinNormal = count(|deviation| <= 400)`
  - display as `withinNormal / K` and percent
- **Rolling window hit rate** (optional but useful):
  - hits per N rounds for each tier, to detect “hot pockets”

### Cross-tier context (secondary signals)

- 164 and 400 tiers can be used as “texture” for the seed (is the stream lively or dead?), but the UI must keep 1066/3200 primary.

### Decision support outputs (what the UI should suggest)

The UI should distill analytics into “start/stop” cues without pretending to be a guarantee:

- **Seed quality**: overall assessment driven primarily by 1066 cadence consistency and secondarily by 3200 cadence.
- **Hot pocket** indication:
  - e.g., multiple tiers within their normal bands over recent hits
- **Stop signals**:
  - e.g., prolonged outside-band gaps / deteriorating consistency

**Non-goal**: produce a fully-automated betting algorithm; the user’s visual intuition remains part of the workflow. The UI supports the human.

---

## UI requirements (what the dashboard must show)

### Primary widgets

- **Tier cards** (one per tier: 1066, 3200, 11200; plus 164/400 as context):
  - current streak vs expected
  - Δ-to-expected (“due in / overdue by”)
  - last-10 gaps visualization AND the **last-10 gaps as numbers**
  - consistency band score (e.g. “within ±400: 7/10”)
  - total hits for the tier
- **Pattern visualizer**:
  - bar/tape of recent rounds
  - color-coded by tier bucket thresholds
  - must render the “<34× majority” with visible neutral tint (otherwise it looks empty)
- **Stream tape**:
  - a table of high multiplier “bet rows” (>=34× by default)
  - meant for scanning notable hits; not used for nonce truth
- **Connection / ingest health**:
  - show whether heartbeats are arriving (timeout-based)
  - show latest observed nonce and timestamp

### UX constraints that matter for this strategy

- The user is watching for rhythm; the UI must be **fast to parse**:
  - emphasize a small number of high-signal numbers
  - minimize clutter and avoid “wall of stats”
- Avoid misleading precision:
  - do not show “exact predictions”
  - label expected values as “expected/average”

---

## Implementation pitfalls & guardrails (hard-won lessons)

### 1) Never compute streaks from sparse bet rows

- Streaks must use `live_rounds` (heartbeats) and the stream’s `last_observed_nonce`.

### 2) Tier matching must be “>= threshold”

- Avoid float equality checks; treat tiers as buckets.

### 3) Frontend must fetch enough history

- Analytics + pattern visualization need thousands of recent rounds.
- If the backend clamps too low, the UI silently degrades. Keep backend limits aligned with frontend defaults (e.g., 5000+).

### 4) Storage growth must be bounded

- Heartbeats create a row per round; ensure cleanup/retention to prevent unbounded DB growth (e.g. keep last N).

---

## Antebot/qBot integration notes (practical)

- qBot is finicky; use conservative JS syntax (avoid modern features if it breaks).
- Prefer sending heartbeat from a callback that fires every round. If only `onBetPlaced` is reliable, set the bot to bet 0.0 (observation mode) but still emit per-round data.
- The canonical script in this repo is `docs/antebot-script.js`.

---

## Acceptance criteria (how to know the dashboard matches the strategy)

- **Nonce truth**: “since last hit” must keep increasing even when no >=34× bets are ingested.
- **Per-tier cadence**: 1066/3200/11200 each have:
  - correct hit detection (>= threshold)
  - correct last hit nonce
  - correct gap list (based on consecutive hits)
- **Decision support**: the UI makes it easy to answer:
  - “Is this seed good for 1066 cadence?”
  - “Are we currently due/overdue?”
  - “Are the last ~10 gaps behaving within ±400?”
  - “Does the recent pattern ‘feel’ hot or dead?”


