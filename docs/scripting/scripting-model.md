# Bot2Love Scripting Model Documentation

This document provides a complete reference for the bot2love scripting system, extracted from the original JavaScript implementation. This serves as the specification for implementing a compatible sandboxed scripting engine in Go.

## Table of Contents

1. [Overview](#overview)
2. [Global Variables](#global-variables)
3. [Global Functions](#global-functions)
4. [Script Execution Lifecycle](#script-execution-lifecycle)
5. [Game-Specific Configuration](#game-specific-configuration)
6. [Example Scripts](#example-scripts)

---

## Overview

The bot2love scripting system allows users to write JavaScript code that controls betting behavior. Scripts are executed in the browser's JavaScript environment and have access to a set of global variables and functions that represent the current betting state.

**Key Concepts:**
- User scripts define a `dobet()` function that is called after each bet completes
- Global variables are updated automatically by the runtime before calling `dobet()`
- Scripts can modify betting parameters (nextbet, chance, bethigh, etc.) to control the next bet
- The runtime handles actual bet placement and result processing

---

## Global Variables

### Core Betting Variables

#### `balance`
- **Type:** `number`
- **Purpose:** Current user balance in the selected currency
- **Updated:** After each bet result is processed, and when balance is refreshed from server
- **Initial Value:** Fetched from user's account
- **Read/Write:** Read-only (updated by system)

#### `nextbet`
- **Type:** `number`
- **Purpose:** The bet amount for the next bet to be placed
- **Updated:** By user script in `dobet()` function
- **Initial Value:** Set to `basebet` at script start
- **Read/Write:** Read/Write (user modifies this to change bet size)

#### `basebet`
- **Type:** `number`
- **Purpose:** The initial/base bet amount defined by the user
- **Updated:** Set by user in their script initialization
- **Initial Value:** `0` (must be set by user script)
- **Read/Write:** Read/Write

#### `previousbet`
- **Type:** `number`
- **Purpose:** The amount of the last bet that was placed
- **Updated:** After each bet completes (set to `lastBet.amount`)
- **Initial Value:** `0`
- **Read/Write:** Read-only (updated by system)

#### `win`
- **Type:** `boolean`
- **Purpose:** Whether the last bet was a win
- **Updated:** After each bet completes (set based on `bet.payoutMultiplier >= 1`)
- **Initial Value:** `false`
- **Read/Write:** Read-only (updated by system)

#### `running`
- **Type:** `boolean`
- **Purpose:** Whether the bot is currently running
- **Updated:** When start/stop is triggered
- **Initial Value:** `false`
- **Read/Write:** System-controlled (user can read to check status)

### Statistics Variables

#### `bets` / `betcount`
- **Type:** `number`
- **Purpose:** Total number of bets placed in current session
- **Updated:** Incremented after each completed bet
- **Initial Value:** `0`
- **Read/Write:** Read-only (updated by system)

#### `wins`
- **Type:** `number`
- **Purpose:** Total number of winning bets
- **Updated:** Incremented when `win = true`
- **Initial Value:** `0`
- **Read/Write:** Read-only (updated by system)

#### `losses`
- **Type:** `number`
- **Purpose:** Total number of losing bets
- **Updated:** Incremented when `win = false`
- **Initial Value:** `0`
- **Read/Write:** Read-only (updated by system)

#### `winstreak`
- **Type:** `number`
- **Purpose:** Current consecutive wins
- **Updated:** After each bet (incremented on win, reset to 0 on loss)
- **Initial Value:** `0`
- **Read/Write:** Read-only (updated by system)

#### `losestreak`
- **Type:** `number`
- **Purpose:** Current consecutive losses
- **Updated:** After each bet (incremented on loss, reset to 0 on win)
- **Initial Value:** `0`
- **Read/Write:** Read-only (updated by system)

#### `currentstreak`
- **Type:** `number`
- **Purpose:** Current streak (positive for wins, negative for losses)
- **Updated:** After each bet (`winstreak` if winning, `-losestreak` if losing)
- **Initial Value:** `0`
- **Read/Write:** Read-only (updated by system)

#### `highest_streak`
- **Type:** `array[number]` (single element)
- **Purpose:** Highest win streak achieved in session
- **Updated:** After each bet if current streak exceeds it
- **Initial Value:** `[0]`
- **Read/Write:** Read-only (updated by system)

#### `lowest_streak`
- **Type:** `array[number]` (single element)
- **Purpose:** Lowest (most negative) loss streak in session
- **Updated:** After each bet if current streak is lower
- **Initial Value:** `[0]`
- **Read/Write:** Read-only (updated by system)

#### `profit` / `profit_total`
- **Type:** `number`
- **Purpose:** Total profit/loss for the session
- **Updated:** After each bet (`profit_total += (bet.payout - bet.amount)`)
- **Initial Value:** `0`
- **Read/Write:** Read-only (updated by system)

#### `currentprofit` / `current_profit`
- **Type:** `number`
- **Purpose:** Profit/loss from the last bet
- **Updated:** After each bet (`bet.payout - bet.amount`)
- **Initial Value:** `0`
- **Read/Write:** Read-only (updated by system)

#### `wagered`
- **Type:** `number`
- **Purpose:** Total amount wagered in the session
- **Updated:** After each bet (`wagered += bet.amount`)
- **Initial Value:** `0`
- **Read/Write:** Read-only (updated by system)

#### `highest_profit`
- **Type:** `array[number]` (single element)
- **Purpose:** Highest profit achieved in session
- **Updated:** After each bet if `profit_total` exceeds it
- **Initial Value:** `[0]`
- **Read/Write:** Read-only (updated by system)

#### `lowest_profit`
- **Type:** `array[number]` (single element)
- **Purpose:** Lowest profit (biggest loss) in session
- **Updated:** After each bet if `profit_total` is lower
- **Initial Value:** `[0]`
- **Read/Write:** Read-only (updated by system)

#### `highest_bet`
- **Type:** `array[number]` (single element)
- **Purpose:** Largest bet amount placed in session
- **Updated:** After each bet if `lastBet.amount` exceeds it
- **Initial Value:** `[0]`
- **Read/Write:** Read-only (updated by system)

#### `started_bal`
- **Type:** `number`
- **Purpose:** Balance at the start of the session
- **Updated:** When bot starts or stats are reset
- **Initial Value:** Set to `balance` on start
- **Read/Write:** Read-only (updated by system on start)

#### `current_balance`
- **Type:** `number`
- **Purpose:** Calculated current balance (started_bal + profit_total)
- **Updated:** After each bet
- **Initial Value:** Same as `balance`
- **Read/Write:** Read-only (updated by system)

### Game Configuration Variables

#### `game`
- **Type:** `string`
- **Purpose:** The game type to play
- **Updated:** Set by user script
- **Valid Values:** `"dice"`, `"limbo"`, `"hilo"`, `"keno"`, `"mines"`, `"baccarat"`, `"plinko"`, `"wheel"`, `"roulette"`, `"blackjack"`, `"bluesamurai"`, `"dragontower"`, `"flip"`, `"rps"`, `"videopoker"`, `"pump"`, `"snakes"`, `"cases"`, `"diamonds"`, `"darts"`, `"bars"`, `"chicken"`, `"tarot"`, `"tomeoflife"`, `"scarabspin"`, `"primedice"`, `"packs"`
- **Initial Value:** `"dice"`
- **Read/Write:** Read/Write (user sets this)

#### `currency`
- **Type:** `string`
- **Purpose:** The currency to bet with
- **Updated:** Set by user script
- **Valid Values:** Any currency code (e.g., `"btc"`, `"eth"`, `"usdc"`, `"trx"`)
- **Initial Value:** `"trx"`
- **Read/Write:** Read/Write

### Dice-Specific Variables

#### `chance`
- **Type:** `number`
- **Purpose:** Win chance percentage for dice
- **Updated:** Set by user script
- **Valid Range:** `0.01` to `98` (typical range)
- **Initial Value:** `49.5`
- **Read/Write:** Read/Write

#### `bethigh`
- **Type:** `boolean`
- **Purpose:** Whether to bet on high or low for dice
- **Updated:** Set by user script
- **Initial Value:** `false`
- **Read/Write:** Read/Write

### Limbo-Specific Variables

#### `target`
- **Type:** `number`
- **Purpose:** Target multiplier for limbo
- **Updated:** Set by user script
- **Valid Range:** `1.01` to very high values
- **Initial Value:** `1.01`
- **Read/Write:** Read/Write

#### `target_multi`
- **Type:** `number`
- **Purpose:** Alias for target (used in some contexts)
- **Updated:** Set by user script
- **Initial Value:** `1.01`
- **Read/Write:** Read/Write

### Mines-Specific Variables

#### `mines`
- **Type:** `number`
- **Purpose:** Number of mines in the minefield
- **Updated:** Set by user script
- **Valid Range:** `1` to `24` (depends on grid size)
- **Initial Value:** `1`
- **Read/Write:** Read/Write

#### `fields`
- **Type:** `array[number]`
- **Purpose:** Array of field positions to click
- **Updated:** Set by user script
- **Example:** `[1, 2, 3]` for fields 1, 2, and 3
- **Initial Value:** `[1, 2, 3]`
- **Read/Write:** Read/Write

### Keno-Specific Variables

#### `numbers`
- **Type:** `array[number]`
- **Purpose:** Numbers to select in keno
- **Updated:** Set by user script
- **Valid Range:** Numbers 0-39
- **Initial Value:** `[0, 1, 2, 3, 4, 5, 6, 7, 8]`
- **Read/Write:** Read/Write

#### `risk`
- **Type:** `string`
- **Purpose:** Risk level for games that support it (keno, plinko, wheel)
- **Updated:** Set by user script
- **Valid Values:** `"low"`, `"medium"`, `"high"`
- **Initial Value:** `"low"`
- **Read/Write:** Read/Write

### Plinko-Specific Variables

#### `rows`
- **Type:** `number`
- **Purpose:** Number of rows in plinko
- **Updated:** Set by user script
- **Valid Values:** `8`, `12`, `16`
- **Initial Value:** `8`
- **Read/Write:** Read/Write

### Wheel-Specific Variables

#### `segments`
- **Type:** `number`
- **Purpose:** Number of segments for wheel game
- **Updated:** Set by user script
- **Valid Values:** `10`, `20`, `30`, `40`, `50`
- **Initial Value:** `10`
- **Read/Write:** Read/Write

### Baccarat-Specific Variables

#### `betamount`
- **Type:** `object`
- **Purpose:** Bet amounts for each baccarat position
- **Structure:** `{player: number, banker: number, tie: number}`
- **Updated:** Set by user script
- **Example:** `{player: 0.003, banker: 0.001, tie: 0}`
- **Initial Value:** `{player: 0, banker: 0, tie: 0}`
- **Read/Write:** Read/Write

#### `player`
- **Type:** `number`
- **Purpose:** Amount to bet on player (used when calling bet function)
- **Updated:** Set by user script
- **Initial Value:** `0`
- **Read/Write:** Read/Write

#### `banker`
- **Type:** `number`
- **Purpose:** Amount to bet on banker
- **Updated:** Set by user script
- **Initial Value:** `0`
- **Read/Write:** Read/Write

#### `tie`
- **Type:** `number`
- **Purpose:** Amount to bet on tie
- **Updated:** Set by user script
- **Initial Value:** `0`
- **Read/Write:** Read/Write

### HiLo-Specific Variables

#### `startcard`
- **Type:** `object`
- **Purpose:** Starting card for HiLo game
- **Structure:** `{rank: string, suit: string}`
- **Updated:** Set by user script
- **Example:** `{rank: "A", suit: "H"}` for Ace of Hearts
- **Initial Value:** `{}`
- **Read/Write:** Read/Write

#### `currentBet`
- **Type:** `object | null`
- **Purpose:** Current active bet object for multi-round games (HiLo, Blackjack)
- **Updated:** System updates this during active game rounds
- **Structure:** Contains game state, rounds, cards, etc.
- **Initial Value:** `null`
- **Read/Write:** Read-only (updated by system)

#### `hiloguess`
- **Type:** `number | null`
- **Purpose:** The guess action for HiLo (set by user's `round()` function)
- **Updated:** Set by user's `round()` function
- **Valid Values:** `2` (equal), `4` (low), `5` (high), `7` (skip), `3` (cashout)
- **Initial Value:** `null`
- **Read/Write:** Read/Write (user sets in round() function)

#### `HILO_BET_EQUAL`
- **Type:** `number` (constant)
- **Purpose:** Constant for betting equal in HiLo
- **Value:** `2`
- **Read/Write:** Read-only

#### `HILO_SKIP`
- **Type:** `number` (constant)
- **Purpose:** Constant for skipping in HiLo
- **Value:** `7`
- **Read/Write:** Read-only

#### `HILO_BET_HIGH`
- **Type:** `number` (constant)
- **Purpose:** Constant for betting high in HiLo
- **Value:** `5`
- **Read/Write:** Read-only

#### `HILO_BET_LOW`
- **Type:** `number` (constant)
- **Purpose:** Constant for betting low in HiLo
- **Value:** `4`
- **Read/Write:** Read-only

#### `HILO_CASHOUT`
- **Type:** `number` (constant)
- **Purpose:** Constant for cashing out in HiLo
- **Value:** `3`
- **Read/Write:** Read-only

### Blackjack-Specific Variables

#### `action`
- **Type:** `string`
- **Purpose:** The action to take in blackjack
- **Updated:** Set by user script based on `nextactions`
- **Valid Values:** `"stand"`, `"hit"`, `"double"`, `"split"`, `"insurance"`, `"noInsurance"`
- **Initial Value:** `"stand"`
- **Read/Write:** Read/Write

#### `nextactions`
- **Type:** `string`
- **Purpose:** The next action for blackjack (set by user's `round()` function)
- **Updated:** Set by user's `round()` function
- **Valid Values:** `"BLACKJACK_STAND"`, `"BLACKJACK_HIT"`, `"BLACKJACK_DOUBLE"`, `"BLACKJACK_SPLIT"`, `"BLACKJACK_INSURANCE"`, `"BLACKJACK_NOINSURANCE"`
- **Initial Value:** `"BLACKJACK_STAND"`
- **Read/Write:** Read/Write

#### `BLACKJACK_STAND`
- **Type:** `string` (constant)
- **Purpose:** Constant for stand action
- **Value:** `"stand"`
- **Read/Write:** Read-only

#### `BLACKJACK_HIT`
- **Type:** `string` (constant)
- **Purpose:** Constant for hit action
- **Value:** `"hit"`
- **Read/Write:** Read-only

#### `BLACKJACK_DOUBLE`
- **Type:** `string` (constant)
- **Purpose:** Constant for double action
- **Value:** `"double"`
- **Read/Write:** Read-only

#### `BLACKJACK_SPLIT`
- **Type:** `string` (constant)
- **Purpose:** Constant for split action
- **Value:** `"split"`
- **Read/Write:** Read-only

#### `BLACKJACK_INSURANCE`
- **Type:** `string` (constant)
- **Purpose:** Constant for insurance action
- **Value:** `"insurance"`
- **Read/Write:** Read-only

#### `BLACKJACK_NOINSURANCE`
- **Type:** `string` (constant)
- **Purpose:** Constant for no insurance action
- **Value:** `"noInsurance"`
- **Read/Write:** Read-only

### Other Game-Specific Variables

#### `difficulty`
- **Type:** `string`
- **Purpose:** Difficulty level for games that support it
- **Valid Values:** `"easy"`, `"medium"`, `"hard"`
- **Initial Value:** `"easy"`
- **Read/Write:** Read/Write

#### `tiles`
- **Type:** `array[number]`
- **Purpose:** Tiles to select for tile-based games
- **Initial Value:** `[2]`
- **Read/Write:** Read/Write

#### `eggs`
- **Type:** `array[number]`
- **Purpose:** Egg selections for dragon tower
- **Initial Value:** `[0]`
- **Read/Write:** Read/Write

#### `pumps`
- **Type:** `number`
- **Purpose:** Number of pumps for pump game
- **Initial Value:** `1`
- **Read/Write:** Read/Write

#### `lines`
- **Type:** `number`
- **Purpose:** Number of lines for slot-style games
- **Initial Value:** `1`
- **Read/Write:** Read/Write

#### `guesses`
- **Type:** `number`
- **Purpose:** Number of guesses for games like RPS, flip
- **Initial Value:** `1`
- **Read/Write:** Read/Write

#### `rolls`
- **Type:** `number`
- **Purpose:** Number of rolls for games like snakes
- **Initial Value:** `1`
- **Read/Write:** Read/Write

#### `steps`
- **Type:** `number`
- **Purpose:** Number of steps for chicken game
- **Initial Value:** `1`
- **Read/Write:** Read/Write

#### `chips`
- **Type:** `array[object]`
- **Purpose:** Chip placements for roulette
- **Structure:** `[{value: string, amount: number}]`
- **Example:** `[{value: "colorBlack", amount: 0.0001}]`
- **Initial Value:** `[{value: "colorBlack", amount: 0.0001}]`
- **Read/Write:** Read/Write

#### `pattern`
- **Type:** `array[number]`
- **Purpose:** Pattern of actions for multi-round games
- **Updated:** Set by user script
- **Example:** `[5, 5, 5]` for HiLo guesses
- **Initial Value:** `[]`
- **Read/Write:** Read/Write

### Bet Result Information

#### `lastBet`
- **Type:** `object`
- **Purpose:** Information about the last completed bet
- **Updated:** After each bet completes
- **Structure:**
  ```javascript
  {
    amount: number,        // Bet amount
    win: boolean,          // Whether it was a win
    Roll: number,          // Result value (game-specific)
    payoutMultiplier: number, // Payout multiplier
    chance: number,        // Win chance (for applicable games)
    target: number,        // Target value (game-specific)
    payout: number,        // Actual payout amount
    percent: number,       // Percent (game-specific)
    targetNumber: number,  // Target number display
    name: string | null    // User name
  }
  ```
- **Initial Value:** All zeros/false/null
- **Read/Write:** Read-only (updated by system)

### Control Variables

#### `stoponwin`
- **Type:** `boolean`
- **Purpose:** Whether to stop the bot on next win
- **Updated:** Can be set by user script
- **Initial Value:** `false`
- **Read/Write:** Read/Write

#### `fastmode`
- **Type:** `boolean`
- **Purpose:** Whether to run in fast mode (reduced delays)
- **Updated:** Can be set by user script
- **Initial Value:** `false`
- **Read/Write:** Read/Write

#### `sleeptime`
- **Type:** `number`
- **Purpose:** Milliseconds to sleep before next bet
- **Updated:** Set by `sleep()` function
- **Initial Value:** `0`
- **Read/Write:** Read/Write (via sleep() function)

### Internal State Variables

#### `cashout_done`
- **Type:** `boolean`
- **Purpose:** Whether a cashout has been completed for multi-round games
- **Updated:** System updates this during game flow
- **Initial Value:** `false`
- **Read/Write:** Read-only (system-controlled)

---

## Global Functions

### `dobet()`
- **Signature:** `function dobet()`
- **Parameters:** None
- **Return Value:** None
- **Purpose:** User-defined callback function called after each bet completes
- **Side Effects:** User modifies betting variables (nextbet, chance, etc.)
- **Example Usage:**
  ```javascript
  dobet = function() {
    if (win) {
      nextbet = basebet;
    } else {
      nextbet = previousbet * 2;
    }
  }
  ```
- **Notes:**
  - This function MUST be defined by the user script
  - Called automatically by the system after each bet completes (when `cashout_done == true`)
  - Not called for multi-round games (HiLo, Blackjack) until the round is complete

### `round()`
- **Signature:** `function round()`
- **Parameters:** None
- **Return Value:** `number` or `string` (action constant)
- **Purpose:** User-defined function for multi-round games (HiLo, Blackjack) to determine next action
- **Side Effects:** None (returns action to take)
- **Example Usage (HiLo):**
  ```javascript
  function round() {
    currentCardRank = currentBet.state.rounds.at(-1)?.card.rank || currentBet.state.startCard.rank;

    if (currentCardRank === "A") {
      return HILO_BET_HIGH;
    }
    if (currentCardRank === "K") {
      return HILO_BET_LOW;
    }
    return HILO_CASHOUT;
  }
  ```
- **Example Usage (Blackjack):**
  ```javascript
  function round() {
    // Access current hand value, dealer card, etc.
    // Return BLACKJACK_HIT, BLACKJACK_STAND, etc.
    return "BLACKJACK_STAND";
  }
  ```
- **Notes:**
  - Only used for HiLo and Blackjack games
  - Called during active rounds to determine next action
  - For HiLo: Returns HILO_BET_HIGH, HILO_BET_LOW, HILO_SKIP, HILO_BET_EQUAL, or HILO_CASHOUT
  - For Blackjack: Returns BLACKJACK_STAND, BLACKJACK_HIT, BLACKJACK_DOUBLE, BLACKJACK_SPLIT, BLACKJACK_INSURANCE, or BLACKJACK_NOINSURANCE

### `log(...args)`
- **Signature:** `function log(...args)`
- **Parameters:** Variable arguments (strings, numbers, objects)
- **Return Value:** None
- **Purpose:** Logs messages to the bot's log window
- **Side Effects:** Adds entry to UI log with timestamp
- **Example Usage:**
  ```javascript
  log("Current bet:", nextbet);
  log("Profit:", profit_total);
  ```
- **Notes:**
  - Supports multiple arguments
  - Automatically adds timestamp
  - Can use styled console.log format with %c

### `sleep(milliseconds)`
- **Signature:** `function sleep(ms)`
- **Parameters:**
  - `ms` (number): Milliseconds to sleep (optional, default 0)
- **Return Value:** None
- **Purpose:** Sets delay before next bet is placed
- **Side Effects:** Sets `sleeptime` variable
- **Example Usage:**
  ```javascript
  sleep(1000); // Wait 1 second before next bet
  ```
- **Notes:**
  - Delay is applied before the next bet
  - Does not block execution (asynchronous)
  - Sleep time is reset to 0 after each bet

### `stop()`
- **Signature:** `function stop()`
- **Parameters:** None
- **Return Value:** None
- **Purpose:** Stops the bot from running
- **Side Effects:**
  - Sets `running = false`
  - Sets `stoponwin = false`
  - Clears all timeouts
  - Resets UI state
- **Example Usage:**
  ```javascript
  dobet = function() {
    if (profit_total < -100) {
      log("Loss limit reached, stopping");
      stop();
    }
  }
  ```
- **Notes:**
  - Can be called from user script
  - Immediately stops bet loop
  - Cleans up internal state

### `resetstats()`
- **Signature:** `function resetstats()`
- **Parameters:** None
- **Return Value:** None
- **Purpose:** Resets all statistics to zero
- **Side Effects:**
  - Resets: bets, wins, losses, winstreak, losestreak, profit_total, wagered, etc.
  - Sets `started_bal` to current `balance`
  - Clears chart data
- **Example Usage:**
  ```javascript
  // User can call this manually or in script
  resetstats();
  ```
- **Notes:**
  - Does not affect current balance
  - Only resets session statistics
  - Resets chart

---

## Script Execution Lifecycle

### 1. Initialization Phase

When the user clicks "Start":

1. **System sets state:**
   - `running = true`
   - `run_clicked = true`
   - `cashout_done = false`

2. **System resets dobet:**
   - `dobet = function(){}` (cleared)

3. **System executes user script:**
   - User script code is wrapped in `setTimeout(userScript + additionalCode, 0)`
   - User script executes, which typically:
     - Sets `game` variable
     - Sets game-specific config (chance, bethigh, target, etc.)
     - Sets `basebet` and `nextbet`
     - Defines the `dobet()` function
     - Optionally defines `round()` function for HiLo/Blackjack

4. **System fetches balance:**
   - Calls `userBalances(true)` to get current balance
   - Sets `started_bal = balance`

5. **System places first bet:**
   - Calls appropriate game function based on `game` variable
   - Example: `DiceBet(nextbet, chance, bethigh)`

### 2. Bet Placement

For each bet:

1. **System constructs bet request:**
   - Gathers parameters from global variables
   - Makes API call to game endpoint

2. **System sends bet:**
   - POST request to Stake API
   - Includes authentication token
   - Includes bet parameters (amount, game config, etc.)

3. **System waits for response:**
   - Handles network errors
   - Retries on 403 errors (rate limiting)

### 3. Result Processing

When bet response is received:

1. **System parses response:**
   - Extracts bet object from JSON response
   - Determines game type from response structure

2. **System determines win/loss:**
   - For most games: `win = (bet.payoutMultiplier >= 1)`
   - Sets `lastBet.win = win`

3. **System updates statistics:**
   - `previousbet = bet.amount`
   - `current_profit = bet.payout - bet.amount`
   - `profit_total += current_profit`
   - `wagered += bet.amount`
   - `betcount++`
   - `bets = betcount`
   - `balance = current_balance + current_profit`

4. **System updates streaks:**
   - If win:
     - `winstreak++`
     - `wins++`
     - `losestreak = 0`
   - If loss:
     - `losestreak++`
     - `losses++`
     - `winstreak = 0`

5. **System updates tracking arrays:**
   - Updates `highest_bet` if `lastBet.amount` is higher
   - Updates `highest_profit` if `profit_total` is higher
   - Updates `lowest_profit` if `profit_total` is lower
   - Updates `highest_streak` if `currentstreak` is higher
   - Updates `lowest_streak` if `currentstreak` is lower

6. **System updates lastBet object:**
   - Game-specific result values (Roll, target, etc.)
   - Varies by game type

### 4. Script Callback

After result processing:

**For Simple Games (Dice, Limbo, Mines, Keno, etc.):**
1. System sets `cashout_done = true`
2. System calls user's `dobet()` function
3. User script reads global variables
4. User script modifies betting variables (nextbet, chance, etc.)
5. System checks stop conditions:
   - If `stoponwin && win`: call `stop()`
   - If `!running`: exit loop
6. System applies sleep delay if set
7. System places next bet

**For Multi-Round Games (HiLo, Blackjack):**
1. If bet is still active (`bet.active == true`):
   - System sets `cashout_done = false`
   - System sets `currentBet = bet`
   - System calls user's `round()` function
   - User returns action constant (HILO_BET_HIGH, BLACKJACK_HIT, etc.)
   - System processes action and continues game
2. If bet is complete (`bet.active == false`):
   - System sets `cashout_done = true`
   - System calls user's `dobet()` function
   - Flow continues as simple games

### 5. Loop Continuation

The betting loop continues until:
- User clicks stop
- `running` becomes false
- `stop()` is called from script
- Error occurs and cannot be recovered

### 6. Stop Phase

When stopped:
1. System sets `running = false`
2. System clears all pending timeouts
3. System resets UI state
4. System logs "Bot stop"

---

## Game-Specific Configuration

### Dice

**Required Variables:**
- `nextbet` - bet amount
- `chance` - win chance (0.01 to 98)
- `bethigh` - true for high, false for low

**Bet Function:** `DiceBet(amount, chance, bethigh)`

**Result Structure:**
```javascript
lastBet.Roll = bet.state.result;           // Actual roll (0-99.99)
lastBet.chance = bet.state.condition === "below" ? ... : ...;
lastBet.target = bet.state.target;         // Target number
lastBet.targetNumber = 99 / lastBet.chance; // Multiplier
```

**Example Script:**
```javascript
game = "dice"
chance = 49.5
bethigh = true
nextbet = 0.00000001
basebet = nextbet

dobet = function() {
  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 2;
  }
}
```

### Limbo

**Required Variables:**
- `nextbet` - bet amount
- `target` - target multiplier (1.01+)

**Bet Function:** `LimboBet(amount, target_multi)`

**Result Structure:**
```javascript
lastBet.Roll = bet.state.result;           // Actual result
lastBet.chance = 99 / bet.state.multiplierTarget;
lastBet.target = bet.state.multiplierTarget;
```

**Example Script:**
```javascript
game = "limbo"
target = 2.0
nextbet = 0.00000001
basebet = nextbet

dobet = function() {
  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 2;
  }
}
```

### Mines

**Required Variables:**
- `nextbet` - bet amount
- `mines` - number of mines (1-24)
- `fields` - array of field positions to click

**Bet Function:** `minesbet(betsize, fields, mines)`

**Result Structure:**
```javascript
lastBet.Roll = bet.state.mines;            // Mine positions
lastBet.target = fields.length;            // Number of clicks
lastBet.targetNumber = `${minefield.length}|${fields.length}`;
```

**Example Script:**
```javascript
game = "mines"
mines = 3
fields = [1, 2, 3, 4]
nextbet = 0.00000001
basebet = nextbet

dobet = function() {
  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 1.5;
  }
}
```

### Keno

**Required Variables:**
- `nextbet` - bet amount
- `numbers` - array of numbers to pick (0-39)
- `risk` - "low", "medium", or "high"

**Bet Function:** `kenobet(nextbet, numbers, risk)`

**Result Structure:**
```javascript
lastBet.Roll = bet.state.drawnNumbers;     // Drawn numbers
lastBet.target = kenofield.length;         // Numbers picked
lastBet.targetNumber = `${bet.state.risk}|${kenofield.length}`;
lastBet.hitCount = hitkeno.length;         // Numbers hit
```

**Example Script:**
```javascript
game = "keno"
risk = "low"
numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
nextbet = 0.00000001
basebet = nextbet

dobet = function() {
  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 2;
  }
}
```

### Plinko

**Required Variables:**
- `nextbet` - bet amount
- `rows` - number of rows (8, 12, or 16)
- `risk` - "low", "medium", or "high"

**Bet Function:** `plinkobet(nextbet, rows, risk)`

**Example Script:**
```javascript
game = "plinko"
rows = 16
risk = "high"
nextbet = 0.00000001
basebet = nextbet

dobet = function() {
  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 1.5;
  }
}
```

### Wheel

**Required Variables:**
- `nextbet` - bet amount
- `segments` - number of segments (10, 20, 30, 40, 50)
- `risk` - "low", "medium", or "high"

**Bet Function:** `wheelbet(nextbet, segments, risk)`

**Example Script:**
```javascript
game = "wheel"
segments = 50
risk = "high"
nextbet = 0.00000001
basebet = nextbet

dobet = function() {
  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 2;
  }
}
```

### Baccarat

**Required Variables:**
- `betamount` - object with player, banker, tie amounts
- OR individual `player`, `banker`, `tie` variables

**Bet Function:** `baccaratbet(tie, player, banker)`

**Result Structure:**
```javascript
lastBet.Roll = bet.state.winner;           // "player", "banker", or "tie"
lastBet.win = bet.payoutMultiplier >= 1;
```

**Example Script:**
```javascript
game = "baccarat"
betamount = {player: 0.00000001, banker: 0, tie: 0}

dobet = function() {
  if (win) {
    betamount.player = 0.00000001;
  } else {
    betamount.player = betamount.player * 2;
  }
}
```

### HiLo

**Required Variables:**
- `nextbet` - bet amount
- `startcard` - starting card object `{rank: "A", suit: "H"}`
- `pattern` - optional array of guess patterns

**Required Functions:**
- `round()` - returns action constant for each card

**Bet Function:** `hiloBet(nextbet, startcard)`

**Action Constants:**
- `HILO_BET_LOW = 4`
- `HILO_BET_HIGH = 5`
- `HILO_BET_EQUAL = 2`
- `HILO_SKIP = 7`
- `HILO_CASHOUT = 3`

**currentBet Structure (during active game):**
```javascript
currentBet.state.rounds           // Array of previous rounds
currentBet.state.startCard        // Starting card
currentBet.state.rounds.at(-1)?.card.rank  // Last card rank
currentBet.state.rounds.at(-1)?.payoutMultiplier  // Current multiplier
```

**Example Script:**
```javascript
game = "hilo"
startcard = {rank: "7", suit: "H"}
nextbet = 0.00000001
basebet = nextbet
index = 0
pattern = [5, 5, 5] // Three high guesses

dobet = function() {
  index = 0;
  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 2;
  }
}

function round() {
  currentCardRank = currentBet.state.rounds.at(-1)?.card.rank || currentBet.state.startCard.rank;

  if (index >= pattern.length) {
    return HILO_CASHOUT;
  }

  guessing = pattern[index];
  index++;

  // Logic based on current card
  if (currentCardRank === "A" && guessing === 4) {
    return HILO_BET_LOW;
  }
  if (currentCardRank === "K" && guessing === 4) {
    return HILO_BET_HIGH;
  }

  if (guessing === 5) return HILO_BET_HIGH;
  if (guessing === 4) return HILO_BET_LOW;

  return HILO_SKIP;
}
```

### Blackjack

**Required Variables:**
- `nextbet` - bet amount

**Required Functions:**
- `round()` - returns action constant for each decision

**Bet Function:** `blackjackBet(nextbet)`

**Action Constants:**
- `BLACKJACK_STAND = "stand"`
- `BLACKJACK_HIT = "hit"`
- `BLACKJACK_DOUBLE = "double"`
- `BLACKJACK_SPLIT = "split"`
- `BLACKJACK_INSURANCE = "insurance"`
- `BLACKJACK_NOINSURANCE = "noInsurance"`

**Example Script:**
```javascript
game = "blackjack"
nextbet = 0.00000001
basebet = nextbet

dobet = function() {
  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 2;
  }
}

function round() {
  // Basic strategy logic here
  // Access currentBet.state for hand information
  return "BLACKJACK_STAND";
}
```

### Roulette

**Required Variables:**
- `chips` - array of chip placements

**Chip Structure:**
```javascript
{
  value: string,    // Bet type: "colorBlack", "colorRed", "0", "1-12", etc.
  amount: number    // Bet amount
}
```

**Bet Function:** `roulettebet(chips)`

**Valid Bet Types:**
- Colors: `"colorBlack"`, `"colorRed"`
- Dozens: `"1-12"`, `"13-24"`, `"25-36"`
- Halves: `"1-18"`, `"19-36"`
- Parity: `"even"`, `"odd"`
- Numbers: `"0"`, `"1"`, `"2"`, ..., `"36"`
- Splits, streets, corners, etc.

**Example Script:**
```javascript
game = "roulette"
chips = [{value: "colorBlack", amount: 0.00000001}]

dobet = function() {
  if (win) {
    chips[0].amount = 0.00000001;
  } else {
    chips[0].amount = chips[0].amount * 2;
  }
}
```

---

## Example Scripts

### Example 1: Simple Martingale (Dice)

```javascript
game = "dice"
chance = 49.5
bethigh = true
nextbet = 0.00000001
basebet = nextbet
currency = "usdc"

dobet = function() {
  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 2;
  }
}
```

### Example 2: Stop on Profit/Loss

```javascript
game = "limbo"
target = 2.0
nextbet = 0.00000001
basebet = nextbet
currency = "trx"

targetProfit = 0.0001
stopLoss = -0.0001

dobet = function() {
  if (profit_total >= targetProfit) {
    log("Target profit reached:", profit_total);
    stop();
    return;
  }

  if (profit_total <= stopLoss) {
    log("Stop loss triggered:", profit_total);
    stop();
    return;
  }

  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 2;
  }
}
```

### Example 3: Streak-Based Betting

```javascript
game = "dice"
chance = 49.5
bethigh = true
nextbet = 0.00000001
basebet = nextbet

dobet = function() {
  if (winstreak >= 3) {
    // After 3 wins, increase bet
    nextbet = basebet * 2;
  } else if (losestreak >= 3) {
    // After 3 losses, reset to base
    nextbet = basebet;
  } else if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 2;
  }
}
```

### Example 4: Dynamic Chance Adjustment

```javascript
game = "dice"
chance = 49.5
bethigh = true
nextbet = 0.00000001
basebet = nextbet

dobet = function() {
  // Adjust chance based on balance
  if (balance > started_bal * 1.5) {
    chance = 95; // Play safer with profit
  } else if (balance < started_bal * 0.5) {
    chance = 10; // Take more risk to recover
  } else {
    chance = 49.5;
  }

  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 1.5;
  }
}
```

### Example 5: HiLo Pattern Strategy

```javascript
game = "hilo"
startcard = {rank: "7", suit: "H"}
nextbet = 0.00000001
basebet = nextbet
index = 0
pattern = [5, 5, 5] // High, High, High

dobet = function() {
  index = 0;
  if (win) {
    nextbet = basebet;
    log("Win! Profit:", profit_total);
  } else {
    nextbet = previousbet * 2;
    log("Loss! Profit:", profit_total);
  }
}

function round() {
  currentCardRank = currentBet.state.rounds.at(-1)?.card.rank || currentBet.state.startCard.rank;
  payoutMultiplier = currentBet.state.rounds.at(-1)?.payoutMultiplier || 0;

  if (index >= pattern.length) {
    log("Pattern complete, cashing out at", payoutMultiplier + "x");
    return HILO_CASHOUT;
  }

  guessing = pattern[index];
  index++;

  // Smart play based on card
  if (currentCardRank === "A") {
    return guessing === 4 ? HILO_BET_LOW : HILO_BET_HIGH;
  }
  if (currentCardRank === "K") {
    return guessing === 5 ? HILO_BET_LOW : HILO_BET_HIGH;
  }

  if (guessing === 5) return HILO_BET_HIGH;
  if (guessing === 4) return HILO_BET_LOW;

  return HILO_SKIP;
}
```

### Example 6: Multi-Game Switching

```javascript
currentGame = 0
games = ["dice", "limbo", "plinko"]
game = games[currentGame]

chance = 49.5
bethigh = true
target = 2.0
rows = 8
risk = "low"

nextbet = 0.00000001
basebet = nextbet

dobet = function() {
  // Switch game every 10 bets
  if (bets % 10 === 0) {
    currentGame = (currentGame + 1) % games.length;
    game = games[currentGame];
    log("Switching to", game);
  }

  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 2;
  }
}
```

### Example 7: Time-Based Betting

```javascript
game = "dice"
chance = 49.5
bethigh = true
nextbet = 0.00000001
basebet = nextbet
maxBets = 100

dobet = function() {
  if (bets >= maxBets) {
    log("Max bets reached, stopping");
    stop();
    return;
  }

  // Slow down betting
  sleep(1000); // 1 second between bets

  if (win) {
    nextbet = basebet;
  } else {
    nextbet = previousbet * 2;
  }
}
```

---

## Implementation Notes for Go Runtime

### Variable Scoping
- All global variables must be accessible to user scripts
- User scripts can read and write most variables
- Some variables are read-only and should be protected (balance, win, previousbet, etc.)

### Function Sandboxing
- User scripts should NOT have access to:
  - Network functions (fetch, XMLHttpRequest)
  - File system
  - DOM manipulation (document, window)
  - System functions (eval, Function constructor)
- User scripts SHOULD have access to:
  - Math functions
  - String/Array manipulation
  - Basic console.log (mapped to log())

### Execution Context
- User script is executed once at start to define `dobet()` and `round()`
- `dobet()` is called after each completed bet
- `round()` is called during active multi-round games
- All execution should be synchronous (no async/await)

### Error Handling
- User script errors should not crash the bot
- Errors should be logged and bot should stop
- Provide meaningful error messages to user

### Type Safety
- JavaScript is dynamically typed, Go runtime must handle:
  - Number coercion (strings to numbers, etc.)
  - Boolean coercion
  - Undefined/null values
  - Type mismatches in comparisons

### Performance
- User scripts may run thousands of times in a session
- Optimize script execution (compile once, execute many)
- Consider using a JavaScript VM (goja, otto) or Lua runtime

### State Preservation
- Global variables persist across `dobet()` calls
- User can define their own variables (counters, flags, etc.)
- State should be isolated per session

---

## Game Result Determination

### Win Condition
For most games:
```javascript
win = (bet.payoutMultiplier >= 1)
```

This means:
- `payoutMultiplier < 1` = loss (0x payout)
- `payoutMultiplier = 1` = push/break-even (1x payout)
- `payoutMultiplier > 1` = win (>1x payout)

### Profit Calculation
```javascript
current_profit = bet.payout - bet.amount
profit_total += current_profit
```

Where:
- `bet.payout` = `bet.amount * bet.payoutMultiplier`
- For a win: `payout > amount`, so `current_profit > 0`
- For a loss: `payout = 0`, so `current_profit = -amount`

### Balance Updates
```javascript
current_balance += current_profit
balance = current_balance
```

Balance is tracked locally and periodically refreshed from server.

---

## Security Considerations

### For Go Implementation

1. **Sandboxing:**
   - User scripts must run in isolated VM
   - No access to Go runtime internals
   - No access to network/file system
   - Limited CPU/memory resources

2. **Variable Protection:**
   - Protect read-only variables from modification
   - Validate user inputs before bet placement
   - Prevent negative bet amounts
   - Prevent invalid game configurations

3. **Script Validation:**
   - Validate script syntax before execution
   - Check for infinite loops
   - Set execution timeouts
   - Limit script size

4. **API Safety:**
   - Don't expose sensitive data to scripts
   - Don't allow scripts to modify API tokens
   - Validate all bet parameters before API calls

---

## Conclusion

This document provides a complete specification of the bot2love scripting model. A Go implementation should:

1. Provide all global variables with correct types and update timing
2. Implement the `dobet()` callback pattern
3. Support multi-round games with `round()` function
4. Provide safe implementations of global functions
5. Maintain accurate statistics and state
6. Handle errors gracefully
7. Sandbox user scripts for security

The scripting model is designed to be simple for users while providing powerful control over betting strategies. The Go implementation should maintain this balance while adding necessary safety and performance optimizations.
