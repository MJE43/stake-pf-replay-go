# UI Implications — Backend Constraint Translation

**Generated:** 2025-10-01  
**Source:** [backend-inventory.json](./backend-inventory.json)  
**Authoritative Reference:** [design-constraints.md](../design-constraints.md)

This document translates backend technical constraints into prescriptive UI patterns and anti-patterns. Treat these as hard requirements unless explicitly overridden via waiver.

---

## Table of Contents

1. [List & Pagination Patterns](#list--pagination-patterns)
2. [Mutation Strategy](#mutation-strategy)
3. [Loading Patterns](#loading-patterns)
4. [Error Handling](#error-handling)
5. [Realtime Updates](#realtime-updates)
6. [Performance Budgets](#performance-budgets)
7. [Resource-Specific Guidance](#resource-specific-guidance)

---

## List & Pagination Patterns

### ✅ REQUIRED PATTERNS

#### **Runs List**
- **Pattern:** Server-side offset pagination (page-based)
- **Rationale:** Hard limit of 100 runs/page, database query with COUNT
- **Implementation:**
  ```tsx
  // Use pagination component, NOT infinite scroll
  const [page, setPage] = useState(1);
  const perPage = 20; // Default from backend
  const { data } = useQuery(['runs', page, perPage], () => 
    ListRuns({ page, perPage, game: filter })
  );
  ```
- **UI Elements:** Page buttons, "Previous/Next", page number display, total count
- **Anti-pattern:** ❌ Infinite scroll, virtual scrolling without pagination

#### **Hits List**
- **Pattern:** Server-side offset pagination with "Load More" option
- **Rationale:** Max 1000 hits/page, can have up to 100K hits per run
- **Implementation:**
  ```tsx
  // Paginated with explicit page controls
  const perPage = 50; // Default from backend
  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery(
    ['hits', runId],
    ({ pageParam = 1 }) => GetRunHits(runId, pageParam, perPage),
    {
      getNextPageParam: (lastPage, pages) => 
        lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined
    }
  );
  ```
- **UI Elements:** "Load More" button (NOT auto-load on scroll), page indicator
- **Anti-pattern:** ❌ Infinite scroll with auto-fetch

#### **Live Streams List**
- **Pattern:** Polling-based list with fixed pagination
- **Rationale:** Max 500 streams/page, updates via polling + Wails events
- **Implementation:**
  ```tsx
  // Poll every 4 seconds, manual refresh button
  const { data } = useQuery(['streams'], () => ListStreams(200, 0), {
    refetchInterval: 4000,
    refetchIntervalInBackground: false
  });
  ```
- **UI Elements:** Auto-refresh indicator, manual refresh button, "Auto-follow latest" toggle
- **Anti-pattern:** ❌ WebSocket connections, continuous auto-scroll

#### **Live Bets List**
- **Pattern:** Hybrid cursor pagination + incremental tail polling
- **Rationale:** Max 10K bets/page for backfill, cursor-based tail for new rows
- **Implementation:**
  ```tsx
  // Infinite query for backfill + tail polling for new rows
  const { rows, flushPending, pendingCount } = useBetsStream({
    streamId,
    minMultiplier: 0,
    pageSize: 200,
    order: 'desc'
  });
  
  // Show buffer notification
  {pendingCount > 0 && (
    <button onClick={flushPending}>
      {pendingCount} new bets (click to load)
    </button>
  )}
  ```
- **UI Elements:** "X new bets" notification banner, manual flush button, virtualized list
- **Anti-pattern:** ❌ Auto-prepend without user interaction (causes scroll jump)

### ❌ PROHIBITED PATTERNS

1. **Infinite Scroll without Explicit Pagination**
   - Reason: Backend has hard page limits; infinite scroll creates false expectation
   - Exception: None

2. **Client-Side Pagination for Large Lists**
   - Reason: Defeats server-side filtering; loads unnecessary data
   - Exception: None

3. **Auto-Scroll to Bottom on New Data**
   - Reason: Interrupts user reading; use buffer + notification pattern
   - Exception: Only if user explicitly opts in via "auto-follow" toggle

---

## Mutation Strategy

### ✅ OPTIMISTIC UI ELIGIBLE

**Local State Only:**
- Theme toggle
- UI preferences (view mode, column visibility)
- Form field values (pre-validation)
- Expansion/collapse states
- Modal open/close

**Example:**
```tsx
// Optimistic for local state
const [theme, setTheme] = useState('dark');
const toggleTheme = () => {
  setTheme(prev => prev === 'dark' ? 'light' : 'dark'); // Immediate
};
```

### ❌ OPTIMISTIC UI PROHIBITED

**Server Mutations:**
1. **StartScan**
   - Reason: 5-30s operation with potential timeout/cancellation
   - Pattern: Show progress UI, poll for updates, handle cancellation
   ```tsx
   const mutation = useMutation(StartScan, {
     onSuccess: (result) => {
       // Wait for server confirmation before updating UI
       queryClient.setQueryData(['run', result.runID], result);
     }
   });
   ```

2. **DeleteStream / DeleteRun**
   - Reason: Destructive operation with cascade; must confirm server success
   - Pattern: Disable UI, show spinner, only update on 2xx response

3. **UpdateNotes**
   - Reason: Immediate consistency required for multi-tab scenarios
   - Pattern: Server-confirmed update with loading state

4. **Live Bet Ingest**
   - Reason: Idempotency + duplicate detection on server
   - Pattern: Wait for server acceptance before showing in list

**Example (CORRECT):**
```tsx
const deleteMutation = useMutation(DeleteStream, {
  onMutate: (streamId) => {
    // Show loading state, do NOT remove from list yet
    setDeleting(streamId);
  },
  onSuccess: (_, streamId) => {
    // Only now remove from list
    queryClient.setQueryData(['streams'], prev => 
      prev.filter(s => s.id !== streamId)
    );
  },
  onError: () => {
    // Revert UI to previous state
    setDeleting(null);
  }
});
```

---

## Loading Patterns

### Latency Thresholds

| Latency Range | Pattern | Example Operations |
|---------------|---------|-------------------|
| < 10ms | No indicator | GetGames, HashServerSeed |
| 10-100ms | Skeleton screen | ListRuns, GetRun, ListStreams |
| 100ms-1s | Spinner | Small scans (<1K nonces) |
| 1-10s | Progress bar + spinner | Medium scans (1K-100K nonces) |
| > 10s | Progress bar + time estimate + cancel button | Large scans (100K-10M nonces) |

### Implementation Guidance

#### **Instant (< 10ms): No Indicator**
```tsx
// No loading state needed
const games = GetGames();
return <GameSelector games={games} />;
```

#### **Fast (10-100ms): Skeleton Screen**
```tsx
const { data, isLoading } = useQuery(['runs'], ListRuns);

if (isLoading) {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
```

#### **Moderate (100ms-1s): Spinner**
```tsx
const { data, isLoading } = useQuery(['run', runId], () => GetRun(runId));

if (isLoading) {
  return (
    <div className="flex items-center justify-center py-8">
      <Spinner size="lg" />
      <span className="ml-2">Loading run...</span>
    </div>
  );
}
```

#### **Slow (1-30s): Progress Bar with Cancel**
```tsx
const [progress, setProgress] = useState(0);
const mutation = useMutation(StartScan, {
  onMutate: () => setProgress(0),
  // Poll for progress or estimate based on nonce range
});

return (
  <div className="space-y-4">
    <Progress value={progress} />
    <div className="flex justify-between">
      <span>{Math.round(progress)}% complete</span>
      <Button variant="ghost" onClick={() => CancelRun(runId)}>
        Cancel
      </Button>
    </div>
    <p className="text-sm text-muted-foreground">
      Scanning {formatNumber(nonceRange)} nonces...
    </p>
  </div>
);
```

#### **Very Slow (30s-5min): Progress + Time Estimate + Cancel**
```tsx
const [elapsed, setElapsed] = useState(0);
const [estimated, setEstimated] = useState<number | null>(null);

useEffect(() => {
  const timer = setInterval(() => setElapsed(e => e + 1), 1000);
  return () => clearInterval(timer);
}, []);

return (
  <div className="space-y-4">
    <Progress value={progress} />
    <div className="flex justify-between text-sm">
      <span>Elapsed: {formatDuration(elapsed)}</span>
      {estimated && (
        <span>Est. remaining: {formatDuration(estimated - elapsed)}</span>
      )}
    </div>
    <Button variant="destructive" onClick={handleCancel}>
      Cancel Scan
    </Button>
  </div>
);
```

### Anti-Patterns

❌ **Spinner for operations > 5 seconds** (use progress bar)  
❌ **No loading indicator for operations > 100ms** (causes confusion)  
❌ **Progress bar without cancel button for > 10s operations** (user needs escape hatch)  
❌ **Fake progress animations** (use real progress or indeterminate state)

---

## Error Handling

### Error Taxonomy

Based on `backend-inventory.json` error taxonomy, implement these UI patterns:

#### **1. Validation Errors (400)**
- **Category:** validation
- **Retryable:** No
- **User Action:** Fix input
- **UI Pattern:**
  ```tsx
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Invalid Input</AlertTitle>
    <AlertDescription>
      {error.message}
      {error.context?.field && (
        <span className="block mt-1 text-sm">
          Field: {error.context.field}
        </span>
      )}
    </AlertDescription>
  </Alert>
  ```
- **Recovery:** Highlight invalid field, show inline validation, provide example

#### **2. Game Not Found (400)**
- **Category:** game
- **Retryable:** No
- **User Action:** Select valid game
- **UI Pattern:**
  ```tsx
  <Alert variant="destructive">
    <AlertTitle>Game Not Supported</AlertTitle>
    <AlertDescription>
      The game "{error.context?.game}" is not supported.
      <div className="mt-2">
        <Button onClick={showGameSelector}>Select a game</Button>
      </div>
    </AlertDescription>
  </Alert>
  ```

#### **3. Timeout (408)**
- **Category:** timeout
- **Retryable:** Yes
- **User Action:** Reduce range or retry
- **UI Pattern:**
  ```tsx
  <Alert variant="warning">
    <Clock className="h-4 w-4" />
    <AlertTitle>Scan Timed Out</AlertTitle>
    <AlertDescription>
      The scan took longer than {timeout}ms. Try:
      <ul className="list-disc list-inside mt-2">
        <li>Reducing the nonce range</li>
        <li>Narrowing the target criteria</li>
        <li>Retrying with a larger timeout</li>
      </ul>
      <div className="mt-3 flex gap-2">
        <Button onClick={reduceRange}>Reduce Range</Button>
        <Button variant="outline" onClick={retry}>Retry</Button>
      </div>
    </AlertDescription>
  </Alert>
  ```

#### **4. Internal Error (500)**
- **Category:** system
- **Retryable:** Yes
- **User Action:** Retry with exponential backoff
- **UI Pattern:**
  ```tsx
  <Alert variant="destructive">
    <AlertTitle>Server Error</AlertTitle>
    <AlertDescription>
      An unexpected error occurred. This has been logged.
      <div className="mt-3">
        <Button onClick={retryWithBackoff}>Retry</Button>
      </div>
    </AlertDescription>
  </Alert>
  ```
- **Implementation:** Exponential backoff: 1s, 2s, 4s, 8s (max 3 retries)

#### **5. Not Found (404)**
- **Category:** validation
- **Retryable:** No
- **User Action:** Check ID or navigate back
- **UI Pattern:**
  ```tsx
  <Alert variant="default">
    <AlertTitle>Resource Not Found</AlertTitle>
    <AlertDescription>
      The {resourceType} you're looking for doesn't exist.
      <div className="mt-3">
        <Button onClick={navigateBack}>Go Back</Button>
      </div>
    </AlertDescription>
  </Alert>
  ```

### Error Boundaries

**Required for:**
- All route-level components
- Async data fetching components
- Long-running operation UI

**Implementation:**
```tsx
<ErrorBoundary
  fallback={<ErrorFallback />}
  onReset={() => queryClient.resetQueries()}
>
  <AsyncComponent />
</ErrorBoundary>
```

### Retry Strategy

```typescript
const retryConfig = {
  validation_error: { attempts: 0, backoff: null },
  game_not_found: { attempts: 0, backoff: null },
  timeout: { attempts: 2, backoff: 'linear', delay: 2000 },
  internal_error: { attempts: 3, backoff: 'exponential', delay: 1000 },
  not_found: { attempts: 0, backoff: null }
};

function shouldRetry(error: EngineError): boolean {
  const config = retryConfig[error.type];
  return config.attempts > 0;
}

function getRetryDelay(error: EngineError, attempt: number): number {
  const config = retryConfig[error.type];
  if (config.backoff === 'exponential') {
    return config.delay * Math.pow(2, attempt - 1);
  }
  return config.delay;
}
```

---

## Realtime Updates

### Pattern: Wails Event Bus (NOT WebSocket)

**Architecture:** Desktop app uses Wails event system for server→client push.

#### **Live Bet Streams**

**Event:** `live:newrows:{streamId}`

**UI Implementation:**
```tsx
useEffect(() => {
  const unsubscribe = EventsOn(`live:newrows:${streamId}`, () => {
    // Fetch new rows via tail endpoint
    fetchTail();
  });
  return unsubscribe;
}, [streamId]);
```

**UI Pattern:**
1. Listen for event
2. Fetch incremental data via `/tail` endpoint
3. Buffer new rows (don't auto-prepend)
4. Show notification: "X new bets available"
5. User clicks to flush buffer

**Anti-Patterns:**
- ❌ WebSocket connections (not implemented)
- ❌ Server-Sent Events (not implemented)
- ❌ Auto-prepend new data (scroll jump)

#### **Polling Intervals**

| Resource | Interval | Condition |
|----------|----------|-----------|
| Streams list | 4s | When tab active |
| Stream detail | none | Event-driven only |
| Runs list | 10s | When scan in progress |
| Run detail | 2s | When scan in progress |

**Implementation:**
```tsx
const { data } = useQuery(['streams'], fetchStreams, {
  refetchInterval: 4000,
  refetchIntervalInBackground: false, // Pause when tab hidden
  enabled: isTabActive // Use Page Visibility API
});
```

---

## Performance Budgets

### Component Render Budgets

| Component | Max Render Time | Measurement |
|-----------|-----------------|-------------|
| Scan form | 50ms | Time to interactive |
| Runs table row | 5ms | Per row render |
| Hits table row | 5ms | Per row render (virtualized) |
| Live bets row | 8ms | Per row render (complex calc) |
| Game selector | 10ms | Dropdown open |

**Implementation:**
```tsx
// Use React.memo for expensive row components
const RunRow = React.memo(({ run }: { run: Run }) => {
  // Row implementation
}, (prev, next) => prev.run.id === next.run.id);

// Virtualize large lists
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: hits.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 40, // Row height
});
```

### Bundle Size Impact

**Prohibited:**
- Heavy animation libraries for loading states (use CSS)
- Client-side CSV generation for > 1000 rows (use server export endpoint)
- Large date libraries (use native Intl APIs)

---

## Resource-Specific Guidance

### **Runs**

**Operations:** ListRuns, GetRun, GetSeedRuns, StartScan, CancelRun

**UI Requirements:**
- ✅ Pagination controls (20/page default, 100 max)
- ✅ Game filter dropdown
- ✅ Progress indicator for active scans
- ✅ Cancel button for in-progress scans
- ✅ Skeleton loader for initial fetch
- ✅ Error boundary around list

**Forbidden:**
- ❌ Infinite scroll
- ❌ Client-side filtering beyond current page
- ❌ Auto-refresh without visual indicator

### **Hits**

**Operations:** GetRunHits

**UI Requirements:**
- ✅ Server-side pagination (50/page default, 1000 max)
- ✅ Virtualized list for rendering performance
- ✅ "Load More" button (explicit user action)
- ✅ Delta nonce display (backend provides)
- ✅ Export to CSV link (uses server endpoint)

**Forbidden:**
- ❌ Fetch all hits to client
- ❌ Client-side sorting/filtering
- ❌ Auto-load next page on scroll

### **Live Streams**

**Operations:** ListStreams, GetStream, GetBets, Tail, DeleteStream, UpdateNotes, ExportCSV

**UI Requirements:**
- ✅ Polling every 4s when tab active
- ✅ Event listener for new rows
- ✅ Buffer + notification pattern for new bets
- ✅ Manual refresh button
- ✅ "Auto-follow latest" toggle
- ✅ Confirmation dialog for delete

**Forbidden:**
- ❌ WebSocket connections
- ❌ Auto-scroll without user opt-in
- ❌ Delete without confirmation

### **Games**

**Operations:** GetGames

**UI Requirements:**
- ✅ Cache indefinitely (static data)
- ✅ No loading state needed (< 10ms)
- ✅ Preload on app init

---

## Global Policies

### Cache TTLs

```typescript
const queryConfig = {
  games: { staleTime: Infinity }, // Never stale
  runs: { staleTime: 10_000 }, // 10s
  run: { staleTime: 5_000 }, // 5s (shorter for active scans)
  hits: { staleTime: 30_000 }, // 30s
  streams: { staleTime: 4_000 }, // 4s
  bets: { staleTime: 2_000 }, // 2s (realtime-ish)
};
```

### Retry Policy

See [Error Handling](#error-handling) section.

### Concurrency

**Model:** Single-user desktop application, no conflict resolution needed.

**Implications:**
- No optimistic locking
- No version fields
- Last-write-wins for notes updates
- No multi-tab sync beyond polling

### RBAC

**Model:** None (local-only operation)

**Implications:**
- No permission checks in UI
- All operations available to all users
- Optional token for live ingest (not RBAC, just access control)

---

## Compliance Checklist

Before shipping a new feature, verify:

- [ ] List views use correct pagination pattern per resource
- [ ] Loading states match latency thresholds
- [ ] Error handling follows taxonomy with proper recovery
- [ ] Mutations are server-confirmed (not optimistic unless local state)
- [ ] Realtime updates use Wails events (not WebSocket)
- [ ] Polling intervals respect activity state
- [ ] Error boundaries wrap async components
- [ ] Retry logic uses exponential backoff where applicable
- [ ] Virtualized lists for > 50 rows
- [ ] No client-side operations on full dataset (use server filtering/export)

---

## Waiver Process

To violate a constraint, document in `.design-constraints-waivers.json`:

```json
{
  "waivers": [
    {
      "file": "src/pages/CustomHitsList.tsx",
      "rule": "hits_pagination_required",
      "justification": "Special case for demo mode with max 100 hits",
      "approved_by": "tech-lead",
      "expires": "2025-12-31"
    }
  ]
}
```

Validator will check waivers before failing CI.
