---
project: Allergen Finder
checked_at: 2026-06-09T21:37:22Z
health_status: critical-issues
context_type: brownfield
language_family: js
stack_assessment_available: true
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 0
  moderate: 0
  low: 0
test_runner_detected: false
ci_provider: null
recommended_fixes: 5
---

## Dependency Health

### Lockfile

Status: present (`package-lock.json`)
Package manager: npm

The dependency tree is reproducible through `npm ci`.

### Security Audit

Tool: `npm audit --json`
Summary: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
Direct vs transitive: no findings

### Outdated Dependencies

Packages with major version gaps: 1

- **@types/node**: 22.19.19 → 25.9.2. The repository currently builds on Node 20, so this is informational rather than an upgrade recommendation.

React Router 7.16 has a 7.17 minor release available. React, React DOM, Vite, and several type packages have patch releases available. TypeScript 6 is available, but the current 5.9 line is internally consistent and passes type checking.

## Test Suite

Test runner: not detected
Tests found: unable to enumerate
Test execution: not attempted

The repository has two useful `vite-node` smoke-check scripts, but no test discovery framework, standard `npm test` script, or colocated test files.

⚠ No test runner detected. The agent cannot verify authentication, ownership, persistence, or route mutations through focused automated tests.

Recommended: add a TypeScript-compatible test runner, an `npm test` script, and colocated `*.test.ts` or `*.test.tsx` files. Preserve the existing smoke checks as separate contract verification.

## CI/CD

Provider: not detected
Configuration: not found

| Stage | Status | Notes |
|---|---|---|
| Lint | ✗ | not configured |
| Test | ✗ | no test runner |
| Build | ✗ | local `npm run build` passes |
| Type check | ✗ | local `npm run typecheck` passes |
| Security | ✗ | local `npm audit --json` is clean |

No CI/CD configuration is present. Local verification is sufficient while shaping and planning, but CI should enforce typecheck, tests, build, and security audit before release.

## Configuration

### High severity

- **Test configuration and `npm test`** — missing. The expanded MVP requires automated tests tied to a documented risk, and agents need a repeatable verification command.

### Medium severity

- **ESLint configuration** — missing. Static correctness and React-specific mistakes are not checked beyond TypeScript.
- **Prettier or equivalent formatter configuration** — missing. Formatting is governed only by existing style and agent instructions.

### Low severity

- **`.env.example`** — missing. `README.md` documents `GOOGLE_MAPS_API_KEY`, but future auth and persistence variables need one discoverable template.
- **`.editorconfig`** — missing. Editor-level whitespace behavior is not standardized outside repository instructions.

Present and healthy: strict `tsconfig.json`, `.gitignore`, `AGENTS.md`, Dockerfile, npm lockfile, documented environment variable, passing typecheck, and passing production build.

## Stack Assessment Cross-Reference

Stack assessment: `context/foundation/stack-assessment.md`
Agent readiness: ready-with-compensation

| Quality gap | Health-check finding | Status |
|---|---|---|
| No general-purpose test runner | No `npm test`, runner configuration, or test files | Reinforced |
| Auth and persistence conventions not established | No existing auth/data modules to provide a local pattern | Reinforced; must be established by the first foundation plan |
| Explicit route registration | `AGENTS.md` documents route location and naming | Mitigated |

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Add risk-based test infrastructure

**Impact**: Authentication and CRUD history cannot be safely implemented or reviewed without repeatable ownership and route tests.
**Severity**: high
**Effort**: significant (> 1 hour)
**Fix**:

Create `test-plan.md` with the cross-user access risk as the first entry. Add a test runner, `npm test`, and focused tests that create two users and prove cross-user read, update, and delete attempts fail.

### 2. Add linting

**Impact**: TypeScript does not catch every React, accessibility, or unsafe-code pattern.
**Severity**: medium
**Effort**: moderate (15–30 min)
**Fix**:

Add an ESLint configuration compatible with the current TypeScript and React stack, then expose it through `npm run lint`.

### 3. Add deterministic formatting

**Impact**: Agent edits can produce avoidable formatting churn without one repository-owned formatter.
**Severity**: medium
**Effort**: moderate (15–30 min)
**Fix**:

Add Prettier or an equivalent formatter configuration and expose check/write scripts in `package.json`.

### 4. Add an environment template

**Impact**: Auth and persistence will add required variables that are easy to miss during local setup and deployment.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

Add `.env.example` containing variable names and non-secret placeholders. Keep `README.md` descriptions as the source of setup guidance.

### 5. Add editor defaults

**Impact**: Contributors can produce inconsistent whitespace before formatter enforcement runs.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

Add `.editorconfig` matching the repository's two-space indentation and final-newline conventions.

### Addressed after core local verification (Category B)

### Add continuous integration

Add a workflow that runs install, typecheck, tests, build, and security audit for pull requests and protected branches. This does not block roadmap planning, but it is required before release confidence is equivalent to local verification.

## Summary

Health status: critical-issues

Dependencies are clean, the lockfile is present, strict type checking passes, and the production build succeeds. The critical gap is the absence of a real test runner while the expanded MVP introduces authentication and user-owned CRUD data and explicitly requires tests tied to a test plan. Add test infrastructure as the first roadmap foundation; linting, formatting, environment templating, and CI can follow without changing the product shape.
