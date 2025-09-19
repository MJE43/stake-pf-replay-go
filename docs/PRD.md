# High-Level Overview (plain-English) — What this thing is and who it’s for

## Purpose

Rebuild what your bets **would have produced**—across Stake Originals—given an unhashed server seed, your client seed, and a nonce range. Fast. Deterministic. Auditable. The app scans hundreds of thousands to \~1M nonces and reports every time your chosen condition hits (e.g., “show me all nonces where Limbo ≥ 10x”). It’s not a betting bot; it’s an evidence machine.

## Who uses it

* **Seed replayers:** Curious players who rotated a seed and want to see the alternate timeline.
* **Analysts/researchers:** People validating provable fairness, gathering distributions, or building tools/content.
* **Support/mods:** Staff who need quick, deterministic answers to “what would have happened?” tickets.

## What “good” looks like

* Paste seeds, set game + range + target rule → **results in seconds/minutes**, not hours.
* Outputs are **bit-for-bit reproducible** on any machine.
* Adding a new game is **measured in hours**, not rewrites.
* Users can **export** and audit the same results later.

---

## User stories (with crisp acceptance criteria)

### Replayer — Limbo jackpot hunt

* **As a** user,
* **I want** to paste server/client seeds, choose Limbo, set `nonce 1..500,000`, and target `multiplier ≥ 25`,
* **So that** I can see every nonce where I’d have hit ≥ 25x.
* **Acceptance:** API returns `{hits:[{nonce, metric}], summary:{count,min,max,median}}`; results are identical across machines for the same inputs.

### Researcher — Pump difficulty sweep

* **As a** researcher,
* **I want** to scan Pump across difficulties with the same seeds and range,
* **So that** I can compare safe-pump distributions and top hits.
* **Acceptance:** Each run echoes inputs (game, params, nonce range), returns deterministic summaries; CSV export contains nonces + metrics.

### Support — Quick roulette pocket proof

* **As a** support agent,
* **I want** to verify a specific nonce for Roulette and show the pocket,
* **So that** I can resolve fairness disputes quickly.
* **Acceptance:** `/verify` returns `pocket` and a small JSON payload; hashing endpoint returns the SHA-256 of the server seed for public comparison.

### Power user — “stop at N hits” control

* **As a** power user,
* **I want** to cap results at the first 5,000 matches,
* **So that** I don’t waste time and memory when hunting rare events.
* **Acceptance:** `limit` truncates hits without affecting the aggregate summary.

### Analyst — Long-running guardrails

* **As an** analyst,
* **I want** a timeout,
* **So that** bad ranges don’t tie up resources.
* **Acceptance:** `timeout_ms` cancels politely; partial summary is still returned if possible.

---

## Non-functional requirements (the guardrails)

* **Deterministic:** Same inputs → same outputs, always. No time-based randomness, no implicit rounding.
* **Throughput:** Linear scaling with cores; allocation-free hot path.
* **Transparency:** Plain JSON details (e.g., Mines grid, Plinko path), versioned payout tables in repo, engine version echoed in every response.
* **Safety:** Bounded worker pool, rate limits, range caps, and timeouts.
* **Portability:** Single static binary; SQLite by default, Postgres optional.
* **Testability:** Golden vectors per game; cross-implementation parity checks stay green.

---

## Out of scope (V1)

* Simulating player decision trees (e.g., blackjack strategy, Mines click sequences).
* Live connections to casinos or user accounts.
* Automated “best seed search.” This tool **replays**, it doesn’t optimize.

---

## Principles we won’t violate

* **Boring crypto is good crypto.** Use HMAC-SHA256 as specified; treat the server seed as ASCII.
* **Make the hot path hot.** No JSON in the worker loop; hits are `{nonce, metric}` only.
* **Data first, drama never.** Every claim is backed by an input echo, engine version, and (when relevant) a payout table version.

---

## Glossary (quick map)

* **Server seed (unhashed):** The HMAC key you reveal after rotation.
* **Client seed:** Your seed; concatenated into the HMAC message.
* **Nonce:** Monotonic counter per bet.
* **Cursor:** Internal byte offset for games needing more than 8 floats per nonce.
* **Metric:** A single number per nonce used for scanning (e.g., multiplier, roll, pocket). Details carry the rest.


# PRD (simplified) — Stake PF Replay (Go)

## 1) What we’re building

A fast tool that **replays outcomes** for Stake “Originals” games using your **server seed (unhashed)**, **client seed**, and a **range of nonces**.
You tell it which game and what to look for (e.g., “Limbo ≥ 10x”). It scans **hundreds of thousands to \~1,000,000 nonces** and returns every match plus a summary.

It does not place bets. It just shows what would have happened.

---

## 2) Inputs and outputs

**Inputs**

