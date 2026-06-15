# Risk-Based Test Foundation Implementation Plan

## Overview

Establish the minimum durable automated-test foundation required before authentication and persistence work begins. The change adds a standard Vitest workflow, migrates the two existing smoke scripts into colocated tests, updates repository guidance, and writes a narrow `context/foundation/test-plan.md` that names the highest product risks and the future verification path for each roadmap slice.

## Current State Analysis

The project has strict TypeScript and two useful deterministic verification scripts, but it does not have a test runner, `npm test`, test configuration, or conventional `*.test.ts` files. The scripts run through `vite-node`, use custom assertion helpers, and currently pass, but they also emit a Node deprecation warning and repeated `EMFILE` watcher errors. Authentication and persistence are not implemented yet, so F-01 can define the cross-user authorization test contract but cannot honestly implement that test before S-01 through S-03 create the behavior under test.

## Desired End State

`npm test` runs the complete suite once and exits; `npm run test:watch` supports local iteration. Existing ranking, language, medical-safety, provider-normalization, request-guard, and fallback expectations are preserved as colocated Vitest tests. The bespoke smoke scripts and commands are removed, repository guidance points contributors to the new commands and risk plan, and `context/foundation/test-plan.md` is compatible with the local `10x-test-plan` schema while remaining limited to three rollout phases.

### Key Discoveries:

- The roadmap requires a standard test command, focused runner, and named risk inventory before S-01 through S-06 (`context/foundation/roadmap.md:54`).
- The PRD requires automated tests tied to the documented risk that one user cannot access another user's records (`context/foundation/prd.md:38`).
- The repository explicitly prefers colocated `*.test.ts` or `*.test.tsx` files and an `npm test` script once a runner is introduced (`AGENTS.md:19`).
- Current verification consists only of two `vite-node` scripts (`package.json:5`).
- The allergen script already contains independent expectations for ranking, unknown pollen data, Polish output, environmental framing, and prohibited treatment wording (`app/domain/allergen-ranking/smoke-check.ts:70`).
- The current-location script already covers provider normalization, route input guards, missing configuration fallback, and secret-name non-disclosure (`app/domain/current-location/smoke-check.ts:52`).
- Vitest 4.1.x supports Vite 8, ESM TypeScript, and Node 24; TypeScript tests run without a separate compiler. This was verified against official Vitest documentation and npm package metadata on `2026-06-10`.

## What We're NOT Doing

- No authentication, session, database, repository, or saved-check implementation.
- No fake cross-user authorization test against behavior that does not exist yet.
- No GitHub Actions or other CI workflow.
- No coverage provider, percentage report, or coverage threshold.
- No browser, end-to-end, visual-regression, accessibility, or AI-native test tooling.
- No broad attempt to test every route or component.
- No production-code refactor unless a test exposes an existing defect.
- No live Google API calls from the automated suite.

## Implementation Approach

Use Vitest as the single local test runner because it matches the existing Vite/TypeScript stack and can exercise both pure domain code and resource-route loaders in a Node environment. Convert the existing smoke scenarios into readable suites without changing their business or safety oracles. Then write a schema-compatible but deliberately narrow risk plan: Phase 1 records the executable baseline delivered by this change, Phase 2 is a dedicated ownership-isolation rollout after S-01 through S-03, and Phase 3 is a dedicated cross-slice regression rollout after S-04 through S-06. Product slices still add the cheapest useful tests for behavior they introduce; the dedicated rollout phases audit the combined scenario, fill material gaps, and update the cookbook rather than duplicating already-useful coverage.

## Critical Implementation Details

### Test Isolation

The current-location verification temporarily removes `GOOGLE_MAPS_API_KEY`. The migrated suite must restore the prior environment value even when an assertion fails, and it must avoid shared state that makes test order significant.

### Risk Plan State

