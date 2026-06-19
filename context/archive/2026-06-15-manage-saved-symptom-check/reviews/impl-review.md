<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Manage Saved Symptom Checks

- **Plan**: `context/changes/manage-saved-symptom-check/plan.md`
- **Scope**: Phases 1-4 of 4
- **Date**: 2026-06-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | FAIL |

## Verification

- `npm test`: PASS — 12 files, 171 tests passed.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `TEST_DATABASE_URL=postgresql://app:password@127.0.0.1:5432/allergen_finder_test npm run test:db`: PASS — 2 files, 13 tests passed.
- `npm audit --json`: FAIL — 12 advisories, 2 high, 10 moderate, 0 critical; accepted-audit documentation refreshed in `README.md` and `context/deployment/deploy-plan.md`.

## Findings

### F1 — Delete failure message is not shown in confirmation context

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `app/routes/history.$checkId.tsx:322`
- **Detail**: The plan requires failed delete to keep the record and confirmation context visible with an inline retry message. The route had one action error, but it was rendered only inside the edit section. If delete failed while the delete confirmation was open, the confirmation remained open without showing the retry error.
- **Fix**: Render `errorMessage` inside the delete confirmation form when `deletePromptOpen` is true.
- **Decision**: FIXED — added an inline `role="alert"` message to the delete confirmation form.

### F2 — PostgreSQL release gate was not verifiable locally

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: N/A
- **Detail**: Initial `npm run test:db` failed before running tests because `TEST_DATABASE_URL` was not set. The plan relies on real PostgreSQL evidence for two-user update/delete isolation, so the gate was unverified until rerun against a disposable database.
- **Fix**: Run `npm run test:db` with a disposable PostgreSQL URL and record the passing output before release handoff.
  - Strength: Directly satisfies the plan's ownership-isolation evidence.
  - Tradeoff: Requires local or CI database setup.
  - Confidence: HIGH — the initial command failure was only missing environment.
  - Blind spot: None significant after the rerun passed.
- **Decision**: FIXED + ACCEPTED-AS-RULE — `npm run test:db` passed against the local disposable PostgreSQL database, and the lesson "Verify Opt-In Integration Gates With Real Environment" was added to `context/foundation/lessons.md`.

### F3 — Current audit output is not fully documented

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `README.md:128`
- **Detail**: `npm audit --json` exits 1 with 12 advisories, including 2 high. README documented an older June 10 state with no high advisories. The deploy plan had a June 15 acceptance note, but the current audit differed and included fix-available items, so the release-gate evidence was stale.
- **Fix**: Refresh the accepted-audit documentation with the June 18 audit output or apply safe dependency fixes in a separate reviewed change.
  - Strength: Restores the "fixed or documented" release gate.
  - Tradeoff: Dependency fixes may have compatibility impact.
  - Confidence: HIGH — current command output disagreed with README.
  - Blind spot: `npm audit fix` was not run because this review chose documentation refresh.
- **Decision**: FIXED — refreshed accepted-audit documentation in `README.md` and `context/deployment/deploy-plan.md`.

### F4 — Unplanned home copy changes are in the git range

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `app/routes/home.tsx`
- **Detail**: `app/routes/home.tsx` appears in the post-plan git range via later `fix(home)` commits, but it is not part of the manage-saved-symptom-check plan. It looks benign and unrelated, not a functional blocker.
- **Fix**: Mention it separately in handoff notes or keep it out of the review scope if it belongs to a separate cleanup.
- **Decision**: FIXED — documented the out-of-scope home copy commits in `context/changes/manage-saved-symptom-check/change.md`.

## Triage Summary

- **Fixed**: F1, F2, F3, F4
- **Rule**: F2
- **Skipped**: None
- **Accepted**: None
