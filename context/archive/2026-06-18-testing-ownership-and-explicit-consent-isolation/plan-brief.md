# Test Ownership and Explicit-Consent Isolation - Plan Brief

> Full plan: `context/changes/testing-ownership-and-explicit-consent-isolation/plan.md`
> Research: `context/changes/testing-ownership-and-explicit-consent-isolation/research.md`

## What & Why

This plan adds rollout Phase 2 integration coverage from `context/foundation/test-plan.md`: prove ownership isolation, continued guest access, and explicit-consent persistence. The risk is security and privacy oriented: one user must not gain read or mutation capability over another user's saved check, and public check flows must not create history unless the user explicitly saves.

## Starting Point

Production boundaries are already present: public pollen/location actions have no session guard, while saved-check history and mutations require `sessions.requireUser` and owner-scoped repository methods. Existing tests cover repository predicates and mocked route handlers separately; the gap is route-handler semantics backed by real PostgreSQL state.

## Desired End State

A dedicated DB-backed route-handler integration test file proves User B cannot list, read, update, or delete User A's saved check. The same layer proves guest-dependent current pollen and device-location flows create no saved rows, while explicit authenticated save increments persistence exactly once. The rollout is verified with `npm test`, `npm run typecheck`, and `npm run test:db` against a disposable database.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| DB test placement | New dedicated route-handler DB file | Keeps test intent clear even though it requires a small DB config expansion. | Plan |
| Guest-flow proof layer | Handler/API proof | It is the cheapest layer matching current server architecture and avoids unnecessary browser tooling. | Plan |
| Explicit-consent no-write scope | Current pollen, current-location plus pollen, and explicit save control | Covers every named Phase 2 no-write path plus the positive persistence boundary. | Research / Plan |
| Ownership proof strictness | Full route-handler matrix | Directly satisfies the test plan's read, update, and delete isolation requirement. | Research / Plan |
| Completion gate | `npm test`, `npm run typecheck`, and real `npm run test:db` | Matches repo handoff rules and the lesson about opt-in integration evidence. | Research / Plan |

## Scope

**In scope:**

- Expand DB Vitest discovery for a dedicated route-handler integration file.
- Add real DB two-user route-handler tests for list, detail, update, and delete isolation.
- Add no-write DB count assertions for public pollen and device-location paths.
- Add explicit authenticated save as a positive persistence control.
- Update the test-plan cookbook with the completed Phase 2 pattern.

**Out of scope:**

- Browser, Playwright, or component tests.
- Production authorization or persistence changes unless tests reveal a defect.
- Live Google provider calls.
- CI wiring, coverage thresholds, or Phase 3 expansion-flow risks.

## Architecture / Approach

The plan keeps route handlers as the integration boundary and PostgreSQL as the persistence oracle. Tests inject deterministic sessions and provider stubs, call route handlers in process, and assert both HTTP response semantics and database side effects. `vitest.db.config.ts` is widened so the dedicated route-handler DB file runs under the existing `TEST_DATABASE_URL` gate.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. DB Test Discovery | DB config and route-handler integration file skeleton | New file is not discovered by `npm run test:db` |
| 2. Ownership Isolation Integration | Full User A/User B list/detail/update/delete matrix | Test hides SQL-predicate gaps behind mocked behavior |
| 3. Guest Access And Explicit-Consent Integration | No-write public API checks plus explicit save control | No-write assertions miss device-location or save boundary |
| 4. Verification And Test-Plan Cookbook | Full verification and documented cookbook pattern | DB gate is claimed without a real disposable database |

**Prerequisites:** A disposable PostgreSQL database available through `TEST_DATABASE_URL`.
**Estimated effort:** About 1-2 implementation sessions across 4 focused phases.

## Open Risks & Assumptions

- The dedicated route-handler integration file may duplicate setup from the repository integration suite; extract helpers only if duplication becomes distracting.
- `npm run test:db` cannot be marked complete unless the disposable database is actually available.
- If route-handler integration exposes a production ownership defect, implementation must fix the defect before checking off the corresponding phase.

## Success Criteria (Summary)

- User B receives no saved check data and no mutation capability for User A's `checkId`.
- Public current pollen and device-location completion paths create no `symptom_checks` rows.
- Explicit authenticated save creates exactly one persisted row, and all required verification gates pass.
