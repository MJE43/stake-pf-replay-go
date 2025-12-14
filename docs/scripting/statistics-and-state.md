# Bot2Love Statistics and State Management Analysis

This document provides a comprehensive analysis of the statistics tracking, UI state management, and data flow patterns from the bot2love extension at `C:\Users\Mike\Documents\Dev\stake-pf-replay-go\extension\bot2love-main\index.js`.

## 1. Statistics Tracked

### Core Bet Statistics

All statistics are initialized at lines 1098-1117:

```javascript
var losestreak = 0;
var winstreak  = 0;
var highest_streak = [0];
var lowest_streak = [0];
var current_balance = 0;
var balance = 0;
var betcount = 0;
var bets = 0;
var wins = 0;
var losses = 0;
var wagered = 0;
var profit_total = 0;
var highest_profit = [0];
var lowest_profit = [0];
var highest_bet = [0];
var currentstreak = 0;
var profit = 0;
var previousbet = 0;
var currentprofit = 0;
var current_profit = 0;
```

### Detailed Statistics

| Variable | Type | Purpose | Update Location |
|----------|------|---------|----------------|
| `betcount` | number | Total number of bets processed | Line 3444 (`betcount++`) |
| `profit_total` | number | Cumulative profit/loss across all bets | Line 3434 (`profit_total += current_profit`) |
| `wagered` | number | Total amount wagered across all bets | Line 3435 (`wagered += parseFloat(bet.amount)`) |
| `wins` | number | Count of winning bets | Line 3420 (`wins++`) |
| `losses` | number | Count of losing bets | Line 3425 (`losses++`) |
| `winstreak` | number | Current consecutive wins | Lines 3419, 3427 |
| `losestreak` | number | Current consecutive losses | Lines 3421, 3426 |
| `currentstreak` | number | Current streak (positive=wins, negative=losses) | Lines 3481-3484 |
| `highest_streak` | array | Highest win streak achieved (stored as array) | Lines 3499-3501 |
| `lowest_streak` | array | Lowest loss streak achieved (stored as array) | Lines 3503-3505 |
| `highest_bet` | array | Largest bet amount placed | Lines 3487-3489 |
| `highest_profit` | array | Peak profit reached during session | Lines 3491-3493 |
| `lowest_profit` | array | Lowest profit (biggest loss) during session | Lines 3495-3497 |
| `current_balance` | number | Current wallet balance | Lines 3438, 2749-2750 |
| `balance` | number | Current balance (alias for current_balance) | Line 3439 |
| `started_bal` | number | Starting balance when session begins | Lines 2757, 3781 |

### Session Timing

```javascript
var startMS = performance.now();  // Line 1154
```

Time tracking is handled via the `countTime()` function (lines 3907-3912):

```javascript
let t;
function countTime() {
    clearInterval(t);
    let s = Date.now();
    t = setInterval(() => running && !errorgame &&
        (e = Date.now() - s, document.getElementById('statTime').textContent =
        [e\864e5|0, e\36e5%24|0, e\6e4%60|0, e\1e3%60|0].join(':')), 1000);
}
```

This displays elapsed time as `days:hours:minutes:seconds`.

## 2. Profit/Loss Calculation

### Per-Bet Profit Calculation

Calculated at line 3433:

```javascript
current_profit = parseFloat(bet.payout) - parseFloat(bet.amount);
```

**Formula**: `profit = payout - wager_amount`

- **Win**: `payout > amount` → `current_profit > 0`
- **Loss**: `payout < amount` → `current_profit < 0`
- **Push**: `payout == amount` → `current_profit == 0`

### Win/Loss Determination

Determined at lines 3417-3429:

```javascript
lastBet = {
    name: bet.user.name,
    amount: bet.amount,
    payoutMultiplier: bet.payoutMultiplier,
    payout: bet.payout,
    Roll: lastBet.Roll,
    win: bet.payoutMultiplier >= 1  // Win if multiplier >= 1
};

if (lastBet.win) {
    win = true;
    winstreak++;
    wins++;
    losestreak = 0;
    color = '#ffffff'
} else {
    win = false;
    losses++;
    losestreak++;
    winstreak = 0;
    color = '#111211'
}
```

**Win Condition**: `payoutMultiplier >= 1.0`

### Cumulative Profit Tracking

Updated at line 3434:

```javascript
profit_total += current_profit;
```

