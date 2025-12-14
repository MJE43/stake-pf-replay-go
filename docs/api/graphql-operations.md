# Stake API Documentation - GraphQL & REST Operations

Comprehensive documentation of all GraphQL and REST API operations extracted from the bot2love extension.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URLs](#base-urls)
4. [GraphQL Operations](#graphql-operations)
   - [Mutations](#graphql-mutations)
   - [Queries](#graphql-queries)
5. [REST API Endpoints](#rest-api-endpoints)
   - [Casino Game Bets](#casino-game-bets)
   - [Active Bet Queries](#active-bet-queries)
6. [Response Structures](#response-structures)
7. [Error Handling](#error-handling)

---

## Overview

The Stake API uses a combination of GraphQL and REST endpoints for different operations:
- **GraphQL**: Used for account operations (seed rotation, vault deposits, balance queries)
- **REST**: Used for casino game betting operations

## Authentication

All API requests require authentication via the `x-access-token` header.

### Token Retrieval
```javascript
// Token is extracted from session cookie
const tokenapi = getCookie("session");

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}
```

### Request Headers
```typescript
{
  'Content-Type': 'application/json',
  'x-access-token': string  // Session token from cookie
}
```

## Base URLs

```typescript
// Dynamic based on current host
const mirror = window.location.host;  // e.g., "stake.com"

// GraphQL Endpoint
const GRAPHQL_URL = `https://${mirror}/_api/graphql`;

// REST Endpoints
const REST_BASE_URL = `https://${mirror}/_api/casino`;
```

---

## GraphQL Operations

### GraphQL Endpoint
```
POST https://{mirror}/_api/graphql
```

All GraphQL requests follow this structure:
```typescript
interface GraphQLRequest {
  operationName: string;
  variables: Record<string, any>;
  query: string;
}
```

---

## GraphQL Mutations

### 1. RotateSeedPair

Rotates the client/server seed pair for provably fair gaming.

**Operation Name**: `RotateSeedPair`

**Variables**:
```typescript
{
  seed: string;  // New client seed
}
```

**Query**:
```graphql
mutation RotateSeedPair($seed: String!) {
  rotateSeedPair(seed: $seed) {
    clientSeed {
      user {
        id
        activeClientSeed {
          id
          seed
          __typename
        }
        activeServerSeed {
          id
          nonce
          seedHash
          nextSeedHash
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}
```

**Request Example**:
```javascript
const body = {
  operationName: "RotateSeedPair",
  variables: { seed: "randomClientSeed123" },
  query: `mutation RotateSeedPair($seed: String!) { ... }`
};

fetch(`https://${mirror}/_api/graphql`, {
  method: 'POST',
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    'x-access-token': tokenapi
  }
});
```

**Response Structure**:
```typescript
interface RotateSeedPairResponse {
  data: {
    rotateSeedPair: {
      clientSeed: {
        user: {
          id: string;
          activeClientSeed: {
            id: string;
            seed: string;
            __typename: string;
          };
          activeServerSeed: {
            id: string;
            nonce: number;
            seedHash: string;
            nextSeedHash: string;
            __typename: string;
          };
          __typename: string;
        };
        __typename: string;
      };
      __typename: string;
    };
  };
  errors?: ErrorType[];
}
```

**Error Handling**:
```javascript
function outseed(json) {
  if (json?.errors) {
    log(json.errors[0].errorType);
    log(json.errors[0].message);
  } else {
    log("Seed has been reset.");
  }
}
```

---

### 2. CreateVaultDeposit

Deposits funds into the user's vault.

**Operation Name**: `CreateVaultDeposit`

**Variables**:
```typescript
{
  currency: CurrencyEnum;  // e.g., "btc", "eth", "usdt"
  amount: number;          // Amount to deposit
}
```

**Query**:
```graphql
mutation CreateVaultDeposit($currency: CurrencyEnum!, $amount: Float!) {
  createVaultDeposit(currency: $currency, amount: $amount) {
    id
    amount
    currency
    user {
      id
      balances {
        available {
          amount
          currency
          __typename
        }
        vault {
          amount
          currency
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}
```

**Request Example**:
```javascript
const body = {
  operationName: "CreateVaultDeposit",
  variables: {
    currency: "btc",
    amount: 0.001
  },
  query: `mutation CreateVaultDeposit($currency: CurrencyEnum!, $amount: Float!) { ... }`
};

fetch(`https://${mirror}/_api/graphql`, {
  method: 'POST',
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    'x-access-token': tokenapi
  }
});
```

**Response Structure**:
```typescript
interface CreateVaultDepositResponse {
  data: {
    createVaultDeposit: {
      id: string;
      amount: number;
      currency: string;
      user: {
        id: string;
        balances: Balance[];
        __typename: string;
      };
      __typename: string;
    };
  };
  errors?: ErrorType[];
}

interface Balance {
  available: {
    amount: number;
    currency: string;
    __typename: string;
  };
  vault: {
    amount: number;
    currency: string;
    __typename: string;
  };
  __typename: string;
}
```

**Error Handling**:
```javascript
function outvault(json) {
  if (json.errors != undefined) {
    log(json.errors[0].errorType);
  } else {
    log("Deposited " + json.data.createVaultDeposit.amount.toFixed(10) + " to vault.")
  }
}
```

---

## GraphQL Queries

### 1. UserBalances

Retrieves user's current balances across all currencies.

**Operation Name**: `UserBalances`

**Variables**:
```typescript
{}  // No variables required
```

**Query**:
```graphql
query UserBalances {
  user {
    id
    balances {
      available {
        amount
        currency
        __typename
      }
      vault {
        amount
        currency
        __typename
      }
      __typename
    }
    __typename
  }
}
```

**Request Example**:
```javascript
const body = {
  operationName: "UserBalances",
  variables: {},
  query: `query UserBalances { ... }`
};

fetch(`https://${mirror}/_api/graphql`, {
  method: 'POST',
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    'x-access-token': tokenapi
  }
});
```

**Response Structure**:
```typescript
interface UserBalancesResponse {
  data: {
    user: {
      id: string;
      balances: Balance[];
      __typename: string;
    };
  };
  errors?: ErrorType[];
}

interface Balance {
  available: {
    amount: number;
    currency: string;
    __typename: string;
  };
  vault: {
    amount: number;
    currency: string;
    __typename: string;
  };
  __typename: string;
}
```

**Response Processing**:
```javascript
function outbals(json, newbal) {
  balance = 0;
  current_balance = 0;

  for (var i = 0; i < json.data.user.balances.length; i++) {
    if (json.data.user.balances[i].available.currency == currency) {
      current_balance = json.data.user.balances[i].available.amount;
      balance = current_balance;
    }
  }
}
```

---

## REST API Endpoints

All REST endpoints use POST method with JSON body and require the `x-access-token` header.

### Common Request Pattern

```javascript
function betRequest({ url, body, retryParams = [], retryDelay = 1000 }) {
  fetch(`https://${mirror}/${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': tokenapi
    }
  })
  .then(res => {
    if (!res.ok) throw { status: res.status };
    return res.json();
  })
  .then(json => data(json))
  .catch(err => {
    // Retry logic with delays
    if (err.status === 403) {
      // Handle rate limiting
      setTimeout(() => retryBet(), 2000);
    } else {
      setTimeout(() => betRequest({ url, body, retryParams, retryDelay }), 2000);
    }
  });
}
```

---

## Casino Game Bets

### 1. Dice Roll

**Endpoint**: `POST /_api/casino/dice/roll`

**Request Body**:
```typescript
{
  target: number;          // Target number (0-100)
  condition: "above" | "below";
  identifier: string;      // Random 21-char string
  amount: number;          // Bet amount
  currency: string;        // Currency code
}
```

**Example**:
```javascript
function DiceBet(amount, chance, bethigh) {
  let target, cond;

  if (bethigh) {
    target = 100 - chance;
    cond = "above";
  } else {
    target = chance;
    cond = "below";
  }

  const body = {
    target,
    condition: cond,
    identifier: randomString(21),
    amount,
    currency
  };

  betRequest({
    url: '_api/casino/dice/roll',
    body,
    retryDelay: 2000,
    retryParams: [amount, chance, bethigh]
  });
}
```

**Response Structure**:
```typescript
interface DiceRollResponse {
  diceRoll: {
    id: string;
    amount: number;
    payout: number;
    payoutMultiplier: number;
    currency: string;
    active: boolean;
    state: {
      result: number;        // Actual roll result
      target: number;        // Target number
      condition: "above" | "below";
    };
    user: {
      id: string;
      name: string;
    };
  };
}
```

---

### 2. Limbo Bet

**Endpoint**: `POST /_api/casino/limbo/bet`

**Request Body**:
```typescript
{
  multiplierTarget: number;  // Target multiplier
  identifier: string;        // Random 21-char string
  amount: number;           // Bet amount
  currency: string;         // Currency code
}
```

**Example**:
```javascript
function LimboBet(amount, target_multi) {
  betRequest({
    url: '_api/casino/limbo/bet',
    body: {
      multiplierTarget: target_multi,
      identifier: randomString(21),
      amount,
      currency
    },
    retryDelay: 2000,
    retryParams: [amount, target_multi]
  });
}
```

**Response Structure**:
```typescript
interface LimboBetResponse {
  limboBet: {
    id: string;
    amount: number;
    payout: number;
    payoutMultiplier: number;
    currency: string;
    active: boolean;
    state: {
      result: number;           // Actual multiplier
      multiplierTarget: number; // Target multiplier
    };
    user: {
      id: string;
      name: string;
    };
  };
}
```

---

### 3. Keno Bet

**Endpoint**: `POST /_api/casino/keno/bet`

**Request Body**:
```typescript
{
  amount: number;           // Bet amount
  currency: string;         // Currency code
  identifier: string;       // Random 21-char string
  risk: "low" | "medium" | "high";
  numbers: number[];        // Selected numbers (0-39)
}
```

**Example**:
```javascript
function kenobet(betsize, selected, risk) {
  betRequest({
    url: '_api/casino/keno/bet',
    body: {
      amount: betsize,
      currency,
      identifier: randomString(21),
      risk,
      numbers: selected
    },
    retryParams: [betsize, selected, risk]
  });
}
```

**Response Structure**:
```typescript
interface KenoBetResponse {
  kenoBet: {
    id: string;
    amount: number;
    payout: number;
    payoutMultiplier: number;
    currency: string;
    active: boolean;
    state: {
      selectedNumbers: number[];  // Numbers selected by user
      drawnNumbers: number[];     // Numbers drawn by system
      risk: "low" | "medium" | "high";
    };
    user: {
      id: string;
      name: string;
    };
  };
}
```

---

### 4. Mines Bet

**Endpoint**: `POST /_api/casino/mines/bet`

**Request Body**:
```typescript
{
  amount: number;           // Bet amount
  currency: string;         // Currency code
  identifier?: string;      // Random 21-char string (optional)
  minesCount: number;       // Number of mines (1-24)
  fields?: number[];        // Optional: pre-select fields
}
```

**Example**:
```javascript
function minesbet(betsize, fields, mines) {
  betRequest({
    url: '_api/casino/mines/bet',
    body: {
      amount: betsize,
      currency,
      identifier: randomString(21),
      minesCount: mines,
      fields
    },
    retryParams: [betsize, fields, mines]
  });
}
```

**Response Structure**:
```typescript
interface MinesBetResponse {
  minesBet: {
    id: string;
    amount: number;
    payout: number;
    payoutMultiplier: number;
    currency: string;
    active: boolean;  // true if game ongoing
    state: {
      mines: number[];    // Mine positions
      minesCount: number; // Number of mines
      rounds: Array<{
        field: number;
        payoutMultiplier: number;
      }>;
    };
    user: {
      id: string;
      name: string;
    };
  };
}
```

---

### 5. Mines Next

**Endpoint**: `POST /_api/casino/mines/next`

**Request Body**:
```typescript
{
  fields: number[];  // Field indices to reveal
}
```

**Example**:
```javascript
function minesNext(fields) {
  betRequest({
    url: '_api/casino/mines/next',
    body: { fields },
    retryParams: [fields]
  });
}
```

**Response Structure**: Same as MinesBet, with updated `state.rounds` array.

---

### 6. Mines Cashout

**Endpoint**: `POST /_api/casino/mines/cashout`

**Request Body**:
```typescript
{
  identifier: string;  // Random 21-char string
}
```

**Example**:
```javascript
function minesCashout() {
  betRequest({
    url: '_api/casino/mines/cashout',
    body: { identifier: randomString(21) },
    retryParams: []
  });
}
```

**Response Structure**:
```typescript
interface MinesCashoutResponse {
  minesCashout: {
    id: string;
    amount: number;
    payout: number;
    payoutMultiplier: number;
    currency: string;
    active: false;  // Always false after cashout
    state: {
      mines: number[];
      minesCount: number;
      rounds: Array<{
        field: number;
        payoutMultiplier: number;
      }>;
    };
  };
}
```

---

### 7. HiLo Bet

**Endpoint**: `POST /_api/casino/hilo/bet`

**Request Body**:
```typescript
{
  identifier: string;  // Random 21-char string
  currency: string;    // Currency code
  amount: number;      // Bet amount
  startCard: {
    rank: string;      // "A", "2"-"10", "J", "Q", "K"
    suit: string;      // "C", "D", "H", "S"
  };
}
```

**Example**:
```javascript
function hiloBet(betsize, startcard) {
  resetCards();
  betRequest({
    url: '_api/casino/hilo/bet',
    body: {
      identifier: randomString(21),
      currency,
      amount: betsize,
      startCard: startcard
    },
    retryParams: [betsize, startcard]
  });
}
```

**Response Structure**:
```typescript
interface HiloBetResponse {
  hiloBet: {
    id: string;
    amount: number;
    payout: number;
    payoutMultiplier: number;
    currency: string;
    active: boolean;
    state: {
      startCard: {
        rank: string;
        suit: string;
      };
      rounds: Array<{
        card: {
          rank: string;
          suit: string;
        };
        guess: "higher" | "lower" | "equal" | "skip" | "higherEqual" | "lowerEqual";
        payoutMultiplier: number;
      }>;
    };
    user: {
      id: string;
      name: string;
    };
  };
}
```

---

### 8. HiLo Next

**Endpoint**: `POST /_api/casino/hilo/next`

**Request Body**:
```typescript
{
  guess: "higher" | "lower" | "equal" | "skip" | "higherEqual" | "lowerEqual";
}
```

**Example**:
```javascript
function hiloNext(guessed) {
  betRequest({
    url: '_api/casino/hilo/next',
    body: { guess: guessed },
    retryParams: [guessed]
  });
}
```

**Response Structure**: Same as HiloBet, with updated `state.rounds` array.

---

### 9. HiLo Cashout

**Endpoint**: `POST /_api/casino/hilo/cashout`

**Request Body**:
```typescript
{
  identifier: string;  // Random 21-char string
}
```

**Example**:
```javascript
function hiloCash() {
  betRequest({
    url: '_api/casino/hilo/cashout',
    body: { identifier: randomString(21) }
  });
}
```

**Response Structure**:
```typescript
interface HiloCashoutResponse {
  hiloCashout: {
    id: string;
    amount: number;
    payout: number;
    payoutMultiplier: number;
    currency: string;
    active: false;
    state: {
      startCard: Card;
      rounds: Round[];
    };
  };
}
```

---

### 10. Baccarat Bet

**Endpoint**: `POST /_api/casino/baccarat/bet`

**Request Body**:
```typescript
{
  currency: string;    // Currency code
  identifier: string;  // Random 21-char string
  tie: number;         // Bet amount on tie (0 if not betting)
  player: number;      // Bet amount on player (0 if not betting)
  banker: number;      // Bet amount on banker (0 if not betting)
}
```

**Example**:
```javascript
function baccaratbet(tie, player, banker) {
  betRequest({
    url: '_api/casino/baccarat/bet',
    body: {
      currency,
      identifier: randomString(21),
      tie,
      player,
      banker
    },
    retryParams: [tie, player, banker]
  });
}
```

**Response Structure**:
```typescript
interface BaccaratBetResponse {
  baccaratBet: {
    id: string;
    amount: number;
    payout: number;
    payoutMultiplier: number;
    currency: string;
    active: boolean;
    state: {
      winner: "player" | "banker" | "tie";
      playerCards: Card[];
      bankerCards: Card[];
      playerScore: number;
      bankerScore: number;
    };
    user: {
      id: string;
      name: string;
    };
  };
}
```

---

### 11. Blackjack Bet

**Endpoint**: `POST /_api/casino/blackjack/bet`

**Request Body**:
```typescript
{
  identifier: string;  // Random 21-char string
  currency: string;    // Currency code
  amount: number;      // Bet amount
}
```

**Example**:
```javascript
function blackjackBet(betsize) {
  betRequest({
    url: '_api/casino/blackjack/bet',
    body: {
      identifier: randomString(21),
      currency,
      amount: betsize
    },
    retryParams: [betsize]
  });
}
```

**Response Structure**:
```typescript
interface BlackjackBetResponse {
  blackjackBet: {
    id: string;
    amount: number;
    payout: number;
    payoutMultiplier: number;
    currency: string;
    active: boolean;
    state: {
      dealerCards: Card[];
      playerHands: Array<{
        cards: Card[];
        doubled: boolean;
        split: boolean;
        value: number;
      }>;
      currentHandIndex: number;
      insuranceOffered: boolean;
      insuranceTaken: boolean;
    };
    user: {
      id: string;
      name: string;
    };
  };
}
```

---

### 12. Blackjack Next

**Endpoint**: `POST /_api/casino/blackjack/next`

**Request Body**:
```typescript
{
  action: "hit" | "stand" | "double" | "split" | "insurance" | "noInsurance";
  identifier: string;  // Random 21-char string
}
```

**Example**:
```javascript
function blackjackNext(nextaction) {
  betRequest({
    url: '_api/casino/blackjack/next',
    body: {
      action: nextaction,
      identifier: randomString(21)
    },
    retryParams: [nextaction]
  });
}
```

**Response Structure**: Same as BlackjackBet, with updated game state.

---

## Active Bet Queries

These endpoints retrieve active (in-progress) bets for games that support multi-round gameplay.

### 1. HiLo Active Bet

**Endpoint**: `POST /_api/casino/active-bet/hilo`

**Request Body**:
```typescript
{}  // Empty body
```

**Example**:
```javascript
function activeBet() {
  fetch('https://' + mirror + '/_api/casino/active-bet/hilo', {
    method: 'post',
    body: JSON.stringify({}),
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': tokenapi
    }
  })
  .then(res => res.json())
  .then(json => outbet(json))
  .catch(err => console.log(err));
}
```

**Response Structure**:
```typescript
interface ActiveBetHiloResponse {
  user: {
    activeCasinoBet: HiloBetResponse['hiloBet'] | null;
  };
}
```

---

### 2. Mines Active Bet

**Endpoint**: `POST /_api/casino/active-bet/mines`

**Request Body**:
```typescript
{}  // Empty body
```

**Example**:
```javascript
function activeBetMines() {
  fetch('https://' + mirror + '/_api/casino/active-bet/mines', {
    method: 'post',
    body: JSON.stringify({}),
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': tokenapi
    }
  })
  .then(res => res.json())
  .then(json => outbetmine(json))
  .catch(err => console.log(err));
}
```

**Response Structure**:
```typescript
interface ActiveBetMinesResponse {
  user: {
    activeCasinoBet: MinesBetResponse['minesBet'] | null;
  };
}
```

---

### 3. Blackjack Active Bet

**Endpoint**: `POST /_api/casino/active-bet/blackjack`

**Request Body**:
```typescript
{}  // Empty body
```

**Example**:
```javascript
function activeBetBJ() {
  fetch('https://' + mirror + '/_api/casino/active-bet/blackjack', {
    method: 'post',
    body: JSON.stringify({}),
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': tokenapi
    }
  })
  .then(res => res.json())
  .then(json => outbetbj(json))
  .catch(err => console.log(err));
}
```

**Response Structure**:
```typescript
interface ActiveBetBlackjackResponse {
  user: {
    activeCasinoBet: BlackjackBetResponse['blackjackBet'] | null;
  };
}
```

---

## Response Structures

### Common Types

```typescript
interface Card {
  rank: "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
  suit: "C" | "D" | "H" | "S";  // Clubs, Diamonds, Hearts, Spades
}

interface User {
  id: string;
  name: string;
  __typename?: string;
}

interface BaseBetResponse {
  id: string;
  amount: number;
  payout: number;
  payoutMultiplier: number;
  currency: string;
  active: boolean;
  user: User;
}
```

### Response Wrapper

Most REST API responses return the bet object directly:
```typescript
interface BetResponse {
  [gameType: string]: BaseBetResponse & {
    state: any;  // Game-specific state
  };
}
```

For GraphQL responses:
```typescript
interface GraphQLResponse {
  data?: any;
  errors?: ErrorType[];
}
```

---

## Error Handling

### Error Structure

```typescript
interface ErrorType {
  errorType: string;
  message: string;
  path?: string[];
  locations?: Array<{
    line: number;
    column: number;
  }>;
}

interface ErrorResponse {
  errors: ErrorType[];
}
```

### Common Error Types

1. **parallelCasinoBet**: Multiple bets placed simultaneously
2. **existingGame**: Active game already exists for this game type
3. **notFound**: Bet or resource not found
4. **insignificantBet**: Bet amount too small
5. **insufficientBalance**: Not enough funds
6. **invalidSeed**: Invalid seed format for RotateSeedPair

### Error Handling Pattern

```javascript
function data(json) {
  if (json.errors != null) {
    // Check for specific error types
    if (json.errors[0].errorType.includes("parallelCasinoBet")) {
      // Handle parallel bet error
    }
    if (json.errors[0].errorType.includes("existingGame")) {
      // Retrieve active bet
      if (game === "hilo") activeBet();
      if (game === "mines") activeBetMines();
      if (game === "blackjack") activeBetBJ();
    }
    if (json.errors[0].errorType.includes("notFound")) {
      cashout_done = true;
    }
    if (json.errors[0].errorType.includes("insignificantBet")) {
      cashout_done = true;
    }

    log(json.errors[0].errorType + ". " + json.errors[0].message);
    return;
  }

  // Process successful response
  const gameType = Object.keys(json)[0] === "data"
    ? Object.keys(json.data)[0]
    : Object.keys(json)[0];

  const bet = Object.keys(json)[0] === "data"
    ? json.data[gameType]
    : json[gameType];
}
```

### HTTP Status Codes

- **200**: Success
- **403**: Rate limited or forbidden (retry with delay)
- **4xx/5xx**: Other errors (retry with exponential backoff)

### Retry Logic

```javascript
function betRequest({ url, body, retryParams = [], retryDelay = 1000 }) {
  fetch(`https://${mirror}/${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': tokenapi
    }
  })
  .then(res => {
    if (!res.ok) throw { status: res.status };
    return res.json();
  })
  .then(json => data(json))
  .catch(err => {
    if (running) {
      if (err.status === 403) {
        // Rate limit - retry after 2 seconds and restart game
        setTimeout(() => restartGame(), 2000);
      } else {
        // Other error - retry same request after delay
        setTimeout(() => {
          betRequest({ url, body, retryParams, retryDelay });
        }, retryDelay);
      }
    }
  });
}
```

---

## Utility Functions

### Random String Generation

```javascript
function randomString(length) {
  var chars = '_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-';
  var result = '';
  for (var i = length; i > 0; --i) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
```

### Response Type Detection

```javascript
// Detect if response is wrapped in "data" (GraphQL) or direct (REST)
const gameType = Object.keys(json)[0] === "data"
  ? Object.keys(json.data)[0]   // GraphQL: json.data.{gameType}
  : Object.keys(json)[0];        // REST: json.{gameType}

const bet = Object.keys(json)[0] === "data"
  ? json.data[gameType]
  : json[gameType];
```

---

## Summary

### API Endpoints Quick Reference

**GraphQL Endpoint**: `POST https://{mirror}/_api/graphql`
- RotateSeedPair (mutation)
- CreateVaultDeposit (mutation)
- UserBalances (query)

**REST Casino Endpoints**: `POST https://{mirror}/_api/casino/{game}/{action}`

| Game | Endpoints |
|------|-----------|
| Dice | `/dice/roll` |
| Limbo | `/limbo/bet` |
| Keno | `/keno/bet` |
| Mines | `/mines/bet`, `/mines/next`, `/mines/cashout` |
| HiLo | `/hilo/bet`, `/hilo/next`, `/hilo/cashout` |
| Baccarat | `/baccarat/bet` |
| Blackjack | `/blackjack/bet`, `/blackjack/next` |

**Active Bet Endpoints**: `POST https://{mirror}/_api/casino/active-bet/{game}`
- `/active-bet/hilo`
- `/active-bet/mines`
- `/active-bet/blackjack`

### Authentication Required
All endpoints require `x-access-token` header with session cookie value.

### Rate Limiting
HTTP 403 responses indicate rate limiting. Implement 2-second delays between retries.

---

*Documentation generated from bot2love extension analysis - Comprehensive extraction of all GraphQL and REST API operations.*
