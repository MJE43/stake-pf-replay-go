Stake PF Replay — Backend Design Constraints (Ground Truth)

Date: 2025-10-01
Scope: Core API (backend/internal/api), Live HTTP (internal/livehttp), Wails Events

How To Consume
- Treat this file as the canonical source for product and UI. When in doubt, follow these constraints over ad-hoc preferences. Backend inventory lives in `docs/generated/backend-inventory.json`; UI guidance lives in `docs/generated/ui-implications.md`.

Latency Budgets
- Verify (`POST /verify`): p50 5ms, p95 20ms (source: estimate; single evaluation)
- Scan (`POST /scan`): p50 1s, p95 5s for typical ranges (source: estimate; informed by performance tests throughput ~10k evals/sec)
- Streams list (`GET /live/streams`): p50 6ms, p95 20ms (source: estimate; local SQLite)
- Bets page (`GET /live/streams/{id}/bets` 500 rows): p50 12ms, p95 60ms (source: estimate)
- Tail (`GET /live/streams/{id}/tail`): p50 8ms, p95 30ms (source: estimate)

Pagination Rules
- Streams: offset pagination, default 100, max 500; UI must present explicit “Load More” (no automatic infinite scroll).
- Bets history: offset pagination, default 500, max 10,000; UI must virtualize when >200 rows; prefer page sizes ≤500.
- Bets live updates: use `since_id` cursor via `/tail` on event trigger; do not poll blindly.

Consistency Model
- Strong local consistency within the desktop process (single SQLite connection). UI may assume read-after-write for updates and ingest within the same app instance. For realtime, events are at-least-once and must be reconciled via `/tail` fetch.

Permission Model Impacts
- Core API: no authentication; single-user desktop context.
- Live ingest: optional header token `X-Ingest-Token` required only for `/live/ingest`. Other live endpoints are local-only; hide ingest token UX from end users and expose it only in developer/diagnostics.

Optimistic UI Eligibility
- Allowed: `PUT /live/streams/{id}` (notes), non-critical toggles. Provide rollback on error.
- Disallowed: `/scan`, `/verify`, `/live/ingest` results, any compute-derived data. Require server confirmation.

Loading / Skeleton Policy
- Lists/detail: show skeleton when request exceeds 600ms (p95). Under 600ms, prefer light shimmer or no indicator.
- Action spinners: show spinner for operations expected over 300ms. For long-running downloads (export.csv), use determinate progress if available.
- Bets: only skeleton on first load; thereafter show a small inline placeholder for incremental fetches; maintain header and filters.

Error Taxonomy (UI Mapping)
- Validation (ErrTypeValidation, VALIDATION_ERROR): inline field errors and disable submit until fixed. CTA “Fix and Retry”.
- Game errors (ErrTypeGameNotFound, ErrTypeGameEvaluation): banner with remediation; offer valid game selections.
- Timeout (ErrTypeTimeout): show banner; suggest increasing timeout or narrowing nonce range.
- System/Internal (ErrTypeInternal, SERVER_ERROR, SERVICE_UNAVAILABLE): toast and retry; include `request_id` in logs.
- Not Found (NOT_FOUND): redirect to streams list with toast.
- Unauthorized ingest (UNAUTHORIZED): show in ingest diagnostics only; not a user-facing flow.

Realtime Semantics
- Events: `live:newrows:{streamID}` (signal), `live:status:{streamID}` (state).
- Delivery: at-least-once; UI must always call `/tail` to fetch authoritative rows and advance lastID.
- UI behavior: prepend new rows; when scrolled to top, auto-reveal; otherwise show a “Show N new” button.

Banned UI Patterns (Enforced)
- Auto infinite scroll on `/live/streams` (offset pagination, max=500).
- Non-virtualized bets list when >200 rows.
- Optimistic UI for `/scan` and `/verify`.
- Polling for live updates without using events + `/tail`.

Global Policies
- Cache TTLs: 30s (`/games`), 10s (`/live/streams`) with manual invalidation on writes.
- Retries: network errors only; two attempts; jittered backoff (200ms, 500ms). Never retry 4xx/validation.
- Backoff for tail: exponential with decorrelated jitter; max 5s; show “Reconnecting”.

References
- Backend inventory: `docs/generated/backend-inventory.json`
- UI Implications: `docs/generated/ui-implications.md`

<!-- VERIFY-CONFIG:BEGIN -->
{
  "banned": [
    { "name": "streams-infinite-scroll", "pattern": "useInfiniteQuery|InfiniteScroll", "paths": ["frontend/src/pages/LiveStreamsListPage.tsx"], "rationale": "Streams use offset pagination; require explicit Load More" },
    { "name": "scan-optimistic", "pattern": "optimistic|setStateBeforeFetch", "paths": ["frontend/src/components/ScanForm.tsx", "frontend/src/pages/ScanPage.tsx"], "rationale": "Scan/verify must be server-confirmed" }
  ],
  "required": [
    { "name": "bets-virtualized", "pattern": "from 'react-virtuoso'|from \"react-virtuoso\"", "paths": ["frontend/src/components/LiveBetsTable.tsx"], "rationale": "Bets list must be virtualized >200 rows" }
  ],
  "waiver_file": ".design-constraints-allowlist.json"
}
<!-- VERIFY-CONFIG:END -->

