# Implementation Plan

- [x] 1. Initialize Wails project structure and dependencies
  - Create new Wails v2 project with React TypeScript template
  - Configure project structure to match design specifications
  - Set up Go module with required dependencies (Wails, SQLite, existing packages)
  - _Requirements: 1.1, 9.1, 9.3_

- [x] 2. Migrate existing Go packages to Wails backend structure
  - Copy and adapt internal/engine package for HMAC-SHA256 and RNG functionality
  - Copy and adapt internal/games package with all game implementations
  - Copy and adapt internal/scan package for high-performance scanning
  - Update import paths and ensure packages build correctly in new structure
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 3. Implement enhanced database layer for desktop storage
  - Create SQLite schema with runs and hits tables including proper indexes
  - Implement database initialization and migration logic for app startup
  - Write CRUD operations for runs (create, read, list with pagination and filtering)
  - Write CRUD operations for hits (batch insert, paginated read with delta nonce support)
  - Add database connection management and transaction handling
  - _Requirements: 1.3, 5.1, 5.2, 5.5, 9.2_

- [x] 4. Create Wails application bindings and core app structure
  - Implement main App struct with context and store dependencies
  - Create GetGames binding to return available games with metadata
  - Create HashServerSeed binding for server seed hash preview functionality
  - Implement basic app lifecycle management and configuration
  - _Requirements: 1.1, 10.1, 10.2, 10.3_

- [x] 5. Implement scan execution engine with Wails integration

  - Create StartScan binding that validates input and executes scans using existing scan package
  - Implement worker pool management with GOMAXPROCS sizing for optimal CPU utilization
  - Add timeout and cancellation support with context management
  - Implement batch database writes for hits during scan execution
  - Add scan result summary calculation and persistence
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

- [x] 6. Implement missing database operations for runs and hits management






  - Add ListRuns method to store interface with pagination and game filtering
  - Add GetRunHits method with server-side pagination and delta nonce calculation
  - Update database schema to include server seed hash storage (never raw seed)
  - Add proper indexing for performance on large datasets
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4_

- [x] 7. Complete Wails bindings for scan results and history management







  - Create GetRun binding to retrieve individual run metadata and summary
  - Create GetRunHits binding with server-side pagination and delta nonce calculation
  - Create ListRuns binding with pagination and game-based filtering
  - Implement CancelRun binding for stopping in-progress scans
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.3, 5.4, 6.1, 6.2, 6.3_

- [x] 8. Set up React frontend foundation with routing and UI framework






  - Install and configure React Router for navigation between scan form, runs list, and run details
  - Set up Mantine v7 UI framework with theme and component providers
  - Create main layout component with navigation and error boundaries
  - Configure TypeScript types for Wails bindings and data structures
  - _Requirements: 2.1, 8.1, 8.3_

- [x] 9. Enhance scan form component with comprehensive validation and features










  - Enhance existing ScanForm component with Zod validation schemas for all form inputs
  - Add game selection with dynamic parameter validation based on selected game
  - Implement server seed hash preview functionality using HashServerSeed binding
  - Add proper error handling and user feedback for validation failures
  - Ensure form submission integrates with enhanced StartScan binding
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 10.1, 10.2, 10.4_

- [x] 10. Implement runs list page with filtering and navigation




  - Create RunsList component that calls ListRuns binding with pagination
  - Build RunsTable component using mantine-react-table with sorting and filtering
  - Add game-based filtering functionality
  - Implement row click navigation to individual run details
  - _Requirements: 5.1, 5.2, 5.3, 5.4_




- [ ] 11. Create run details page with comprehensive results display

  - Build RunDetails component that fetches run metadata using GetRun binding
  - Create RunSummary component displaying scan parameters, execution metadata, and statistics
  - Implement HitsTable component using mantine-react-table with server-side pagination
  - Add delta nonce calculation and display in hits table
  - Implement sorting functionality for nonce and metric columns
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 12. Add comprehensive error handling and user feedback throughout the application
  - Implement structured error handling for all binding calls with user-friendly messages
  - Add loading states and progress indicators for long-running operations
  - Create error boundary components to handle unexpected React errors
  - Add toast notifications for success and error feedback
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 13. Implement scan cancellation and progress tracking
  - Add cancel functionality to scan form and results pages using CancelRun binding
  - Implement progress event handling for real-time scan updates (optional for v1)
  - Add UI indicators for scan status (running, completed, canceled, timed out)
  - Ensure partial results are accessible when scans are canceled or timeout
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 14. Add comprehensive input validation and security measures
  - Implement nonce range validation with 1,500,000 maximum limit
  - Add JSON parameter validation for game-specific parameters
  - Ensure server seed hash-only display throughout the application
  - Add input sanitization and validation at all binding entry points
  - _Requirements: 1.2, 1.4, 2.2, 2.5, 2.6, 8.1_

- [ ] 15. Create comprehensive test suite for critical functionality
  - Write unit tests for all game implementations using golden vectors
  - Create integration tests for scan execution with known seed combinations
  - Add database operation tests using in-memory SQLite
  - Write React component tests for form validation and table functionality
  - _Requirements: 7.4, 7.5_

- [ ] 16. Implement build configuration and packaging
  - Configure Wails build settings for single-binary executable generation
  - Set up proper application data directory handling for database storage
  - Add version information and engine version tracking
  - Test build process and executable functionality on target platforms
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 17. Performance optimization and final integration testing
  - Optimize worker pool sizing and memory allocation for large scans
  - Test scan performance with 1M+ nonce ranges to ensure minute-scale completion
  - Verify UI responsiveness during background scan execution
  - Conduct end-to-end testing of complete scan workflows
  - _Requirements: 3.2, 3.3, 3.4_