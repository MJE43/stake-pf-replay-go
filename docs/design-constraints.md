# Design Constraints — Canonical Source of Truth

**Version:** 1.0.0  
**Effective Date:** 2025-10-01  
**Status:** 🔒 Authoritative  
**Enforced By:** `scripts/verify-design-constraints.mjs`

---

## Purpose & Scope

This document is the **single source of truth** for all design and implementation decisions in Stake PF Replay. It synthesizes backend technical constraints into enforceable rules that prevent UI patterns incompatible with system capabilities.

**Binding Authority:** All product, design, and engineering decisions MUST comply with these constraints unless explicitly waived via the documented exception process.

**Audience:**
- Product managers planning features
- Designers creating mockups
- Frontend engineers implementing UI
- Code reviewers evaluating PRs
- AI agents assisting development

---

## How to Consume This Document

### For Product/Design
1. **Before designing a feature:** Review relevant sections to understand technical boundaries
2. **When planning UX:** Match interaction patterns to backend capabilities (see [Pagination](#pagination-rules), [Latency](#latency-budgets))
3. **For edge cases:** Check if a waiver is needed; document justification

### For Engineers
1. **Before implementation:** Validate your approach against constraints
2. **During code review:** Reference specific constraint sections in feedback
3. **For violations:** Either fix the code OR request a waiver (see [Exception Process](#exception-process))
4. **CI validation:** Run `node scripts/verify-design-constraints.mjs` locally before pushing

### For AI Agents
1. **Before generating code:** Parse this document to validate proposed patterns
2. **When suggesting architecture:** Cite specific constraint sections
3. **For trade-offs:** Propose waivers with justification if constraints block requirements

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Latency Budgets](#latency-budgets)
3. [Pagination Rules](#pagination-rules)
4. [Consistency Model](#consistency-model)
5. [Permission Model](#permission-model)
6. [Optimistic UI Eligibility](#optimistic-ui-eligibility)
7. [Loading & Skeleton Policy](#loading--skeleton-policy)
8. [Error Taxonomy](#error-taxonomy)
9. [Realtime Semantics](#realtime-semantics)
10. [Rate Limiting](#rate-limiting)
11. [Idempotency](#idempotency)
12. [Hard Limits](#hard-limits)
13. [Exception Process](#exception-process)

---

## Architecture Overview

**Deployment Model:** Single-user desktop application (Wails framework)

**Transport Layers:**
1. **Wails IPC Bindings:** Primary interface for scan operations, persisted data access
2. **Live HTTP API:** Localhost-only HTTP server (port 17888) for Antebot ingest and queries
3. **Backend HTTP API:** Standalone service mode (port 8080) for headless operation

**Data Storage:**
- **Scan Results:** SQLite database (embedded, single-user)
- **Live Ingest:** Separate SQLite database (embedded, single-user)
- **Consistency:** Immediate (no distributed concerns)

**Concurrency:** Single-user; no conflict resolution, version fields, or optimistic locking

**Implications:**
- No authentication/authorization (local-only)
- No multi-user coordination
- No distributed transactions
- Immediate consistency model
- Last-write-wins for updates

---

## Latency Budgets

All latency values are **p95 measurements or conservative estimates** (source noted).

### Operation Classes

| Class | P95 Latency | UI Pattern | Operations |
|-------|-------------|------------|------------|
| **Instant** | < 10ms | No indicator | GetGames, HashServerSeed |
| **Fast** | 10-100ms | Skeleton screen | ListRuns, GetRun, ListStreams, GetStream |
| **Moderate** | 100ms-1s | Spinner | Small scans (<1K nonces), verify single nonce |
| **Slow** | 1-10s | Progress bar + spinner | Medium scans (1K-10K nonces) |
| **Very Slow** | 10s-5min | Progress bar + time estimate + cancel | Large scans (10K-10M nonces) |

### Specific Operation SLAs

#### Wails Bindings
- `GetGames()`: 3ms (p95) — source: estimate
- `HashServerSeed()`: 2ms (p95) — source: estimate
- `GetRun(id)`: 15ms (p95) — source: estimate
- `ListRuns(query)`: 40ms (p95) — source: estimate
- `GetRunHits(id, page, perPage)`: 30ms (p95) — source: estimate
- `GetSeedRuns(id)`: 50ms (p95) — source: estimate
- `StartScan(req)`: **5-30s** (p95), **highly variable** — source: benchmark_tests
  - 100 nonces: ~100ms
  - 1K nonces: ~500ms
  - 10K nonces: ~2s
  - 100K nonces: ~15s
  - 1M nonces: ~60s
  - Affected by: game complexity (Pump slowest), selectivity, CPU cores
- `CancelRun(id)`: 10ms (p95) — source: estimate

#### Live HTTP API
- `POST /live/ingest`: 20ms (p95) — source: estimate
- `GET /live/streams`: 30ms (p95) — source: estimate
- `GET /live/streams/{id}`: 15ms (p95) — source: estimate
- `GET /live/streams/{id}/bets`: 100ms (p95) — source: estimate
- `GET /live/streams/{id}/tail`: 40ms (p95) — source: estimate
- `GET /live/streams/{id}/export.csv`: **2s** (p95), variable by row count — source: estimate
- `DELETE /live/streams/{id}`: 100ms (p95) — source: estimate

#### Backend HTTP API
- `GET /health`: 3ms (p95) — source: estimate
- `GET /games`: 3ms (p95) — source: estimate
- `POST /verify`: 8ms (p95) — source: benchmark_tests
- `POST /scan`: **5-30s** (p95) — source: benchmark_tests (same as StartScan)
- `POST /seed/hash`: 3ms (p95) — source: estimate

### UI Implementation Rules

1. **< 10ms:** No loading state
2. **10-100ms:** Skeleton placeholders (e.g., `<Skeleton className="h-20" />`)
3. **100ms-1s:** Spinner with label (e.g., "Loading...")
4. **1-10s:** Progress bar OR indeterminate spinner + cancel button
5. **> 10s:** Progress bar + elapsed time + estimated remaining + cancel button

**Enforcement:** Linter rule (TBD) to warn on missing loading states for async operations > 100ms.

---

## Pagination Rules

All list endpoints have **hard server-side limits**. Client-side pagination or infinite scroll without server support is PROHIBITED.

### Pagination Matrix

| Resource | Type | Default | Max | Notes |
|----------|------|---------|-----|-------|
| **Runs** | Offset (page-based) | 20 | 100 | Page numbers start at 1 |
| **Hits** | Offset (page-based) | 50 | 1000 | Up to 100K total hits possible |
| **Streams** | Offset | 100 | 500 | Ordered by last_seen_at DESC |
| **Bets** | Offset | 500 | 10000 | Supports min_multiplier filter + order |
| **Tail (bets)** | Cursor (ID-based) | 1000 | 5000 | Incremental fetch for new rows |

### Required UI Patterns

#### **Offset Pagination (Runs, Hits, Streams, Bets)**

**MUST HAVE:**
- Explicit page controls (Previous/Next buttons OR page number buttons)
- Current page indicator
- Total count display (when available)
- "Items per page" selector (respecting max)

**MAY HAVE:**
- "Load More" button (for hits only, as supplement to page controls)

**MUST NOT:**
- Infinite scroll without pagination controls
- Client-side filtering/sorting beyond current page
- Auto-fetch next page on scroll (use explicit button)

**Example (Compliant):**
```tsx
<Pagination>
  <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} />
  <PaginationPage>{page} of {totalPages}</PaginationPage>
  <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
</Pagination>
```

#### **Cursor Pagination (Tail Endpoint)**

**MUST HAVE:**
- Track last known ID
- Incremental fetch via `?since_id={lastId}`
- Buffer new rows (don't auto-prepend)
- Notification UI: "X new items available"
- Explicit flush action (button click)

**MUST NOT:**
- Auto-prepend new rows (causes scroll jump)
- WebSocket connections (use Wails events + polling)

**Example (Compliant):**
```tsx
{pendingCount > 0 && (
  <Button onClick={flushBuffer} className="mb-4 w-full">
    {pendingCount} new bets available — Click to load
  </Button>
)}
```

### Enforcement

Validator checks for:
- Presence of pagination UI on list components
- Absence of infinite scroll libraries without pagination controls
- Proper usage of offset/cursor parameters

---

## Consistency Model

**Model:** Immediate consistency (single-user, single-process, embedded SQLite)

**Characteristics:**
- Reads reflect all prior writes in the same session
- No stale reads (no caching layer between app and DB)
- No distributed concerns (replication, consensus, etc.)
- Multi-tab coordination via polling only (no shared state)

**Implications:**

1. **No Optimistic Locking:** Server updates always succeed (last-write-wins)
2. **No Version Fields:** Updates don't check previous state
3. **No Conflict Resolution:** Multi-tab scenarios use polling to sync
4. **Mutations Are Authoritative:** Once server confirms, state is durable

**UI Requirements:**
- Wait for server confirmation before updating UI
- Use polling for cross-tab sync (not shared state)
- Show stale data indicator if polling fails

**Anti-Patterns:**
- ❌ Optimistic mutations for persisted data
- ❌ Client-side merge conflict resolution
- ❌ Version-based updates

---

## Permission Model

**Model:** None (local-only desktop application)

**Authentication:** Not implemented (except optional live ingest token)

**Authorization:** All operations available to all users

**Implications:**

1. **No Permission Checks:** UI doesn't hide/disable based on roles
2. **No User Context:** No "current user" concept
3. **No Audit Trails:** Logs record operations, not actors
4. **Optional Ingest Token:** Only applies to `POST /live/ingest` if `LIVE_INGEST_TOKEN` env var set

**UI Requirements:**
- Show all operations to all users
- No RBAC components (no permission checks)
- Optional: Display ingest token status in settings

**Anti-Patterns:**
- ❌ Role-based UI visibility
- ❌ Permission checks before operations
- ❌ "Forbidden" error states (all operations allowed)

---

## Optimistic UI Eligibility

**Rule:** Optimistic updates ONLY for local UI state. All server mutations MUST wait for confirmation.

### ✅ ALLOWED (Local State Only)

- Theme toggle
- Modal open/close
- Form field values (pre-submission)
- Accordion expand/collapse
- Tab selection
- Column visibility toggles
- View mode (table/grid)
- Search input (debounced)

**Example:**
```tsx
// Local state — optimistic OK
const [theme, setTheme] = useState('dark');
const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
```

### ❌ PROHIBITED (Server Mutations)

- StartScan
- CancelRun
- DeleteStream / DeleteRun
- UpdateNotes
- Live bet ingest
- Any database write

**Rationale:**
1. **Scan operations:** Long-running (5-30s), may timeout or be cancelled
2. **Delete operations:** Destructive, must confirm server success
3. **Update operations:** Consistency model requires server confirmation
4. **Ingest operations:** Idempotency/duplicate detection on server

**Example (CORRECT):**
```tsx
const mutation = useMutation(DeleteStream, {
  onMutate: (id) => {
    // Show loading, do NOT remove from list yet
    setDeleting(id);
  },
  onSuccess: (_, id) => {
    // Only now update UI
    queryClient.setQueryData(['streams'], prev => 
      prev.filter(s => s.id !== id)
    );
  }
});
```

**Example (WRONG):**
```tsx
// ❌ VIOLATION: Optimistic delete
const mutation = useMutation(DeleteStream, {
  onMutate: (id) => {
    queryClient.setQueryData(['streams'], prev => 
      prev.filter(s => s.id !== id) // Too early!
    );
  }
});
```

### Enforcement

Validator checks for:
- Mutations that update cache in `onMutate` (prohibited)
- Lack of `onSuccess` handler for server mutations (warning)

---

## Loading & Skeleton Policy

**Principle:** Every async operation > 100ms MUST have a loading state.

### Loading State Matrix

| Latency | UI Component | Aria Attributes | Cancellable |
|---------|--------------|-----------------|-------------|
| < 10ms | None | N/A | No |
| 10-100ms | Skeleton screen | `aria-busy="true"` | No |
| 100ms-1s | Spinner | `aria-busy="true"` | Optional |
| 1-10s | Progress bar OR spinner | `aria-busy="true"` + `aria-valuenow` | Yes |
| > 10s | Progress bar + time display | `aria-busy="true"` + `aria-valuenow` | Yes |

### Skeleton Screen Guidelines

**When to Use:**
- Initial page load
- Navigation transitions
- Fast async operations (10-100ms)

**What to Show:**
- Placeholder boxes matching final layout
- Subtle shimmer animation (optional)
- Correct number of items (if known)

**Example:**
```tsx
{isLoading ? (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <Skeleton key={i} className="h-24 w-full" />
    ))}
  </div>
) : (
  <RunsList runs={data} />
)}
```

### Progress Indicators

**Determinate Progress (Preferred):**
- Show percentage complete
- Estimate remaining time (if possible)
- Update every 500ms minimum

**Indeterminate Progress (Fallback):**
- Use when progress unknown
- Show elapsed time
- Provide cancel button

**Example:**
```tsx
<div className="space-y-2">
  <Progress value={progress} aria-valuenow={progress} aria-valuemax={100} />
  <div className="flex justify-between text-sm">
    <span>{progress}% complete</span>
    <span>{formatDuration(elapsed)} elapsed</span>
  </div>
  <Button onClick={onCancel}>Cancel</Button>
</div>
```

### Anti-Patterns

❌ **No loading state for > 100ms operations**  
❌ **Spinner for > 10s operations** (use progress bar)  
❌ **Fake progress animations** (must reflect real progress)  
❌ **Progress bar without cancel for > 10s** (user needs escape hatch)

### Enforcement

Validator checks for:
- Async components without loading state
- Long operations (StartScan) without progress UI
- Missing cancel handlers for slow operations

---

## Error Taxonomy

All backend errors follow a structured taxonomy. UI MUST handle each error type with specific patterns.

### Error Types

| Type | HTTP Status | Category | Retryable | User Action |
|------|-------------|----------|-----------|-------------|
| `validation_error` | 400 | validation | No | Fix input |
| `game_not_found` | 400 | game | No | Select valid game |
| `timeout` | 408 | timeout | Yes | Reduce range or retry |
| `internal_error` | 500 | system | Yes | Retry with backoff |
| `not_found` | 404 | validation | No | Check ID |

### Required UI Patterns

#### **Validation Errors**

**Display:**
- Alert with "destructive" variant
- Error message from server
- Highlight invalid field (if provided in context)
- Show example or hint

**Actions:**
- Focus invalid field
- Show inline validation
- Provide "Learn More" link (if available)

**Example:**
```tsx
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Invalid Input</AlertTitle>
  <AlertDescription>
    {error.message}
    {error.context?.field_errors && (
      <div className="mt-2 text-sm">{error.context.field_errors}</div>
    )}
  </AlertDescription>
</Alert>
```

#### **Timeout Errors**

**Display:**
- Alert with "warning" variant
- Explain what timed out
- Suggest mitigations

**Actions:**
- "Reduce Range" button (if applicable)
- "Retry" button
- "Increase Timeout" option

**Example:**
```tsx
<Alert variant="warning">
  <Clock className="h-4 w-4" />
  <AlertTitle>Scan Timed Out</AlertTitle>
  <AlertDescription>
    The scan exceeded {timeoutMs}ms. Try reducing the nonce range or increasing the timeout.
    <div className="mt-3 flex gap-2">
      <Button onClick={reduceRange}>Reduce Range</Button>
      <Button variant="outline" onClick={retry}>Retry</Button>
    </div>
  </AlertDescription>
</Alert>
```

#### **Internal Errors**

**Display:**
- Alert with "destructive" variant
- Generic message (don't expose stack traces)
- "Something went wrong" copy

**Actions:**
- "Retry" button with exponential backoff
- "Report Issue" link (optional)

**Retry Logic:**
```typescript
const retry = async (attempt = 1) => {
  try {
    return await operation();
  } catch (error) {
    if (attempt < 3 && error.type === 'internal_error') {
      await sleep(1000 * Math.pow(2, attempt - 1));
      return retry(attempt + 1);
    }
    throw error;
  }
};
```

### Error Boundary Requirements

**Must wrap:**
- All route-level components
- All components with async operations
- All long-running operation UI

**Implementation:**
```tsx
<ErrorBoundary
  fallbackRender={({ error, resetErrorBoundary }) => (
    <ErrorFallback error={error} onReset={resetErrorBoundary} />
  )}
  onReset={() => queryClient.resetQueries()}
>
  <AsyncComponent />
</ErrorBoundary>
```

### Enforcement

Validator checks for:
- Missing error boundaries
- Generic error handling without type checking
- Missing retry logic for retryable errors

---

## Realtime Semantics

**Model:** Wails event bus (NOT WebSocket or Server-Sent Events)

**Pattern:** Server emits events, client listens and fetches incremental data.

### Event Types

| Event | Payload | Trigger | UI Response |
|-------|---------|---------|-------------|
| `live:newrows:{streamId}` | `{lastID: number}` | New bet ingested | Fetch tail, buffer new rows, show notification |
| `live:status:{streamId}` | `{status: "connected"\|"disconnected"}` | Connection state change | Update connection indicator |

### Implementation Pattern

**Server (Backend):**
```go
// When bet is ingested
runtime.EventsEmit(ctx, "live:newrows:"+streamID.String(), map[string]any{
  "lastID": "unknown", // client will call /tail with its known lastID
})
```

**Client (Frontend):**
```tsx
useEffect(() => {
  const unsubscribe = EventsOn(`live:newrows:${streamId}`, () => {
    fetchTail(); // Fetch new rows via /tail endpoint
  });
  return unsubscribe;
}, [streamId]);
```

### Buffer + Notification Pattern (Required)

**Flow:**
1. Event triggers tail fetch
2. New rows added to buffer (NOT prepended to UI)
3. Show notification: "X new bets available"
4. User clicks to flush buffer → rows prepended

**Rationale:** Prevents scroll jump; user stays in control.

**Example:**
```tsx
const [pendingRows, setPendingRows] = useState<Bet[]>([]);

const handleNewRows = (newRows: Bet[]) => {
  setPendingRows(prev => [...prev, ...newRows]);
};

const flushBuffer = () => {
  setRows(prev => [...pendingRows, ...prev]);
  setPendingRows([]);
};

return (
  <>
    {pendingRows.length > 0 && (
      <Button onClick={flushBuffer} className="mb-4 w-full">
        {pendingRows.length} new bets available
      </Button>
    )}
    <BetsTable rows={rows} />
  </>
);
```

### Polling Intervals (Supplement to Events)

| Resource | Interval | Condition |
|----------|----------|-----------|
| Streams list | 4s | When tab active |
| Runs list | 10s | When scan in progress |
| Run detail | 2s | When scan in progress |

**Implementation:**
```tsx
const { data } = useQuery(['streams'], fetchStreams, {
  refetchInterval: 4000,
  refetchIntervalInBackground: false, // Pause when tab inactive
  enabled: isDocumentVisible() // Use Page Visibility API
});
```

### Anti-Patterns

❌ **WebSocket connections** (not implemented)  
❌ **Server-Sent Events** (not implemented)  
❌ **Auto-prepend new data** (use buffer pattern)  
❌ **Polling without pause on tab blur** (wastes resources)

### Enforcement

Validator checks for:
- WebSocket usage (prohibited)
- SSE usage (prohibited)
- Missing event listeners for live streams
- Auto-prepend without notification

---

## Rate Limiting

**Status:** Not implemented (local-only operation)

**Current Behavior:**
- No rate limits on any endpoint
- No throttling mechanisms
- No 429 responses

**Implications:**
- UI can make unlimited requests
- No need for rate limit UI (retry-after, etc.)
- No exponential backoff for rate limits

**Future Consideration:**
- If deployed as network service, add rate limiting
- Update this section with limits and UI requirements

---

## Idempotency

### Idempotent Operations (Safe to Retry)

| Operation | Method | Idempotency Key | Behavior |
|-----------|--------|-----------------|----------|
| GetGames | GET | N/A | Always returns same data |
| GetRun | GET | N/A | Safe to call multiple times |
| HashServerSeed | POST | Input string | Deterministic output |
| POST /live/ingest | POST | `id` field | Duplicate bets silently rejected |
| UpdateNotes | PUT | N/A | Last-write-wins |
| DeleteStream | DELETE | N/A | 404 on second call (acceptable) |

### Non-Idempotent Operations (Retry Carefully)

| Operation | Method | Reason | Retry Strategy |
|-----------|--------|--------|----------------|
| StartScan | POST | Creates new Run entity | Detect duplicates client-side |
| CancelRun | POST | Context cancellation | Check if still running first |

### UI Requirements

**For Idempotent Operations:**
- Safe to retry on network failure
- No user confirmation needed for retries

**For Non-Idempotent Operations:**
- Show loading state during operation
- Prevent double-submission (disable button)
- Confirm before manual retry

**Example (Prevent Double Submit):**
```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
  if (isSubmitting) return; // Guard against double-click
  
  setIsSubmitting(true);
  try {
    await StartScan(request);
  } finally {
    setIsSubmitting(false);
  }
};

return (
  <Button onClick={handleSubmit} disabled={isSubmitting}>
    {isSubmitting ? 'Scanning...' : 'Start Scan'}
  </Button>
);
```

---

## Hard Limits

These limits are **enforced by backend validation**. UI MUST validate before submission to provide better UX.

### Scan Limits

| Parameter | Limit | Validation |
|-----------|-------|------------|
| Nonce range | 10,000,000 | `nonceEnd - nonceStart <= 10_000_000` |
| Timeout | 300,000ms (5min) | `timeoutMs <= 300_000` |
| Hit limit | 100,000 | `limit <= 100_000` |
| Tolerance | >= 0 | `tolerance >= 0` |

### Pagination Limits

| Resource | Max Per Page |
|----------|--------------|
| Runs | 100 |
| Hits | 1,000 |
| Streams | 500 |
| Bets | 10,000 |
| Tail (bets) | 5,000 |

### String Length Limits

| Field | Max Length | Notes |
|-------|------------|-------|
| Server seed | Unlimited | Reasonable limit: 1KB |
| Client seed | Unlimited | Reasonable limit: 1KB |
| Notes | Unlimited | Reasonable limit: 10KB |
| Game ID | 20 | Enum: limbo, dice, roulette, pump |

### UI Validation Rules

**Client-Side Validation (Before Submission):**
```tsx
const validateScanRequest = (req: ScanRequest): string | null => {
  if (req.nonceEnd - req.nonceStart > 10_000_000) {
    return "Nonce range cannot exceed 10,000,000";
  }
  if (req.timeoutMs && req.timeoutMs > 300_000) {
    return "Timeout cannot exceed 300,000ms (5 minutes)";
  }
  if (req.limit && req.limit > 100_000) {
    return "Hit limit cannot exceed 100,000";
  }
  return null;
};
```

**Server-Side Validation (Backend):**
- Backend enforces all limits via `ValidateScanRequest()`
- Returns 400 with specific error message
- UI should catch and display validation errors

### Enforcement

Validator checks for:
- Missing client-side validation for hard limits
- Form submissions without pre-validation
- Input fields without max constraints

---

## Exception Process

To violate a constraint in this document, follow this process:

### 1. Document the Waiver

Create or update `.design-constraints-waivers.json` in project root:

```json
{
  "version": "1.0.0",
  "waivers": [
    {
      "id": "w-001",
      "file": "src/pages/DemoMode.tsx",
      "rule": "pagination_required",
      "constraint_section": "Pagination Rules",
      "justification": "Demo mode displays max 100 items, no pagination needed",
      "approved_by": "tech-lead",
      "approved_date": "2025-10-01",
      "expires": "2025-12-31",
      "notes": "Must add pagination if demo item count exceeds 100"
    }
  ]
}
```

### 2. Get Approval

**Required Approvers:**
- For UI pattern violations: Tech Lead + Design Lead
- For performance violations: Tech Lead + Engineering Manager
- For security violations: Tech Lead + Security Champion

### 3. Add Lint Directive

In the affected file, add a comment:

```tsx
// design-constraints-waiver: w-001
// Approved by: tech-lead, design-lead (2025-10-01)
// Expires: 2025-12-31
<DemoList items={items} />
```

### 4. Validator Behavior

- Validator checks for waiver ID in `.design-constraints-waivers.json`
- Validates waiver is not expired
- Logs waiver usage in CI output
- Fails build if waiver missing or expired

### 5. Renewal Process

- 30 days before expiration, validator logs warning
- Renewal requires re-approval with updated justification
- Expired waivers cause build failure

### 6. Waiver Audit

- Monthly review of active waivers
- Remove waivers when code is refactored to comply
- Track waiver metrics in engineering dashboard

---

## Document Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-01 | Initial authoritative release |

---

## References

- **Machine-Readable Inventory:** [docs/generated/backend-inventory.json](./generated/backend-inventory.json)
- **UI Implications Guide:** [docs/generated/ui-implications.md](./generated/ui-implications.md)
- **Validator Script:** [scripts/verify-design-constraints.mjs](../scripts/verify-design-constraints.mjs)
- **Backend API Docs:** [backend/API.md](../backend/API.md)
- **Repository Guidelines:** [AGENTS.md](../AGENTS.md)

---

## Enforcement Statement

**This document is enforceable via automated validation.** All PRs are checked by `scripts/verify-design-constraints.mjs` in CI. Violations fail the build unless covered by an active waiver.

**For questions or clarifications:**
1. Check [ui-implications.md](./generated/ui-implications.md) for specific UI guidance
2. Review [backend-inventory.json](./generated/backend-inventory.json) for technical details
3. Consult with Tech Lead if constraint seems incorrect
4. Propose amendment via PR to this document (requires architecture review)

**Last Validated:** 2025-10-01 by automated systems + human review