This is an accumulator that adds each bet's profit/loss to the running total.

### Balance Updates

Updated at lines 3438-3439:

```javascript
current_balance += current_profit;
balance = current_balance;
```

The balance is synchronized with the actual wallet balance via `userBalances()` (lines 2716-2760), which queries the GraphQL API every 5 seconds (line 3916).

### Currency Handling

All calculations use **raw decimal values** (not scaled integers):

- Currency is defined as: `var currency = "trx"` (line 1082)
- Amounts use `.toFixed(8)` for display (8 decimal precision)
- Internal calculations use `parseFloat()` for precision
- Example currencies: "trx", "usdc", "btc", etc.

**Important**: The bot does NOT use satoshi/wei scaling. All values are in the currency's base unit.

## 3. Chart/Visualization Data

### Data Point Structure

Defined in `updateChart()` at lines 2126-2134:

```javascript
function updateChart() {
    dps.push({
        x: betcount,      // X-axis: bet number
        y: profit_total,  // Y-axis: cumulative profit
        color: color      // Line color based on last bet result
    });
    if (dps[dps.length - 2]) dps[dps.length - 2].lineColor = color;
    if (dps.length > 50) dps.shift();  // Keep last 50 points
    chart.render();
}
```

**Data Point Schema**:
```typescript
{
    x: number;        // Bet count (sequential)
    y: number;        // Cumulative profit at this point
    color: string;    // '#ffffff' (win) or '#111211' (loss)
    lineColor?: string; // Line segment color
}
```

### Update Frequency

The chart updates **after every completed bet** via:
- Line 3510: `updateChart()` called after bet result processing
- Line 2179: `updateChart()` called during demo mode

### Historical Data Retention

**Maximum 50 data points** are retained (line 2133):

```javascript
if (dps.length > 50) dps.shift();
```

Oldest points are removed when the array exceeds 50 entries. This provides a rolling window of recent performance.

### Chart Initialization

Chart is initialized in `drawChart()` (lines 2069-2124):

```javascript
function drawChart() {
    dps = [{ x: betcount, y: profit_total }];
    chart = new CanvasJS.Chart('chartContainer', {
        backgroundColor: "transparent",
        theme: 'dark2',
        animationEnabled: false,
        interactivityEnabled: false,
        width: chwidth,
        height: 150,
        // ... axis configuration
        data: [{
            type: 'line',
            markerSize: 0,
            lineThickness: 2,
            dataPoints: dps
        }]
    });
    chart.render();
}
```

## 4. Bet Result Processing

### The `data()` Function Flow

Main entry point at line 2999:

```javascript
function data(json) {
    // 1. Error handling (lines 3001-3048)
    if (json.errors != null) {
        // Handle various error types:
        // - parallelCasinoBet
        // - existingGame (for multi-round games)
        // - notFound
        // - insignificantBet
        cashout_done = false; // or true depending on error
        return;
    }

    // 2. Determine game type and extract bet data (lines 3086-3087)
    const gameType = Object.keys(json)[0] === "data"
        ? Object.keys(json.data)[0]
        : Object.keys(json)[0];
    bet = Object.keys(json)[0] === "data"
        ? json.data[gameType]
        : json[gameType];

    // 3. Game-specific result normalization (lines 3090-3400)
    // See "Game Result Normalization" section below

    // 4. Complete bet processing (lines 3403-3513)
    if (cashout_done) {
        // Update lastBet object
        // Determine win/loss
        // Update streaks
        // Calculate profit
        // Update balance
        // Update statistics
    }

    // 5. Update UI (lines 3515-3530)
    updateStats({ ... });

    // 6. Continue betting (lines 3538-3573)
    if (value == "js") {
        dobet();  // Call user script's dobet() function
    }
}
```

### Game Result Normalization

Each game type has unique response structures that must be normalized:

#### Dice Roll (`diceRoll`)
Lines 3249-3268:
```javascript
lastBet.Roll = bet.state.result;              // Actual roll result
lastBet.chance = bet.state.condition === "below"
    ? bet.state.target
    : 100 - bet.state.target;                  // Win chance
lastBet.target = bet.state.target;             // Target number
lastBet.targetNumber = 99 / lastBet.chance;    // Payout multiplier
```