`context/foundation/test-plan.md` is both strategy and resumable rollout state. Its section order, Phase table columns, and status vocabulary must follow the local `10x-test-plan` schema. Each rollout row must map to exactly one change folder whose artifacts and canonical `## Progress` block determine the row status. The F-01 baseline row maps to this change and becomes `complete` only after this plan's automated and manual progress items are complete. Later dedicated rollout rows remain `not started` with change folder `—` until `/10x-test-plan` opens them.

## Phase 1: Vitest Foundation & Smoke Migration

### Overview

Introduce the standard runner and migrate all existing automated behavior checks into conventional, focused Vitest suites.

### Changes Required:

#### 1. Test runner configuration and package commands

**Files**: `package.json`, `package-lock.json`, `vitest.config.ts`

**Intent**: Make automated verification predictable for humans, agents, and future CI while retaining a convenient watch workflow.

**Contract**: Add a Vite-8-compatible Vitest 4.1.x development dependency. Configure Node-environment tests, TypeScript path aliases, and conventional colocated `*.test.ts` discovery. Define `npm test` as one-shot `vitest run` and `npm run test:watch` as interactive `vitest`. Remove the direct `vite-node` development dependency and the two `verify:*` scripts after confirming no active executable or configuration consumer requires them. A transitive `vite-node` retained by React Router is acceptable. Do not add coverage configuration.

#### 2. Allergen-ranking test suite

**Files**: `app/domain/allergen-ranking/allergen-ranking.test.ts`, `app/domain/allergen-ranking/smoke-check.ts`

**Intent**: Preserve the accepted domain and safety contracts as independently named tests under the standard runner.

**Contract**: Convert the current smoke scenarios into Vitest cases covering representative high/low ranking outcomes, complete and stable destination output, unknown-pollen behavior, Polish display strings, environmental rather than personal destination framing, and prohibited medication/treatment wording. Expected values must come from the existing product contract, not from reusing production scoring or label calculations inside the assertions. Delete the old smoke script after parity is demonstrated.

#### 3. Current-location test suite

**Files**: `app/domain/current-location/current-location.test.ts`, `app/domain/current-location/smoke-check.ts`

**Intent**: Preserve provider normalization and resource-route fallback checks without network access or bespoke assertion helpers.

**Contract**: Convert the current scenarios into Vitest cases covering pollen index normalization, missing provider indexes, short city-search input, malformed and missing place IDs, missing API-key fallback, unknown pollen output, and absence of configuration names in response bodies. Keep route-loader calls in process, restore environment state after each affected case, and do not call Google. Delete the old smoke script after parity is demonstrated.

#### 4. Repository testing instructions

**File**: `AGENTS.md`

**Intent**: Make the new source-of-truth commands and test conventions discoverable to future contributors and agents.

**Contract**: Replace the “no test runner” guidance with `npm test`, `npm run test:watch`, colocated naming, focused path execution through Vitest, and a pointer to `context/foundation/test-plan.md`. Retain `npm run typecheck` as a required handoff check and the existing release-audit rule.

### Success Criteria:

#### Automated Verification:

- `npm test` runs all migrated tests once and exits successfully.
- `npm test -- app/domain/allergen-ranking/allergen-ranking.test.ts` passes as a focused run.
- `npm test -- app/domain/current-location/current-location.test.ts` passes as a focused run.
- `npm run typecheck` passes with the new test files and configuration included.
- `package.json` has no direct `vite-node` dependency or `verify:allergen-ranking` / `verify:current-location` scripts, and `npm ls vite-node --depth=0` reports no top-level package.
- The deleted smoke files have no active executable or configuration references. Historical references in `context/archive/`, point-in-time foundation assessments, and transitive `package-lock.json` entries are excluded.

#### Manual Verification:

- Review confirms every meaningful assertion from both smoke scripts is represented in a clearly named Vitest case.
- Review confirms tests assert product contracts and failure scenarios rather than copying production calculations.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation that the migrated suites preserve the accepted behavioral contracts before proceeding.

---

## Phase 2: Risk Plan & Foundation Verification

### Overview

Document the prioritized test strategy, future ownership-isolation path, and project-specific testing cookbook, then verify the completed foundation as one coherent handoff.

### Changes Required:

