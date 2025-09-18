# Stake PF Replay API Documentation

## Overview

The Stake PF Replay API provides endpoints for scanning and verifying provably fair game outcomes using HMAC-SHA256 cryptographic functions.

## Base URL

```
http://localhost:8080
```

## Endpoints

### Health Check

**GET** `/health`

Returns server health status.

**Response:**
```
OK
```

### List Games

**GET** `/games`

Returns metadata about all supported games.

**Response:**
```json
{
  "games": [
    {
      "id": "limbo",
      "name": "Limbo",
      "metric_label": "multiplier"
    },
    {
      "id": "dice",
      "name": "Dice",
      "metric_label": "roll"
    },
    {
      "id": "roulette",
      "name": "Roulette",
      "metric_label": "pocket"
    }
  ],
  "engine_version": "dev"
}
```

### Scan for Outcomes

**POST** `/scan`

Scans a range of nonces for specific game outcomes.

**Request:**
```json
{
  "game": "limbo",
  "seeds": {
    "server": "server_seed_here",
    "client": "client_seed_here"
  },
  "nonce_start": 1,
  "nonce_end": 1000,
  "target_op": "ge",
  "target_val": 10.0,
  "tolerance": 1e-9,
  "limit": 100,
  "timeout_ms": 30000
}
```

**Parameters:**
- `game`: Game type ("limbo", "dice", "roulette")
- `seeds`: Server and client seeds
- `nonce_start`/`nonce_end`: Nonce range to scan
- `target_op`: Comparison operation ("eq", "gt", "ge", "lt", "le", "between", "outside")
- `target_val`: Target value to compare against
- `target_val2`: Second value for "between" and "outside" operations
- `tolerance`: Comparison tolerance (default: 1e-9 for floats, 0 for integers)
- `limit`: Maximum hits to return (optional)
- `timeout_ms`: Request timeout in milliseconds (optional)

**Response:**
```json
{
  "hits": [
    {
      "nonce": 42,
      "metric": 12.34
    }
  ],
  "summary": {
    "total_evaluated": 1000,
    "hits_found": 1,
    "min_metric": 12.34,
    "max_metric": 12.34,
    "mean_metric": 12.34,
    "timed_out": false
  },
  "engine_version": "dev",
  "echo": { /* original request */ }
}
```

### Verify Single Nonce

**POST** `/verify`

Verifies the outcome for a specific nonce.

**Request:**
```json
{
  "game": "limbo",
  "seeds": {
    "server": "server_seed_here",
    "client": "client_seed_here"
  },
  "nonce": 42,
  "params": {}
}
```

**Response:**
```json
{
  "nonce": 42,
  "game_result": {
    "metric": 12.34,
    "metric_label": "multiplier",
    "details": {
      "raw_float": 0.123456,
      "house_edge": 0.99,
      "crash_point": 12.34
    }
  },
  "engine_version": "dev",
  "echo": { /* original request */ }
}
```

### Hash Server Seed

**POST** `/seed/hash`

Returns SHA256 hash of a server seed for verification.

**Request:**
```json
{
  "server_seed": "server_seed_here"
}
```

**Response:**
```json
{
  "hash": "a1b2c3d4e5f6...",
  "engine_version": "dev",
  "echo": {
    "server_seed": "server_seed_here"
  }
}
```

## Error Responses

All endpoints return structured error responses:

```json
{
  "type": "validation_error",
  "message": "Game is required",
  "context": {
    "field_errors": "game field cannot be empty"
  }
}
```

**Error Types:**
- `validation_error`: Invalid request parameters
- `game_not_found`: Specified game doesn't exist
- `timeout`: Request timed out
- `internal_error`: Server error

## Game-Specific Parameters

### Limbo
- **Metric**: Crash multiplier (minimum 1.0)
- **Parameters**: 
  - `houseEdge` (optional): House edge percentage (default: 0.99)

### Dice
- **Metric**: Roll value (0.00 to ~100.00)
- **Parameters**: None

### Roulette
- **Metric**: Pocket number (0-36 for European roulette)
- **Parameters**: None

## Rate Limits

- Maximum nonce range: 10,000,000 per request
- Maximum timeout: 300,000ms (5 minutes)
- Maximum hit limit: 100,000 results

## Security

- Server seeds are never logged in plain text
- Only SHA256 hashes of seeds are included in logs
- All requests include engine version for auditability