# Risk-Based Test Foundation — Plan Brief

> Full plan: `context/changes/risk-based-test-foundation/plan.md`

## What & Why

Establish the minimum automated-test foundation required before authentication and persistence are introduced. The project needs one deterministic test command and a documented risk strategy, especially for the future requirement that users cannot access each other's saved symptom checks.

## Starting Point

The app has two useful `vite-node` smoke scripts but no test runner, `npm test`, conventional test files, coverage policy, CI gate, or test strategy. The scripts pass but emit Node deprecation and repeated file-watcher warnings.

## Desired End State

Vitest runs all tests once through `npm test` and supports local watch mode through `npm run test:watch`. Existing smoke behavior is preserved in colocated tests, and `context/foundation/test-plan.md` gives later slices a risk-ranked, schema-compatible verification roadmap without expanding F-01 into a full QA program.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Test runner | Vitest 4.1.x in Node mode | It matches Vite 8, ESM TypeScript, and the current non-browser checks. | Research / Plan |
| Existing checks | Convert both smoke scripts | One runner and one assertion style are easier to maintain than parallel verification systems. | Plan |
| Default command | `npm test` uses `vitest run` | Agents and handoff checks need a command that exits deterministically. | Plan |
| Local iteration | Add `npm run test:watch` | Keeps interactive development available without weakening the default contract. | Plan |
| Coverage | No provider or threshold | Named risk scenarios provide better signal than an early percentage target. | Plan |
| Automation boundary | Local commands only | CI work would exceed F-01's roadmap scope and fixed delivery window. | Roadmap / Plan |
| Risk-plan format | Three single-folder `10x-test-plan` rollout rows | Preserves resumable orchestrator state without treating several roadmap changes as one folder. | Plan |
| Security risk | Cross-user CRUD isolation is first | The PRD explicitly requires automated proof that ownership is enforced. | PRD |

## Scope

**In scope:**

- Vitest dependency, configuration, lockfile, and package scripts.
- Migration of allergen-ranking and current-location smoke checks.
- Removal of obsolete smoke files, commands, and the direct `vite-node` dependency.
- Updated `AGENTS.md` testing guidance.
- A six-risk, three-phase `context/foundation/test-plan.md`.
- Final test, typecheck, and dependency-audit verification.

**Out of scope:**

- Auth, persistence, sessions, and saved-check code.
- Fake authorization tests before those boundaries exist.
- CI workflows, coverage metrics, browser/e2e, accessibility, visual, or AI-native tooling.
- Broad route/component coverage or production refactors.

## Architecture / Approach

Vitest runs colocated Node tests against pure domain functions and resource-route loaders. External Google calls stay outside the suite. The foundation test plan records scenarios and cheapest useful layers in three single-folder rollout phases: the current baseline, a dedicated ownership/consent integration rollout after S-01 through S-03, and a dedicated regression rollout after S-04 through S-06. Product slices still add focused tests as they introduce behavior; the later rollout changes reuse that coverage and fill only material gaps.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Vitest Foundation & Smoke Migration | Standard commands and converted baseline suites | Behavioral assertions are lost or replaced with implementation mirrors. |
| 2. Risk Plan & Foundation Verification | Risk map, cookbook, and verified handoff | The artifact expands into an aspirational QA program or claims tests for nonexistent auth behavior. |

**Prerequisites:** Existing smoke checks remain green before migration.

**Estimated effort:** About 1–2 focused implementation sessions across two phases.

## Open Risks & Assumptions

- Vitest 4.1.x compatibility was verified for Vite 8 and Node 24 on `2026-06-10`; package installation still updates the lockfile and must be audited.
- Resource-route tests depend on generated React Router types continuing to compile under `npm run typecheck`.
- The ownership test contract cannot be implemented until S-01 through S-03 define auth, persistence, and owner-scoped operations.

## Success Criteria (Summary)

- `npm test`, both focused path runs, and `npm run typecheck` pass without live network access; `npm audit --json` is retained as the release-handoff gate.
- Existing smoke contracts remain represented as clear, independent Vitest cases.
- The test plan names cross-user CRUD isolation as the top future risk and keeps CI, coverage, and browser tooling outside F-01.
