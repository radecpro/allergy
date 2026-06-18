# Test Ownership and Explicit-Consent Isolation Implementation Plan

## Overview

This plan adds the Phase 2 integration coverage promised by `context/foundation/test-plan.md`: ownership isolation for saved symptom checks, continued guest access for public check flows, and proof that server-side persistence happens only after explicit authenticated save. The implementation uses deterministic in-process Vitest integration tests with a disposable PostgreSQL database, no live providers, and no browser tooling.

## Current State Analysis

The production boundaries are already in place. Public current-symptoms and destination flows use public resource actions for pollen and device-location lookup, while saved-check history and mutations require a server-derived local user. Existing tests cover repository predicates and mocked route-handler semantics separately, but the material gap is the combined path: route handlers backed by the real PostgreSQL repository for two different users.

`npm run test:db` currently discovers only files matching `app/**/*-repository.integration.test.ts`, so a dedicated route-handler integration test file requires a small Vitest DB config expansion.

## Desired End State

The DB integration suite includes a dedicated route-handler integration file that proves User B cannot list, read, update, or delete User A's saved check through protected route handlers backed by real database state. The suite also proves public guest-dependent API requests complete without creating symptom-history rows, while explicit authenticated save increments persisted records by exactly one.

Verification is complete only when `npm test`, `npm run typecheck`, and `npm run test:db` pass, with `npm run test:db` executed against a documented disposable `TEST_DATABASE_URL`.

### Key Discoveries:

- `context/foundation/test-plan.md:43` requires integration proof for User B receiving no record or mutation capability across read, update, and delete.
- `vitest.db.config.ts:10` currently includes only `app/**/*-repository.integration.test.ts`, which excludes a dedicated route-handler integration test file.
- `app/domain/symptom-checks/symptom-check-repository.integration.test.ts:24` already owns the disposable PostgreSQL connection, migration, user fixture, cleanup, and explicit-save count pattern.
- `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:222` exposes protected detail loader behavior as an injectable route handler.
- `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:271` exposes protected update/delete behavior as an injectable route handler.
- `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:391` exposes protected list behavior as an injectable route handler.
- `app/routes/api.current-pollen.ts:18` and `app/routes/api.current-location.ts:19` expose public, dependency-injectable actions that can be called without live providers.
- `context/foundation/lessons.md` requires opt-in integration gates to be run against the documented disposable environment or explicitly recorded as unverified.

## What We're NOT Doing

- Not adding browser, Playwright, or component tests for this rollout.
- Not changing production authorization, persistence, or route behavior unless a test exposes an actual defect.
- Not making live Google API calls.
- Not adding coverage thresholds or CI wiring.
- Not proving future Phase 3 risks around mixed-intensity expansion, missing-data warnings, or geolocation fallback UX.

## Implementation Approach

Add a dedicated route-handler DB integration suite and widen the DB Vitest include pattern to discover it. The new suite should reuse the existing repository factory, schema, migration, `Pool`, and deterministic provider stubs, but keep tests focused on route-level response semantics plus real persistence effects. The existing repository integration suite can stay intact; only duplicated helper setup should be extracted if it materially reduces repeated DB boilerplate without obscuring test readability.

## Critical Implementation Details

### Debug & observability

`npm run test:db` must run with `TEST_DATABASE_URL` pointed at a disposable PostgreSQL database. If that environment is not available during implementation, leave the Progress item unchecked and record the gate as unverified rather than implying DB evidence exists.

## Phase 1: DB Test Discovery

### Overview

Make room for a dedicated route-handler DB integration file without removing the existing repository integration coverage.

### Changes Required:

#### 1. DB Vitest Configuration

**File**: `vitest.db.config.ts`

**Intent**: Expand DB integration discovery so route-handler DB integration tests can live in a file named for their behavior instead of being forced into the repository test file.

**Contract**: The `test.include` array must include both the existing repository integration pattern and a dedicated route-handler integration pattern under `app/`. Keep `environment: "node"` and `fileParallelism: false`.

#### 2. DB Integration File Skeleton

**File**: `app/domain/symptom-checks/symptom-check-route-handlers.integration.test.ts`

**Intent**: Add a dedicated DB-backed route-handler test file with the same disposable database assumptions as the existing repository integration suite.

**Contract**: The file must fail fast when `TEST_DATABASE_URL` is absent, run Drizzle migrations before tests, create two local users, clean up symptom checks and users owned by the fixtures, and close the PostgreSQL pool after the suite.

### Success Criteria:

#### Automated Verification:

- Focused DB test discovery runs the new file: `TEST_DATABASE_URL=<disposable-db> npm run test:db -- app/domain/symptom-checks/symptom-check-route-handlers.integration.test.ts`
- Existing repository DB integration file remains discoverable: `TEST_DATABASE_URL=<disposable-db> npm run test:db -- app/domain/symptom-checks/symptom-check-repository.integration.test.ts`
- Type checking passes: `npm run typecheck`