#### Limbo (`limboBet`)
Lines 3233-3248:
```javascript
lastBet.Roll = bet.state.result;               // Result multiplier
lastBet.chance = 99 / bet.state.multiplierTarget;
lastBet.target = bet.state.multiplierTarget;   // Target multiplier
lastBet.targetNumber = bet.state.multiplierTarget;
```

#### HiLo (`hiloBet`, `hiloNext`, `hiloCashout`)
Lines 3269-3399:
- **hiloBet**: Initializes game with `currentBet = bet`
- **hiloNext**: Active game continues or ends
  - `cashout_done = false` if `bet.active == true`
  - `cashout_done = true` if game ended
- **hiloCashout**: Game completed by user cashout

```javascript
if (gameType === "hiloBet") {
    currentBet = bet;
    // Process based on payoutMultiplier
}

if (gameType === "hiloNext") {
    if (bet.active) {
        cashout_done = false;
        currentBet = bet;
        // Continue game
    } else {
        cashout_done = true;
        lastBet.Roll = bet.payoutMultiplier;
        // Process final result
    }
}
```

#### Mines (`minesBet`, `minesNext`, `minesCashout`)
Lines 3176-3206:
```javascript
if (gameType === "minesBet") {
    lastBet.Roll = bet.state.mines;            // Mine positions
    const rounds = bet.state.rounds;
    const minefield = bet.state.mines;
    const str_field = rounds.map(round => round.field);
    const hitmines = str_field.filter(n => minefield.includes(n));
    lastBet.target = str_field.length;
    lastBet.targetNumber = `${minefield.length}|${str_field.length}`;
}
```

#### Blackjack (`blackjackBet`, `blackjackNext`)
Lines 3105-3158:
- **blackjackBet**: Initial deal
- **blackjackNext**: Hit, stand, double, split actions

```javascript
if (gameType === "blackjackNext") {
    if (bet.active) {
        cashout_done = false;
        currentBet = bet;
    } else {
        cashout_done = true;
        lastBet.Roll = bet.payoutMultiplier;
    }
}
```

#### Keno (`kenoBet`)
Lines 3207-3232:
```javascript
lastBet.Roll = bet.state.drawnNumbers;         // Numbers drawn
const kenofield = bet.state.selectedNumbers;   // User's picks
const hitkeno = kenofield.filter(n => bet.state.drawnNumbers.includes(n));
lastBet.target = kenofield.length;
lastBet.targetNumber = `${bet.state.risk}|${kenofield.length}`;
lastBet.hitCount = hitkeno.length;
```

#### Baccarat (`baccaratBet`)
Lines 3159-3174:
```javascript
lastBet = {
    name: bet.user.name,
    amount: bet.amount,
    payoutMultiplier: bet.payoutMultiplier,
    payout: bet.payout,
    Roll: bet.state.winner,  // Winner: player/banker/tie
    win: bet.payoutMultiplier >= 1
};
```

### Win/Loss Determination Per Game

**Universal Rule**: `bet.payoutMultiplier >= 1` = win (line 3413)

**Special Cases**:
- **HiLo**: Can have partial wins on rounds; only final `cashout_done=true` counts
- **Mines**: Same as HiLo - multi-round game
- **Blackjack**: Same as HiLo - multi-round game
- **All other games**: Single-round, immediate win/loss determination

## 5. State Machine

### Bot States

```javascript
var running = false;       // Line 1086 - Bot is executing bets
var stopped = true;        // Line 1197 - Bot is stopped
var simrunning = false;    // Line 1133 - Simulation mode running
var errorgame = false;     // Line 1149 - Error occurred
```

**State Definitions**:

| State | `running` | `stopped` | Description |
|-------|-----------|-----------|-------------|
| **Idle** | `false` | `true` | Bot is not executing, ready to start |
| **Running** | `true` | N/A | Bot is actively placing bets |
| **Stopped** | `false` | N/A | Bot has been stopped mid-session |
| **Error** | N/A | N/A | Error occurred, tracked via `errorgame` |

### State Transitions

#### Start Bot
Function `start()` (lines 3696-3753):

```javascript
function start() {
    running = true;
    cashout_done = false;
    run_clicked = true;
    log("Bot start");
    dobet = function(){}  // Reset dobet function
    countTime();          // Start timer
    // ... initialize user code
    // ... start betting loop
}
```

**Transition**: `Idle → Running`

#### Stop Bot
Function `stop()` (lines 3678-3694):

