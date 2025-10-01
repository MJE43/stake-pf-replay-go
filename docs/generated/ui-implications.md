**Overview**
- Treat this document as binding guidance for UI behavior derived from the backend inventory. Each directive references the relevant route(s) and rationale. When backend capability or limits change, update the backend-inventory.json first, then refresh this file accordingly.

**List Patterns**
- Streams list (`/live/streams`): Use “Load More” pagination (manual trigger). Do not auto‑infinite scroll. Rationale: offset pagination, max limit 500, low-latency local DB—auto fetch can thrash state and reorder by last_seen.
- Stream bets (`/live/streams/{id}/bets`): Use virtualized list with “fetch older on scroll end”. New rows must prepend via tail. Rationale: high cardinality, tail endpoint, at-least-once event.
- Games (`/games`): Static fetch, no pagination.

**Mutation Strategy**
- Scan (`/scan`) and Verify (`/verify`): Server-confirmed only. No optimistic UI. Show progress state; allow cancel where applicable via bindings.
- Update stream notes (`PUT /live/streams/{id}`): Optimistic allowed with rollback on error.
- Delete stream (`DELETE /live/streams/{id}`): Require confirm. Optimistic removal allowed with undo; rollback on failure.

**Loading Policy**
- Skeleton threshold: show a skeleton for list/detail views if request exceeds 600ms p95; otherwise, inline shimmer or no indicator.
- Spinner threshold: show spinner for actions expected over 300ms; for batch downloads (export.csv) show determinate progress where possible.
- Stream bets: keep header and controls visible; table body skeleton only on first load.

**Error Handling / Copy**
- Validation (ErrTypeValidation, VALIDATION_ERROR): show inline field errors; keep form values. CTA: “Fix and Retry”.
- Game not found / evaluation errors (ErrTypeGameNotFound/ErrTypeGameEvaluation): show descriptive banner; offer to select a valid game.
- Timeout (ErrTypeTimeout): banner with “Increase timeout or narrow range.” Keep partial summary if present.
- System/Internal (ErrTypeInternal/SERVER_ERROR): toast + retry button; include `request_id` in developer console.
- Not Found (NOT_FOUND): redirect to streams list; show toast.
- Unauthorized (UNAUTHORIZED on ingest): surface in ingest status diagnostic only; not a user flow.

**Pagination Rules**
- Streams: offset pagination, default 100, max 500; page sizes 50–200 recommended.
- Bets: offset pagination for history (default 500, max 10,000); use 200–500 with virtualization; live tail for new data with since_id cursor.

**Consistency Model**
- Strong-local reads (single-process SQLite). UI may assume read-after-write consistency within the app instance. When ingest emits events, UI must fetch tail to reconcile.

**Realtime Semantics**
- Channel `live:newrows:{streamID}` (Wails events): at-least-once signaling; always follow with `GET /tail` to fetch authoritative rows and lastID.
- Channel `live:status:{streamID}`: connection state; present “Live/Reconnecting” badge in bets table.

**Optimistic UI Eligibility**
- Allowed: `PUT /live/streams/{id}` (notes), transient UI-only flags.
- Disallowed: `/scan`, `/verify`, ingest; any state derived from computation results.

**RBAC / Permissions**
- Core API: no auth, single-user desktop context.
- Live ingest: optional `X-Ingest-Token` required only for `/live/ingest`; other live endpoints are local-only.

**Performance Budgets**
- Verify p95: 20ms (estimate). Scan p95: 5s for typical ranges (estimate). Streams list p95: 20ms (estimate). Bets page p95: 60ms for 500 rows (estimate).
- Payload p95: bets page ≤ ~180KB for 500 rows; avoid 10k pages.

**Anti‑Patterns (Prohibited)**
- Auto infinite scroll on streams list.
- Non-virtualized bets table beyond 200 rows.
- Optimistic UI for scan/verify.
- Polling for live updates without consuming `live:newrows:{streamID}` + `/tail`.

**Global Policy Footer**
- Caching: in-memory cache TTL 30s for `/games`, 10s for `/live/streams` (manual invalidation on write).
- Retries: network errors 2 retries with jittered backoff (200ms, 500ms). Do not retry validation or 4xx.
- Backoff: exponential with decorrelated jitter for tail failures; cap at 5s; show “Reconnecting”.
