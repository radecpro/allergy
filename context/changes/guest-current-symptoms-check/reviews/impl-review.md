<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Guest Current-Symptoms Allergen Check

- **Plan**: context/changes/guest-current-symptoms-check/plan.md
- **Scope**: Phases 1-4 of 4
- **Date**: 2026-06-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 4 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verification

- `npm run verify:current-location` passed; emitted `vite-node` `EMFILE` watcher warnings.
- `npm run verify:allergen-ranking` passed; emitted `vite-node` `EMFILE` watcher warnings.
- `npm run typecheck` passed.
- `npm audit --json` passed with 0 vulnerabilities.

## Findings

### F1 — Autocomplete always makes two provider calls

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/domain/current-location/google-city-search.server.ts:165
- **Detail**: Every valid city search made a Poland-restricted Places call and then a global Places call, doubling latency and billable calls even when Polish results were already sufficient.
- **Fix**: Only call global autocomplete when Poland-restricted results are below a small threshold.
- **Decision**: FIXED — added a 5-suggestion threshold before making the global autocomplete request.

### F2 — Pollen endpoint is an unbounded billable proxy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: app/routes/api.current-pollen.ts:22
- **Detail**: `/api/current-pollen` accepts any syntactically valid `placeId` and can trigger geocoding plus pollen lookup. Direct callers can bypass the UI and force two billable Google calls per request.
- **Fix ⭐ Recommended**: Add server-side abuse controls: cache by `placeId`, then add rate limiting or signed city-search tokens before public exposure.
  - Strength: Reduces cost risk while preserving the guest flow.
  - Tradeoff: Rate limiting/token validation needs deployment-aware design.
  - Confidence: MED — local app has no persistence or edge middleware yet.
  - Blind spot: Final hosting platform constraints are not checked here.
- **Decision**: PENDING — queued as follow-up.

### F3 — Pollen response exposes unnecessary coordinates

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/routes/api.current-pollen.ts:33
- **Detail**: The endpoint returned geocoded `city`, including latitude and longitude. The UI already has the selected suggestion, so the API exposed more location data than the client needed.
- **Fix**: Return only normalized pollen activity, status, and message; omit `city` from the response.
- **Decision**: FIXED — removed `city` from `CurrentPollenResponse` and the route payload.

### F4 — Missing pollen data can be cached as successful

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: app/domain/current-location/google-pollen.server.ts:130
- **Detail**: A 200 Google Pollen response with missing `dailyInfo` or no usable index values returned `status: "ok"` with all `unknown` values. `ok` pollen responses are cached for 300 seconds, so unsupported or missing data could be cached as a valid lookup.
- **Fix**: Detect no usable pollen data after normalization and return a fallback status.
  - Strength: Keeps cache semantics aligned with fallback semantics.
  - Tradeoff: Need a small helper to distinguish true low activity from unknown/missing data.
  - Confidence: HIGH — the route already uses `no-store` for non-ok statuses.
  - Blind spot: None significant.
- **Decision**: FIXED — added mapped-index detection and returns `not-found` when no usable mapped pollen index is present.