#### 1. Schema-compatible risk-based test plan

**File**: `context/foundation/test-plan.md`

**Intent**: Give every expansion slice a shared risk vocabulary and a cheapest-useful-test rule without creating a second broad delivery roadmap.

**Contract**: Follow the local `10x-test-plan` schema with sections 1 through 8. Keep the risk map to six sourced scenarios:

1. One authenticated user can read, update, or delete another user's saved check.
2. Authentication work makes either existing guest flow require login.
3. Location or symptom history is persisted without an explicit save action.
4. Per-symptom intensity is calculated inconsistently because part of the system still assumes one overall intensity.
5. Missing pollen data is presented as low activity or loses its visible warning.
6. Device-location denial or failure blocks the complete manual-city path.

For each risk, state observable protection, the assumption to challenge, context future research must ground, the likely cheapest test layer, and an anti-pattern to avoid. Cite PRD, roadmap, archived plan, and app-directory churn only as evidence; do not use source files as risk-map anchors.

Define exactly three rollout rows, with one change folder per row:

- **Executable baseline**: the tests delivered by F-01; change folder `context/changes/risk-based-test-foundation/`; status derived from this plan's current `## Progress` block (`planned` or `implementing` while work remains), and `complete` only after every progress item is checked.
- **Ownership and explicit-consent isolation**: a dedicated integration-test rollout with S-01 through S-03 as prerequisites; status `not started`; change folder `—` until `/10x-test-plan` opens one folder for the rollout. It must verify the combined guest-access, explicit-save, and cross-user read/update/delete scenario, reusing useful tests created by the product slices and adding only missing protection.
- **Expansion-slice regressions**: a dedicated focused-regression rollout with S-04 through S-06 as prerequisites; status `not started`; change folder `—` until `/10x-test-plan` opens one folder for the rollout. It must audit the combined intensity, device-location fallback, and missing-data-warning behavior, reusing slice tests and filling only material gaps.

The stack section must record Vitest 4.1.x, Node environment, no browser/e2e layer, no coverage provider, and the `2026-06-10` grounding date. Quality gates remain local: `npm test` and `npm run typecheck` for handoff, plus `npm audit --json` for release handoff; CI is explicitly deferred. Populate cookbook entries for the new unit and route-loader patterns, leave future auth/UI patterns tied to their rollout phases, and state the deliberate negative space chosen in this plan.

#### 2. Final foundation verification

**Files**: `package.json`, `AGENTS.md`, `context/foundation/test-plan.md`

**Intent**: Confirm that the executable commands, contributor instructions, and risk strategy agree before dependent roadmap slices begin.

**Contract**: Run the full suite and typecheck from a clean command invocation. Confirm `AGENTS.md` names only commands that exist, future test-plan rows are `not started` with change folder `—`, and the ownership risk explicitly requires read/update/delete isolation rather than interface-only filtering. Run `npm audit --json` for the dependency handoff and either resolve advisories or document accepted findings. After final human approval checks the remaining manual Progress items, update the baseline rollout row to `complete`; do not claim `complete` while this plan still contains unchecked progress.

### Success Criteria:

#### Automated Verification:

- `npm test` passes from the repository root.
- `npm run typecheck` passes from the repository root.
- `npm audit --json` completes and advisories are fixed or documented.
- `context/foundation/test-plan.md` exists and contains the fixed sections 1 through 8 and exactly three rollout rows with one change folder per row.
- Package scripts referenced by `AGENTS.md` and the test plan exist in `package.json`.

#### Manual Verification:

- Review confirms cross-user read, update, and delete isolation is the top documented future automated risk.
- Review confirms the risk plan stays limited to executable verification and future test guidance, with CI, coverage, browser tooling, and broad suite expansion excluded.
- Review confirms later roadmap slices can identify the expected test layer and cookbook pattern, while the dedicated rollout changes have explicit prerequisites and gap-filling rather than duplicate-coverage responsibilities.

**Implementation Note**: After automated verification passes, pause for final human approval of the risk ordering and scope boundaries before marking the foundation ready for dependent slices.

