<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Device Location For Current Check

- **Plan**: context/changes/device-location-current-check/plan.md
- **Scope**: Phases 1-3 of 3
- **Date**: 2026-06-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 3 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Empty coordinate strings pass validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/domain/current-location/http.ts:151
- **Detail**: `Number(latitude.trim())` and `Number(longitude.trim())` convert empty or whitespace strings to `0`, so `{ latitude: "", longitude: "" }` reaches the provider as `0,0` instead of returning `invalid-input`.
- **Fix**: Reject empty trimmed coordinate strings before numeric conversion and add a test for empty/whitespace coordinates.
- **Decision**: FIXED — Rejected blank trimmed coordinate strings before numeric conversion and added a regression assertion in `current-location.test.ts`.

### F2 — Non-OK Google statuses become not-found

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: app/domain/current-location/google-current-location.server.ts:140
- **Detail**: HTTP 200 Google responses with statuses such as `REQUEST_DENIED`, `OVER_QUERY_LIMIT`, or `INVALID_REQUEST` fall through to the no-city path. That misclassifies provider failures as user-location misses.
- **Fix**: Treat `OK` as resolvable, `ZERO_RESULTS` as `not-found`, and any other provider status as `provider-unavailable`.
- **Decision**: FIXED — Treated `ZERO_RESULTS` as `not-found`, other non-`OK` Google statuses as `provider-unavailable`, and added a regression test for `REQUEST_DENIED`.

### F3 — Local secret ignores are too narrow

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .gitignore:5
- **Detail**: `.gitignore` ignores `.env` but not common local secret files such as `.env.local`, `.env.*.local`, or downloaded local credential JSON files. This feature uses `GOOGLE_MAPS_API_KEY`, so local secret hygiene matters.
- **Fix**: Add ignores for `.env.local`, `.env.*.local`, and project-local credential JSON patterns.
- **Decision**: FIXED — Added `.env.local`, `.env.*.local`, and local credential JSON ignore patterns.

### F4 — Provider request URL carries precise coordinates

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: app/domain/current-location/google-current-location.server.ts:117
- **Detail**: The app/browser privacy boundary is preserved, but Google reverse geocoding uses a `latlng` query parameter in the server-to-Google URL. That can expose precise coordinates in outbound proxy or request logs if such logging exists.
- **Fix**: Document this as an accepted provider-boundary exception and ensure outbound URLs with query strings are not logged.
- **Decision**: ACCEPTED WITH SAFEGUARD — Accepted Google `latlng` as the provider-boundary exception, verified no current-location provider logging of outbound URLs exists, and added a regression test asserting the reverse-geocoding path does not write to console logs.

## Verification

- `npm test -- app/domain/current-location/current-location.test.ts`: PASS — 1 file, 13 tests.
- `npm run typecheck`: PASS — emitted the Node `module.register()` deprecation warning from the toolchain.
- `npm test -- app/components/current-location-control.test.tsx`: PASS — 1 file, 6 tests.
- `npm test`: PASS — 13 files, 182 tests.
- `npm audit --json`: COMPLETED WITH DOCUMENTED ADVISORIES — exited non-zero with 12 advisories, matching the accepted June 18, 2026 audit documentation in `README.md` and `context/deployment/deploy-plan.md`.