* `serverSeed` (unhashed, ASCII string)
* `clientSeed` (string)
* `nonceStart`, `nonceEnd` (inclusive range)
* `game` (e.g., pump, limbo, dice, roulette…)
* `params` (options per game, like difficulty)
* `target rule` (e.g., `>= 10`, `== 17`)
* `tolerance` (for float equality, default small number)
* Optional: `limit` (max hits to return), `timeoutMs` (cancel long scans)

**Outputs**

* `hits`: list of `{ nonce, metric }` that match your rule
  (Example metrics: Limbo multiplier, Dice roll, Roulette pocket)
* `summary`: `{ count, min, max, median or average }`
* `engineVersion`, `echo of inputs`
* Optional `details` when verifying a single nonce (e.g., Mines board)

---

## 3) How randomness is reproduced (short version)

* We use **HMAC-SHA256** with:

  * **Key:** `serverSeed` (ASCII, do **not** hex-decode)
  * **Message:** `clientSeed:nonce:currentRound`
* HMAC gives 32 bytes per round. Some games need more than 8 numbers, so we advance `currentRound` as needed.
* We turn bytes into floats in (0,1) using **4 bytes per float**:
  `f = b0/256 + b1/256² + b2/256³ + b3/256⁴`.
* For games that draw without replacement (Mines, Pump, Chicken, Keno, Video Poker), we use a standard **shrinking-pool selection** (Fisher–Yates style).

This matches Stake’s published method.

---

## 4) Game results and “metric”

Every game produces a **single numeric metric per nonce** so scanning is easy.

Examples:

* **Limbo / Crash / Plinko / Wheel:** `metric = multiplier`
* **Dice / Primedice:** `metric = roll` (0.00–100.00)
* **Roulette:** `metric = pocket` (0–36, returned as a number)
* **Mines:** `metric = firstBombIndex` (1–25), details include full grid
* **Chicken:** `metric = deathRound` (1–20)
* **Keno:** `metric = lowestHitIndex` (stable rule), details include all hits
* **Video Poker / Blackjack / Hilo / Baccarat:** details list cards; `metric = firstCardIndex` for scanning

Game-specific payout tables (Plinko, Wheel, some Pump difficulties) live in JSON files so we don’t hardcode them.

---

## 5) Scanning and performance

* We split the nonce range across **goroutines** (one worker per CPU core).
* Workers compute the metric and check your **target rule** (`==`, `>=`, `>`, `<=`, `<`, `in {…}`).
* We keep the hot loop **allocation-free** and only push `{nonce, metric}` for matches.
* You can **limit** the number of hits returned and set a **timeout** to stop long scans.
* Goal: linear scale with cores; millions of evaluations per hour on a typical multi-core machine.

---

## 6) API (simple)

### `POST /scan`

Scan a range and return hits + summary.

```json
{
  "game": "limbo",
  "seeds": { "server": "ASCII_SERVER", "client": "myclient" },
  "nonce_start": 1,
  "nonce_end": 500000,
  "params": {},
  "target_op": "ge",
  "target_val": 10.0,
  "tolerance": 1e-9,
  "limit": 5000,
  "timeout_ms": 60000
}
```

**Response:** `{ hits: [...], summary: {...}, engine_version: "go-x.y.z" }`

### `POST /verify`

Check a single nonce and include rich `details` (used for support/debug).

### `GET /games`

List supported games and the names of their metrics and params.

### `POST /seed/hash`

Return `sha256(serverSeed)` so users can compare to Stake’s published hash.

---

## 7) Data storage (default SQLite)

Tables:

* `runs`: stores inputs, echo, engine version, summary JSON
* `hits`: `(run_id, nonce, metric_real, details_json?)`
  Indexes on `(run_id, metric_real)` and `(run_id, nonce)`.

Postgres is optional later; SQLite is the default for simplicity.

---

## 8) Reliability and safety

* **Deterministic:** Same inputs → same outputs. No hidden randomness.
* **Precision:** Follow the byte→float formula exactly. Use `tolerance` for equality.
* **Bounds:** Range caps, worker limits, timeouts to avoid runaway scans.
* **Transparency:** Versioned payout tables; engine version echoed in responses.
* **Testing:** Golden vectors per game to catch regressions.

---

## 9) Adding a new game (short checklist)

1. Define the **metric** (single number per nonce).
2. Determine **how many floats** are needed per nonce.
3. Map floats to events **exactly** as the docs say (with or without replacement).
4. (If needed) Load a **payout table** from JSON.
5. Implement `Evaluate()` that returns `{metric, details?}`.
6. Add **golden tests** (fixed seeds → fixed outputs).
7. Register the game in the engine.

---

## 10) Milestones (phased)

* **M0:** Core RNG, Pump, `/scan`, summaries, SQLite, golden tests.
* **M1:** Limbo, Dice/Primedice, Roulette, Wheel, Plinko.
* **M2:** Mines, Chicken, Keno, Video Poker + card games.
* **M3:** Postgres option, CSV export, rate limits, Crash/Slide (salt-chain RNG).