---

## Testing Strategy

### Unit Tests:

- Use colocated `*.test.ts` files and Vitest's imported `describe`, `test`, and `expect` APIs.
- Preserve independent product oracles for ranking thresholds, labels, missing-data semantics, and medical-safety wording.
- Prefer focused deterministic cases over snapshots or coverage-driven assertions.

### Integration Tests:

- Treat direct resource-route loader execution as a lightweight integration test when it crosses request parsing, route guards, and response serialization.
- Mock or bypass only the external provider boundary; no automated test in F-01 should call Google.
- Add real ownership integration tests only after auth and persistence entry points exist.

### Manual Testing Steps:

1. Run `npm test` and confirm it exits without entering watch mode.
2. Run each focused test path and confirm only the selected suite executes.
3. Review migrated tests against both deleted smoke scripts for behavioral parity.
4. Review `context/foundation/test-plan.md` risk order and rollout statuses.
5. Confirm `AGENTS.md` points contributors to the correct commands and plan.

## Performance Considerations

The default suite should remain fast and deterministic by using the Node environment, in-process loader calls, and no live network. Do not add browser startup, coverage instrumentation, retries, or broad concurrency tuning in this foundation. A focused path command must remain available for rapid work on one domain area.

## Migration Notes

There is no data migration. The verification interface changes from two `verify:*` commands to one standard `npm test` command plus focused path arguments. Remove the direct `vite-node` dependency only after active executable and configuration references confirm it has no direct consumer; React Router's transitive lockfile entry and historical context references do not block removal. Future PRs and plans should use the new command contract, while dated health and stack assessments remain point-in-time records until explicitly refreshed.

## References

- Roadmap F-01 and scope boundary: `context/foundation/roadmap.md:54`
- PRD automated authorization criterion: `context/foundation/prd.md:38`
- PRD guest and privacy guardrails: `context/foundation/prd.md:51`
- Current package commands: `package.json:5`
- Repository testing convention: `AGENTS.md:19`
- Existing ranking checks: `app/domain/allergen-ranking/smoke-check.ts:70`
- Existing route/provider checks: `app/domain/current-location/smoke-check.ts:52`
- Prior decision to defer a full runner: `context/archive/2026-06-03-allergen-ranking-contract/plan.md:175`
- Local test-plan schema: `/Users/bartosz/.agents/skills/10x-test-plan/references/test-plan-schema.md`
- Official Vitest guide: `https://vitest.dev/guide/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest Foundation & Smoke Migration

#### Automated

- [x] 1.1 `npm test` runs all migrated tests once and exits successfully — c9d7d7d
- [x] 1.2 Focused allergen-ranking test run passes — c9d7d7d
- [x] 1.3 Focused current-location test run passes — c9d7d7d
- [x] 1.4 `npm run typecheck` passes with test files and configuration — c9d7d7d
- [x] 1.5 Obsolete smoke commands/files and the direct `vite-node` dependency are absent — c9d7d7d

#### Manual

- [x] 1.6 Migrated Vitest cases preserve all meaningful smoke assertions — c9d7d7d
- [x] 1.7 Tests assert product contracts rather than production calculations — c9d7d7d

### Phase 2: Risk Plan & Foundation Verification

#### Automated

- [x] 2.1 Full `npm test` passes from the repository root — 061a60a
- [x] 2.2 Full `npm run typecheck` passes from the repository root — 061a60a
- [x] 2.3 `npm audit --json` completes with advisories fixed or documented — 061a60a
- [x] 2.4 Test plan contains sections 1 through 8 and exactly three single-folder rollout rows — 061a60a
- [x] 2.5 Documented package commands exist in `package.json` — 061a60a

#### Manual

- [x] 2.6 Cross-user read, update, and delete isolation is the top future automated risk — 061a60a
- [x] 2.7 Test-plan scope excludes CI, coverage, browser tooling, and broad suite expansion — 061a60a
- [x] 2.8 Later slices and dedicated rollout changes have an unambiguous test-layer and cookbook handoff — 061a60a
