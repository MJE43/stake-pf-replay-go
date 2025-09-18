# Requirements Document

## Introduction

This feature implements the core Random Number Generation (RNG) engine for the Stake PF Replay system, establishing the cryptographic foundation that converts server seeds, client seeds, and nonces into deterministic float sequences. The implementation must be bit-for-bit reproducible across machines and include comprehensive golden test coverage to ensure exact compatibility with Stake's provable fairness specification.

The core engine will support the essential games (Limbo, Dice, Roulette) that provide immediate value for seed replaying while establishing the architectural patterns for future game additions.

## Requirements

### Requirement 1

**User Story:** As a developer, I want a deterministic RNG engine that converts cryptographic inputs into float sequences, so that I can reproduce exact game outcomes across different machines and environments.

#### Acceptance Criteria

1. WHEN the engine receives serverSeed (ASCII), clientSeed, nonce, cursor, and count THEN it SHALL generate exactly the specified number of floats using HMAC-SHA256
2. WHEN the same inputs are provided multiple times THEN the engine SHALL return identical float sequences every time
3. WHEN cursor=0 and count=8 THEN the engine SHALL use a single HMAC round without cursor advancement
4. WHEN cursor=31 and count=2 THEN the engine SHALL properly handle crossing into the next HMAC block
5. WHEN count=40 THEN the engine SHALL generate multiple HMAC rounds and concatenate results correctly
6. WHEN converting 4 bytes to float THEN the engine SHALL use the exact formula: b0/256 + b1/256² + b2/256³ + b3/256⁴

### Requirement 2

**User Story:** As a quality assurance engineer, I want comprehensive golden test vectors that validate RNG output, so that I can detect any regressions or compatibility issues with Stake's specification.

#### Acceptance Criteria

1. WHEN running golden tests THEN the engine SHALL produce exact float sequences matching pre-computed reference values
2. WHEN testing edge cases (cursor boundaries, multiple rounds) THEN all outputs SHALL match golden vectors exactly
3. WHEN comparing against Node.js reference implementation THEN float values SHALL be identical to at least 15 decimal places
4. WHEN golden tests fail THEN the system SHALL provide clear error messages showing expected vs actual values
5. WHEN adding new test cases THEN the golden vector format SHALL be easily extensible

### Requirement 3

**User Story:** As a user, I want to replay Limbo game outcomes with exact multiplier calculations, so that I can verify what my crash multipliers would have been for any nonce range.

#### Acceptance Criteria

1. WHEN evaluating a Limbo nonce THEN the system SHALL calculate crashPoint using the exact Stake formula with house edge
2. WHEN crashPoint is below 1.0 THEN the system SHALL return exactly 1.0 as the minimum multiplier
3. WHEN scanning for multipliers >= X THEN the system SHALL use appropriate tolerance for float comparisons
4. WHEN returning Limbo results THEN the metric SHALL be the crash multiplier and details SHALL include raw float and house edge
5. WHEN processing large nonce ranges THEN Limbo evaluation SHALL be allocation-free in the hot path

### Requirement 4

**User Story:** As a user, I want to replay Dice game outcomes with exact roll calculations, so that I can find specific roll ranges across nonce sequences.

#### Acceptance Criteria

1. WHEN evaluating a Dice nonce THEN the system SHALL calculate roll using: (float * 10001) / 100
2. WHEN the calculated roll exceeds 100.00 THEN the system SHALL handle the edge case appropriately
3. WHEN scanning for rolls <= 1.00 THEN the system SHALL find rare low rolls accurately
4. WHEN returning Dice results THEN the metric SHALL be the roll value with appropriate precision
5. WHEN comparing roll values THEN the system SHALL use integer-like precision for exact matches

### Requirement 5

**User Story:** As a user, I want to replay European Roulette outcomes with exact pocket calculations, so that I can track specific numbers across nonce ranges.

#### Acceptance Criteria

1. WHEN evaluating a Roulette nonce THEN the system SHALL calculate pocket using: floor(float * 37)
2. WHEN the result is pocket 0-36 THEN the system SHALL return the exact integer pocket number
3. WHEN scanning for pocket == 17 THEN the system SHALL use zero tolerance for exact integer matching
4. WHEN returning Roulette results THEN the metric SHALL be the pocket number as a float64 but integer-valued
5. WHEN processing Roulette outcomes THEN the system SHALL handle all 37 pockets (0-36) correctly

### Requirement 6

**User Story:** As a developer, I want a high-performance scanning system that can process millions of nonces efficiently, so that users get results in seconds rather than minutes.

#### Acceptance Criteria

1. WHEN scanning large nonce ranges THEN the system SHALL use bounded goroutine pools with GOMAXPROCS workers
2. WHEN processing nonces in the hot path THEN the system SHALL avoid memory allocations
3. WHEN scanning for target conditions THEN workers SHALL only collect matching nonces and metrics
4. WHEN aggregating results THEN the system SHALL provide count, min, max, and median statistics
5. WHEN users specify limits THEN the system SHALL cap results without affecting summary statistics

### Requirement 7

**User Story:** As a system administrator, I want the engine to provide clear versioning and input echoing, so that results are auditable and reproducible.

#### Acceptance Criteria

1. WHEN returning any results THEN the system SHALL echo all input parameters exactly as received
2. WHEN processing requests THEN the system SHALL include the engine version in all responses
3. WHEN game configurations change THEN the system SHALL track payout table versions where applicable
4. WHEN errors occur THEN the system SHALL provide detailed context about which inputs caused the failure
5. WHEN logging operations THEN the system SHALL include sufficient detail for debugging without exposing sensitive seeds

### Requirement 8

**User Story:** As a developer, I want a clean game interface that makes adding new games straightforward, so that the system can be extended efficiently.

#### Acceptance Criteria

1. WHEN implementing a new game THEN it SHALL implement the standard Game interface with Evaluate, FloatsNeeded, and MetricName methods
2. WHEN a game needs multiple floats THEN it SHALL declare the exact count required via FloatsNeeded()
3. WHEN evaluating game outcomes THEN the Evaluate method SHALL return a single numeric metric and optional details
4. WHEN games require payout tables THEN they SHALL load from versioned JSON files
5. WHEN registering games THEN the system SHALL provide a clean registry mechanism for game discovery