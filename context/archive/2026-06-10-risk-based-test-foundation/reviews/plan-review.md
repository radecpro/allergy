<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Risk-Based Test Foundation

Reviewed: 2026-06-10
Plan: `context/changes/risk-based-test-foundation/plan.md`
Verdict: ready for implementation after accepted revisions

## Findings

### PR-01 — Rollout rows cannot be resumed from one change folder

- **Severity:** High
- **Status:** resolved
- **Plan references:** lines 46–48, 134–140
- **Schema reference:** `10x-test-plan` §3 Phased Rollout

The referenced schema defines every rollout row as one discrete phase with one
change folder. Its status is derived from that folder's artifacts and canonical
`## Progress` block. The proposed second row is delivered across S-01 through
S-03, and the third across S-04 through S-06. Those are multiple independent
roadmap changes, so neither row has a single folder from which the orchestrator
can derive `change opened`, `researched`, `planned`, `implementing`, or
`complete`.

This breaks the desired end state's claim that `test-plan.md` is compatible
with the local schema and usable as resumable rollout state. A later
`/10x-test-plan` invocation would either open a duplicate test-only change or
attach the row to one product slice and incorrectly report the other slices as
complete.

**Required revision:** choose one state model explicitly:

1. Make rows 2 and 3 dedicated test-rollout changes, each with one future
   change folder and clear prerequisites on the relevant product slices; or
2. Use one rollout row per owning product change and increase/reframe the rows
   accordingly; or
3. Drop orchestrator/schema compatibility and describe the artifact as a
   non-resumable risk guide.

Keep the baseline row tied to
`context/changes/risk-based-test-foundation/`, and only mark it `complete` when
this plan's entire Progress block, including manual approvals, is complete.

**Resolution:** Accepted. The plan now defines one change folder per rollout
row. Future ownership and expansion rows are dedicated gap-filling rollouts
with explicit roadmap prerequisites and `—` as the folder until opened.

### PR-02 — The zero-reference verification criterion is unsatisfiable

- **Severity:** Medium
- **Status:** resolved
- **Plan references:** lines 64, 94–98, 196–198, 225
- **Repository evidence:** `package-lock.json`, `context/foundation/health-check.md`,
  `context/foundation/stack-assessment.md`, `context/archive/`

Removing the direct `vite-node` dependency will not remove every `vite-node`
reference. `@react-router/dev` currently brings its own transitive
`vite-node`, so the lockfile will still contain that package. The repository
also intentionally preserves archived plans and reviews that name the old
smoke commands, while current foundation assessments describe the pre-runner
state.

Therefore a repository-wide search cannot satisfy “no remaining references”
without unrelated dependency or documentation churn, including edits to
archives. It also conflates the real requirement, removing the direct
verification interface, with transitive and historical evidence.

**Required revision:** replace the criterion with checks that:

- `package.json` has no direct `vite-node` dependency or `verify:*` scripts;
- `npm ls vite-node --depth=0` shows no top-level package;
- the two smoke source files are absent;
- active executable/configuration references are absent, excluding
  `package-lock.json` transitive entries and `context/archive/`;
- current foundation assessments are either updated with a dated addendum or
  explicitly treated as point-in-time reports so they do not compete with
  `AGENTS.md` and `context/foundation/test-plan.md`.

**Resolution:** Accepted. Verification now checks the direct dependency,
top-level package tree, scripts, smoke files, and active executable/config
references. Transitive lockfile entries, archives, and dated assessments are
explicitly excluded.

## Verified Strengths

- Vitest 4.1.x supports Vite 8 and Node 24+; current package metadata also
  covers the repository's Node 26 development runtime.
- The proposed test cases preserve the meaningful assertions in both smoke
  scripts without requiring live Google requests.
- The plan correctly defers cross-user authorization tests until auth and
  persistence behavior exists.
- Scope exclusions are aligned with F-01 and avoid premature browser,
  coverage, and CI work.

## Triage

Both findings were accepted and resolved in the plan on 2026-06-10.
