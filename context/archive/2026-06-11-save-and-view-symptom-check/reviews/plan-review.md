<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Save And View Private Symptom Checks

- **Plan**: `context/changes/save-and-view-symptom-check/plan.md`
- **Date**: 2026-06-11
- **Verdict**: READY AFTER REVISIONS
- **Findings**: 0 critical, 10 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Internal consistency | PASS after revision |
| Feasibility | PASS after revision |
| Security and privacy | PASS after revision |
| Migration and operations | PASS after revision |
| Test evidence | PASS after revision |
| Scope discipline | PASS |

## Resolved Findings

### PR-01 — Phase 3 redirected to a Phase 4 route

- **Severity**: Warning
- **Impact**: Low
- **Resolution**: Added the minimal protected detail destination, route
  registration, owner-scoped loader, and Polish not-found boundary to Phase 3.
  Phase 4 now expands that page.

### PR-02 — Pending browser state had no success cleanup mechanism

- **Severity**: Warning
- **Impact**: Medium
- **Resolution**: The successful detail destination clears only the matching
  request ID and removes transient success query state so refresh does not
  repeat the message.

### PR-03 — Explicit-consent UI criterion was not executable in Node Vitest

- **Severity**: Warning
- **Impact**: Medium
- **Resolution**: Replaced the implied component-interaction test with a real
  PostgreSQL integration scenario that verifies ordinary current-check and
  pollen requests leave row count unchanged and only explicit save inserts.

### PR-04 — Invalid save responses lacked a rendering contract

- **Severity**: Warning
- **Impact**: Low
- **Resolution**: The save component must consume action/fetcher failures and
  display actionable Polish feedback while preserving the completed check.

### PR-05 — History not-found pages would use the generic English boundary

- **Severity**: Warning
- **Impact**: Low
- **Resolution**: Added a route-level Polish `ErrorBoundary` shared by invalid,
  missing, and foreign detail IDs.

### PR-06 — Backup verification omitted the required restore drill

- **Severity**: Warning
- **Impact**: Medium
- **Resolution**: Added retention documentation and a non-production restore
  drill with evidence before history is treated as durable.

### PR-07 — CSRF behavior did not explicitly reuse the hardened boundary

- **Severity**: Warning
- **Impact**: Low
- **Resolution**: The save action must reuse `hasTrustedRequestOrigin` and test
  matching Origin, Referer fallback, missing, null, malformed, and cross-origin
  cases before private body parsing.

### PR-08 — Idempotency-key reuse with different content was undefined

- **Severity**: Warning
- **Impact**: Medium
- **Resolution**: Same-content retries return the existing record; different
  canonical content under the same owner/request ID returns a typed conflict.
  Concurrent and conflict tests are required.

### PR-09 — Completion timestamps were insufficiently bounded

- **Severity**: Warning
- **Impact**: Low
- **Resolution**: Direct signed-in saves derive completion time server-side.
  Guest handoff timestamps must fit the draft lifetime and future-skew bound.

### PR-10 — Explicit-consent evidence did not inspect persistence

- **Severity**: Warning
- **Impact**: Medium
- **Resolution**: Added automated disposable-PostgreSQL row-count evidence to
  the Phase 3 gate.

## Verified Strengths

- Owner identity is derived from the revocation-aware authenticated session.
- Every repository operation is owner-scoped and foreign/missing detail is
  indistinguishable.
- The snapshot stores minimum location context and no generated medical prose.
- History never enters the new-check ranking path.
- The migration remains additive and rollback-compatible.
- No recommendation required a HIGH-impact architectural change.
