# Requirements Document

## Introduction

This specification defines the transformation of the existing Stake PF Replay web service into a single-binary desktop application using Wails v2. The desktop app will maintain the high-performance Go compute engine while providing a modern React-based user interface. The primary goal is to create a completely local, privacy-focused tool that never transmits sensitive seed data over the network while delivering fast scanning capabilities for provable fairness verification.

## Requirements

### Requirement 1

**User Story:** As a user, I want to run outcome scans locally on my desktop without any network dependencies, so that my server seeds remain completely private and secure.

#### Acceptance Criteria

1. WHEN the application starts THEN the system SHALL initialize as a single-binary desktop application with no external network dependencies
2. WHEN processing server seeds THEN the system SHALL never transmit raw server seed data over any network connection
3. WHEN storing scan data THEN the system SHALL use local SQLite database storage only
4. WHEN displaying server seed information THEN the system SHALL only show the SHA256 hash, never the raw seed value

### Requirement 2

**User Story:** As a user, I want to configure and execute outcome scans through an intuitive desktop interface, so that I can easily analyze game outcomes across large nonce ranges.

#### Acceptance Criteria

1. WHEN accessing the scan form THEN the system SHALL provide input fields for server seed, client seed, nonce start, nonce end, game selection, and target criteria
2. WHEN validating scan inputs THEN the system SHALL enforce nonce range limits of maximum 1,500,000 nonces per scan
3. WHEN selecting a game THEN the system SHALL support limbo, dice, roulette, and pump games with appropriate parameter validation
4. WHEN configuring target criteria THEN the system SHALL support comparison operators (ge, gt, eq, le, lt) with configurable tolerance values
5. WHEN submitting a scan THEN the system SHALL validate all inputs using Zod schemas before execution
6. WHEN scan validation fails THEN the system SHALL display clear error messages with specific field-level feedback

### Requirement 3

**User Story:** As a user, I want to execute high-performance scans that utilize my CPU cores efficiently, so that I can process hundreds of thousands to millions of nonces quickly.

#### Acceptance Criteria

1. WHEN executing a scan THEN the system SHALL use bounded worker pools sized to GOMAXPROCS for optimal CPU utilization
2. WHEN processing nonces THEN the system SHALL maintain allocation-free hot paths to minimize memory overhead
3. WHEN scanning large ranges THEN the system SHALL complete 1 million nonce scans within minutes on typical desktop hardware
4. WHEN a scan is running THEN the system SHALL keep the UI responsive by executing scans in separate goroutines
5. WHEN scan timeout is reached THEN the system SHALL gracefully stop processing and mark results as timed out
6. WHEN hit limit is reached THEN the system SHALL stop scanning and preserve all found hits

### Requirement 4

**User Story:** As a user, I want to view detailed scan results with comprehensive hit analysis, so that I can understand the distribution and patterns of matching outcomes.

#### Acceptance Criteria

1. WHEN a scan completes THEN the system SHALL display a summary showing total evaluated nonces, hit count, min/max/sum metrics, and execution metadata
2. WHEN viewing scan results THEN the system SHALL show a paginated table of hits with nonce, metric value, and delta nonce columns
3. WHEN navigating hit pages THEN the system SHALL support server-side pagination with configurable page sizes up to 1000 hits
4. WHEN calculating delta nonce THEN the system SHALL show the distance between consecutive hits, handling page boundaries correctly
5. WHEN sorting hits THEN the system SHALL support sorting by nonce (default ascending) and metric value
6. WHEN displaying game metrics THEN the system SHALL use appropriate labels (multiplier for Limbo, roll for Dice, pocket for Roulette, etc.)

### Requirement 5

**User Story:** As a user, I want to manage and review my scan history, so that I can track previous analyses and compare results over time.

#### Acceptance Criteria

1. WHEN accessing the runs list THEN the system SHALL display all historical scans with pagination and filtering capabilities
2. WHEN viewing run history THEN the system SHALL show run ID, creation date, game type, nonce range, match count, and timeout status
3. WHEN filtering runs THEN the system SHALL support filtering by game type
4. WHEN clicking on a run THEN the system SHALL navigate to the detailed results view for that specific scan
5. WHEN the application restarts THEN the system SHALL preserve all historical run data from the local database

### Requirement 6

**User Story:** As a user, I want to cancel long-running scans when needed, so that I can stop processing and still access partial results.

#### Acceptance Criteria

1. WHEN a scan is running THEN the system SHALL provide a cancel option in the user interface
2. WHEN canceling a scan THEN the system SHALL stop processing within a reasonable time frame (under 5 seconds)
3. WHEN a scan is canceled THEN the system SHALL preserve all hits found up to the cancellation point
4. WHEN viewing canceled results THEN the system SHALL clearly indicate the scan was incomplete and show partial statistics

### Requirement 7

**User Story:** As a developer, I want the system to maintain cryptographic correctness and deterministic behavior, so that results are reproducible and verifiable.

#### Acceptance Criteria

1. WHEN generating random floats THEN the system SHALL use HMAC-SHA256 with the exact format: clientSeed:nonce:currentRound
2. WHEN processing server seeds THEN the system SHALL treat them as ASCII strings without hex decoding
3. WHEN converting bytes to floats THEN the system SHALL use exactly 4 bytes per float for deterministic precision
4. WHEN executing the same scan parameters THEN the system SHALL produce identical results across different runs and machines
5. WHEN implementing game logic THEN the system SHALL follow the exact algorithms specified in the existing engine packages

### Requirement 8

**User Story:** As a user, I want the application to handle errors gracefully and provide helpful feedback, so that I can understand and resolve issues quickly.

#### Acceptance Criteria

1. WHEN invalid parameters are entered THEN the system SHALL display specific validation errors for each field
2. WHEN database operations fail THEN the system SHALL show user-friendly error messages without exposing technical details
3. WHEN the application encounters unexpected errors THEN the system SHALL log errors appropriately while maintaining application stability
4. WHEN scan operations fail THEN the system SHALL provide clear feedback about the failure reason and suggested remediation

### Requirement 9

**User Story:** As a user, I want the application to be packaged as a single executable, so that I can easily distribute and run it without complex installation procedures.

#### Acceptance Criteria

1. WHEN building the application THEN the system SHALL produce a single executable file containing all dependencies
2. WHEN running the executable THEN the system SHALL initialize the embedded SQLite database automatically
3. WHEN deploying to different machines THEN the system SHALL run without requiring additional runtime dependencies
4. WHEN storing application data THEN the system SHALL use appropriate OS-specific application data directories

### Requirement 10

**User Story:** As a user, I want to preview server seed hashes before running scans, so that I can verify I'm using the correct seed without exposing the raw value.

#### Acceptance Criteria

1. WHEN entering a server seed THEN the system SHALL provide an option to preview the SHA256 hash
2. WHEN displaying the hash preview THEN the system SHALL show the hash immediately without requiring form submission
3. WHEN the hash is displayed THEN the system SHALL never show the raw server seed value in any UI element
4. WHEN copying hash values THEN the system SHALL provide easy copy functionality for verification purposes