#### Manual Verification:

- The new integration file name and DB config pattern make the test layer's intent clear to future maintainers.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Ownership Isolation Integration

### Overview

Prove the core authorization risk with route handlers backed by real PostgreSQL persistence: User B cannot list, read, update, or delete User A's saved check.

### Changes Required:

#### 1. Route-Handler Ownership Matrix

**File**: `app/domain/symptom-checks/symptom-check-route-handlers.integration.test.ts`

**Intent**: Add an integration test where User A creates a saved symptom check in the real repository, then User B attempts every protected capability through route handlers using the same real repository.

**Contract**: The test must call `createSymptomCheckListLoader`, `createSymptomCheckDetailLoader`, and `createSymptomCheckDetailAction` with injected sessions returning User B and the real repository. User B's list response must not contain User A's record. User B's detail, update, and delete attempts against User A's `checkId` must produce the same private 404 semantics used for missing records.

#### 2. Owner Row Integrity Assertions

**File**: `app/domain/symptom-checks/symptom-check-route-handlers.integration.test.ts`

**Intent**: Ensure failed foreign update/delete attempts are not merely hidden responses but also leave User A's persisted row unchanged.

**Contract**: Capture User A's persisted row before User B mutation attempts and compare it after the attempts. The assertions must prove the row still exists, still belongs to User A, and still has the original symptom entries after User B attempts update and delete.

### Success Criteria:

#### Automated Verification:

- Route-handler ownership integration passes: `TEST_DATABASE_URL=<disposable-db> npm run test:db -- app/domain/symptom-checks/symptom-check-route-handlers.integration.test.ts`
- Full DB suite passes: `TEST_DATABASE_URL=<disposable-db> npm run test:db`
- Fast suite passes: `npm test`
- Type checking passes: `npm run typecheck`

#### Manual Verification:

- The test names clearly map to risk #1 in `context/foundation/test-plan.md`.
- Foreign and missing record behavior remains indistinguishable in assertions.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Guest Access And Explicit-Consent Integration

### Overview

Prove the public completion paths stay public and side-effect free, and keep an explicit authenticated save as the positive persistence control.

### Changes Required:

#### 1. Public API No-Write Assertions

**File**: `app/domain/symptom-checks/symptom-check-route-handlers.integration.test.ts`

**Intent**: Add DB count assertions around public current-pollen and current-location API actions to prove guest completion paths do not create symptom-check rows.

**Contract**: Use `createCurrentPollenAction` with stubbed geocoding and pollen lookup for the current-symptoms/destination completion path. Use `createCurrentLocationAction` with a stubbed city resolver, then call `createCurrentPollenAction` for the selected city. Count `symptom_checks` before and after each path and assert no increase.

#### 2. Explicit Save Positive Control

**File**: `app/domain/symptom-checks/symptom-check-route-handlers.integration.test.ts`

**Intent**: Keep the contrast between non-save completion and explicit persistence inside the same DB-backed route-handler suite.

**Contract**: Use `createSaveSymptomCheckAction` with an injected authenticated session, real repository, trusted origin validation, and deterministic `now`. Submit a valid `application/x-www-form-urlencoded` direct save request. Assert the response redirects to history and the owner's `symptom_checks` count increases by exactly one.

#### 3. Repository Suite De-Duplication

**File**: `app/domain/symptom-checks/symptom-check-repository.integration.test.ts`

**Intent**: Avoid redundant explicit-save/no-write coverage once the route-handler integration file owns the Phase 2 scenario.

**Contract**: If the existing "inserts only after the explicit authenticated save action" test becomes duplicated by the new route-handler suite, either narrow it to repository-specific value or move the scenario into the new file. Do not reduce coverage for repository idempotency, ownership predicates, migration reset, or snapshot round-tripping.

### Success Criteria:

#### Automated Verification:

- Guest/no-write integration passes: `TEST_DATABASE_URL=<disposable-db> npm run test:db -- app/domain/symptom-checks/symptom-check-route-handlers.integration.test.ts`
- Full DB suite passes: `TEST_DATABASE_URL=<disposable-db> npm run test:db`
- Fast suite passes: `npm test`
- Type checking passes: `npm run typecheck`

#### Manual Verification:

- The new tests cover current pollen lookup, device-location lookup followed by pollen lookup, and explicit authenticated save.
- No test uses live provider calls or browser session storage.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Verification And Test-Plan Cookbook

### Overview

Finish the rollout by documenting the Phase 2 testing pattern and running the full required verification set.

### Changes Required:

#### 1. Test Plan Cookbook Update

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the Phase 2 TBD cookbook note with the concrete pattern established by this rollout.