```javascript
function stop() {
    stoponwin = false;
    running = false;
    run_clicked = false;
    simrunning = false;
    cashout_done = false;
    fastmode = false;
    log("Bot stop");
    // Clear all pending timeouts
    for (var i=0; i<timeouts.length; i++) {
        clearTimeout(timeouts[i]);
    }
    timeouts = [];
}
```

**Transition**: `Running → Stopped`

#### Error State
Triggered in `data()` function (lines 3001-3005):

```javascript
if (json.errors != null) {
    if (!json.errors[0].errorType.includes("parallelCasinoBet")) {
        log(json.errors[0].errorType + ". " + json.errors[0].message);
        errorgame = true;
    }
}
```

### Game State Transitions

For multi-round games (HiLo, Mines, Blackjack):

```javascript
var cashout_done = false;   // Line 1187 - Multi-round game state
var currentBet = null;      // Line 1186 - Active bet object
```

**Multi-Round Game States**:

1. **Game Start**:
   - `cashout_done = false`
   - `currentBet = bet` object
   - `running = false` (during API calls)

2. **Game Active** (next action):
   - `bet.active == true`
   - `cashout_done = false`
   - Continue taking actions (hit, pick field, guess card)

3. **Game Complete**:
   - `bet.active == false` OR explicit cashout
   - `cashout_done = true`
   - Process final statistics

### Multi-Round Game Handling

#### HiLo State Flow

```
hiloBet (initial) → currentBet set, cashout_done=false
    ↓
hiloNext (action) → if bet.active: continue
                   → if !bet.active: loss, cashout_done=true
    ↓
hiloCashout (user cashout) → cashout_done=true, process stats
```

Example from lines 3318-3360:

```javascript
if (gameType === "hiloNext") {
    if (bet.active) {
        // Continue game
        cashout_done = false;
        currentBet = bet;
    } else {
        // Game ended
        cashout_done = true;
        lastBet.Roll = bet.payoutMultiplier;
        // Process final result
    }
}
```

#### Mines State Flow

```
minesBet (initial) → running=false, game initialized
    ↓
minesNext (pick field) → running=false, update UI
    ↓
minesCashout OR hit mine → process final result
```

#### Blackjack State Flow

```
blackjackBet (deal) → currentBet set, cashout_done based on bet.active
    ↓
blackjackNext (hit/stand/double/split) → if bet.active: continue
                                        → if !bet.active: cashout_done=true
```

### Single-Round Games

For games like Dice, Limbo, Keno, Baccarat, etc.:

```javascript
if (game != "hilo" && game != "blackjack") {
    cashout_done = true;  // Line 3404
}
```

These games immediately set `cashout_done = true` and process statistics.

## 6. Statistics Update Object

The `updateStats()` function (lines 3822-3844) receives an object with this schema:

```typescript
interface StatsUpdate {
    time?: string;              // "days:hours:mins:secs"
    balance: string;            // "0.12345678"
    wagered: string;            // "1.23456789"
    wageredMultiplier: string;  // "1.23" (wagered / started_bal)
    profit: string;             // "-0.05000000" or "+0.05000000"
    profitPercent: string;      // "-5.00" or "+5.00"
    highBet: string;            // "0.00100000"
    highLose: string;           // "-0.05000000" (min of lowest_profit)
    highProfit: string;         // "0.10000000" (max of highest_profit)
    highStreak: number;         // 5
    lowStreak: number;          // -3
    bets: number;               // 42
    wins: number;               // 20
    losses: number;             // 22
    currentStreak: number;      // 3 or -2
}
```

Example usage (lines 3515-3530):

```javascript
updateStats({
    balance: balance.toFixed(8),
    wagered: wagered.toFixed(8),
    wageredMultiplier: (wagered / started_bal).toFixed(2),
    profit: profit_total.toFixed(8),
    profitPercent: (profit_total / started_bal * 100).toFixed(2),
    highBet: Math.max.apply(null, highest_bet).toFixed(8),
    highLose: Math.min.apply(null, lowest_profit).toFixed(8),
    highProfit: Math.max.apply(null, highest_profit).toFixed(8),
    highStreak: Math.max.apply(null, highest_streak),
    lowStreak: Math.min.apply(null, lowest_streak),
    bets: bets,
    wins: wins,
    losses: losses,
    currentStreak: currentstreak
});
```

## 7. Reset Functionality

The `resetstats()` function (lines 3762-3808) resets all statistics:

