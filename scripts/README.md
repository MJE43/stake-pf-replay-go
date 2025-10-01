# Scripts

Utility scripts for development and CI validation.

## verify-design-constraints.mjs

Validates frontend code against design constraints defined in `docs/design-constraints.md`.

### Usage

```bash
# Run validation
npm run verify:constraints

# Run with verbose output
npm run verify:constraints:verbose

# Direct execution
node scripts/verify-design-constraints.mjs
node scripts/verify-design-constraints.mjs --verbose
```

### What It Checks

- **WebSocket/SSE Usage**: Prohibited (use Wails events instead)
- **Optimistic Mutations**: Scan/delete operations must wait for server confirmation
- **Loading States**: Async operations > 100ms must have loading UI
- **Pagination**: Lists must have explicit pagination controls (no infinite scroll without limits)
- **Buffer Pattern**: Realtime updates should buffer + notify before prepending
- **Cancellation UI**: Long operations should have cancel buttons
- **Hard Limits**: Client-side validation for backend limits (10M nonce range, etc.)
- **Error Boundaries**: Pages with async operations need error boundaries
- **Polling Behavior**: Must pause when tab inactive
- **Retry Logic**: Should use exponential backoff

### Exit Codes

- `0`: All checks passed
- `1`: Violations found (non-waived)
- `2`: Configuration/runtime error

### Waivers

To bypass a constraint check, create `.design-constraints-waivers.json`:

```json
{
  "version": "1.0.0",
  "waivers": [
    {
      "id": "w-001",
      "file": "src/pages/SpecialCase.tsx",
      "rule": "pagination_controls_required",
      "justification": "Demo mode with max 100 items",
      "approved_by": "tech-lead",
      "approved_date": "2025-10-01",
      "expires": "2025-12-31"
    }
  ]
}
```

### Integration with CI

Add to your CI pipeline:

```yaml
- name: Validate Design Constraints
  run: npm run verify:constraints
```

Warnings pass CI; violations fail unless waived.