**Contract**: Update section `6.3 Adding an ownership or explicit-save test` to reference the dedicated route-handler DB integration pattern, two-user fixtures, public API no-write count assertions, explicit save positive control, and the requirement to run `npm run test:db` against a disposable `TEST_DATABASE_URL`.

#### 2. Verification Evidence

**File**: `context/changes/testing-ownership-and-explicit-consent-isolation/plan.md`

**Intent**: Use the Progress section as the source of execution state during implementation.

**Contract**: Only `/10x-implement` or `/10x-tdd` should mark Progress items complete. Do not mark the DB verification complete unless it was actually run against a disposable `TEST_DATABASE_URL`.

### Success Criteria:

#### Automated Verification:

- Complete fast suite passes: `npm test`
- Type checking passes: `npm run typecheck`
- Full disposable DB suite passes: `TEST_DATABASE_URL=<disposable-db> npm run test:db`

#### Manual Verification:

- `context/foundation/test-plan.md` section 6.3 accurately describes the new ownership and explicit-save integration pattern.
- Any inability to run `npm run test:db` is explicitly recorded as unverified rather than checked off.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before marking the rollout complete.

---

## Testing Strategy

### Unit Tests:

- No new unit tests are required unless implementation exposes a pure helper that needs independent coverage.
- Existing `npm test` remains required to catch regressions in route tests, auth tests, ranking tests, and provider-boundary tests.

### Integration Tests:

- Add `app/domain/symptom-checks/symptom-check-route-handlers.integration.test.ts` for DB-backed route-handler coverage.
- Use two real local user fixtures and the real symptom-check repository.
- Assert response semantics and persisted row state for foreign list/detail/update/delete attempts.
- Assert public API no-write behavior with deterministic provider stubs.
- Assert explicit authenticated save increments persisted rows by exactly one.

### Manual Testing Steps:

1. Review the new route-handler integration test names and confirm they map directly to risks #1, #2, and #3 in `context/foundation/test-plan.md`.
2. Confirm no live provider calls, browser storage, or UI rendering were introduced for this rollout.
3. Confirm `npm run test:db` evidence came from a disposable PostgreSQL database.

## Performance Considerations

The DB suite already runs serially with `fileParallelism: false`, so the added integration cases should avoid unnecessary per-test migrations or pool creation. Prefer one suite-level database setup with fixture cleanup, matching the existing repository integration pattern.

## Migration Notes

No production schema migration is expected. Tests should run existing Drizzle migrations against the disposable test database before executing.

## References

- Related research: `context/changes/testing-ownership-and-explicit-consent-isolation/research.md`
- Test rollout source: `context/foundation/test-plan.md:58`
- DB config include pattern: `vitest.db.config.ts:10`
- Existing DB fixture pattern: `app/domain/symptom-checks/symptom-check-repository.integration.test.ts:24`
- Protected saved-check route handlers: `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:222`
- Public pollen action: `app/routes/api.current-pollen.ts:18`
- Public current-location action: `app/routes/api.current-location.ts:19`
- Opt-in DB verification lesson: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DB Test Discovery

#### Automated

- [x] 1.1 Focused DB test discovery runs the new file
- [x] 1.2 Existing repository DB integration file remains discoverable
- [x] 1.3 Type checking passes

#### Manual

- [ ] 1.4 The new integration file name and DB config pattern make the test layer's intent clear to future maintainers

### Phase 2: Ownership Isolation Integration

#### Automated

- [ ] 2.1 Route-handler ownership integration passes
- [ ] 2.2 Full DB suite passes
- [ ] 2.3 Fast suite passes
- [ ] 2.4 Type checking passes

#### Manual

- [ ] 2.5 The test names clearly map to risk #1 in context/foundation/test-plan.md
- [ ] 2.6 Foreign and missing record behavior remains indistinguishable in assertions

### Phase 3: Guest Access And Explicit-Consent Integration

#### Automated

- [ ] 3.1 Guest/no-write integration passes
- [ ] 3.2 Full DB suite passes
- [ ] 3.3 Fast suite passes
- [ ] 3.4 Type checking passes

#### Manual

- [ ] 3.5 The new tests cover current pollen lookup, device-location lookup followed by pollen lookup, and explicit authenticated save
- [ ] 3.6 No test uses live provider calls or browser session storage

### Phase 4: Verification And Test-Plan Cookbook

#### Automated

- [ ] 4.1 Complete fast suite passes
- [ ] 4.2 Type checking passes
- [ ] 4.3 Full disposable DB suite passes

#### Manual

- [ ] 4.4 context/foundation/test-plan.md section 6.3 accurately describes the new ownership and explicit-save integration pattern
- [ ] 4.5 Any inability to run npm run test:db is explicitly recorded as unverified rather than checked off