```javascript
function resetstats() {
    // Reset streaks
    losestreak = 0;
    winstreak  = 0;
    highest_streak = [0];
    lowest_streak = [0];

    // Reset counts
    betcount = 0;
    bets = 0;
    wins = 0;
    losses = 0;

    // Reset financials
    wagered = 0;
    profit_total = 0;
    highest_profit = [0];
    lowest_profit = [0];
    highest_bet = [0];
    currentstreak = 0;
    profit = 0;
    currentprofit = 0;
    current_profit = 0;

    // Reset starting balance to current balance
    started_bal = balance;

    // Update UI
    updateStats({ ... });
    resetChart();
    log("Stats has been reset");
}
```

**Key Insight**: Resetting stats sets `started_bal = balance`, making the current balance the new baseline for profit calculations.

## 8. Data Model for SQLite Persistence

Based on this analysis, here's the recommended SQLite schema:

### Sessions Table

```sql
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time INTEGER NOT NULL,           -- Unix timestamp
    end_time INTEGER,                       -- Unix timestamp (NULL if running)
    currency TEXT NOT NULL,                 -- 'trx', 'usdc', etc.
    starting_balance REAL NOT NULL,
    ending_balance REAL,
    game TEXT NOT NULL,                     -- 'dice', 'hilo', 'mines', etc.
    state TEXT DEFAULT 'running',           -- 'running', 'stopped', 'error'

    -- Summary statistics
    total_bets INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_losses INTEGER DEFAULT 0,
    total_wagered REAL DEFAULT 0.0,
    total_profit REAL DEFAULT 0.0,

    -- Peak statistics
    highest_bet REAL DEFAULT 0.0,
    highest_profit REAL DEFAULT 0.0,
    lowest_profit REAL DEFAULT 0.0,
    highest_streak INTEGER DEFAULT 0,
    lowest_streak INTEGER DEFAULT 0
);
```

### Bets Table

```sql
CREATE TABLE bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    bet_number INTEGER NOT NULL,            -- betcount within session
    timestamp INTEGER NOT NULL,

    -- Bet details
    bet_id TEXT,                            -- Stake's bet ID
    game TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,

    -- Result
    payout REAL NOT NULL,
    payout_multiplier REAL NOT NULL,
    profit REAL NOT NULL,                   -- payout - amount
    win INTEGER NOT NULL,                   -- 0 or 1

    -- Game-specific data (JSON)
    game_data TEXT,                         -- Stores game-specific fields

    -- Statistics snapshot after this bet
    cumulative_profit REAL NOT NULL,
    cumulative_wagered REAL NOT NULL,
    balance_after REAL NOT NULL,
    current_streak INTEGER NOT NULL,

    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_bets_session ON bets(session_id);
CREATE INDEX idx_bets_timestamp ON bets(timestamp);
```

### Chart Data Points Table

```sql
CREATE TABLE chart_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    bet_number INTEGER NOT NULL,           -- X-axis
    cumulative_profit REAL NOT NULL,       -- Y-axis
    color TEXT NOT NULL,                   -- '#ffffff' or '#111211'

    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_chart_session ON chart_data(session_id);
```

### Game-Specific Data (JSON Examples)

Stored in `bets.game_data` column:

**Dice**:
```json
{
    "target": 50.0,
    "condition": "below",
    "result": 23.45,
    "chance": 50.0
}
```

**HiLo**:
```json
{
    "rounds": 5,
    "cards": ["A", "K", "7", "3", "9"],
    "final_multiplier": 3.5
}
```

**Mines**:
```json
{
    "mines_count": 3,
    "fields_clicked": 5,
    "hit_mine": false,
    "fields": [1, 3, 5, 7, 9]
}
```

## Summary

The bot2love extension provides a robust statistics and state management system:

1. **Statistics**: 15+ metrics tracked, including streaks, peaks, and financials
2. **Profit Calculation**: Simple formula `payout - amount`, accumulated per bet
3. **Visualization**: Rolling 50-point chart of cumulative profit
4. **Bet Processing**: Game-agnostic `data()` function with game-specific normalization
5. **State Machine**: Clear states for bot (running/stopped) and games (single/multi-round)
6. **Currency**: Raw decimal values, no integer scaling
7. **Persistence**: All data can be captured and stored in SQLite for replay/analysis

This data model allows complete reconstruction of any betting session for replay, analysis, and algorithm backtesting.
