# Save And View Private Symptom Checks Implementation Plan

## Overview

Add an explicit save action to the completed current-symptoms flow and private
history list/detail pages. The implementation extends the existing auth and
PostgreSQL foundations while preserving public guest checks and ensuring every
record operation is scoped to the revocation-checked local user.

## Current State Analysis

The current-symptoms route owns all check state in browser React state and
performs no persistence. It derives results from a city suggestion, selected
symptoms, one shared low/high intensity, and normalized pollen activity. The
authentication slice already provides secure session cookies, a stable local
user UUID, `requireUser` for protected operations, a bounded PostgreSQL client,
and explicit migrations.

No symptom-check schema, snapshot validation, save action, history route, or
owner-scoped record repository exists. Authentication return-path validation
currently permits only `/` and `/destination`, and the database integration
configuration includes only the user repository test.

## Desired End State

A completed current-symptoms result exposes a clear Save action only after the
pollen request has settled. A signed-in user can save once and is redirected to
the new private detail page. A guest who presses Save can register or sign in,
return with the completed check restored, and confirm the same final save
without placing symptoms or location in URLs, cookies, logs, or the database
before consent.

`/history` lists the current user's records newest first, and
`/history/:checkId` renders the saved city, completion time, symptoms,
intensities, pollen context, and recomputed non-diagnostic ranking. Missing and
foreign record IDs return the same 404. New checks never read history.

### Key Discoveries:

- Current check state and completion are entirely client-side
  (`app/routes/home.tsx:52`).
- Pollen lookup is the only current network side effect and is a GET
  (`app/routes/home.tsx:79`).
- Protected operations can obtain a revocation-checked local UUID through
  `requireUser` (`app/domain/auth/session.server.ts:189`).
- Authentication return paths currently exclude history
  (`app/domain/auth/return-to.ts:1`).
- Routes require explicit registration (`app/routes.ts:3`).
- The risk plan requires real two-user ownership evidence rather than UI
  filtering or repository mocks (`context/foundation/test-plan.md`).

## What We're NOT Doing

- No update or delete operations; S-03 owns them.
- No per-symptom intensity control in the current-check UI; S-04 owns it.
- No device-location behavior or missing-pollen card label changes.
- No automatic save, background write, anonymous history, or guest record.
- No history-driven ranking personalization.
- No latitude/longitude, password, token, owner email, or generated ranking
  prose stored in symptom-check records.
- No exports, sharing, family accounts, search, filters, or pagination UI.
- No destructive migration or automatic migration on application startup.

## Implementation Approach

Create a versioned symptom-check domain with pure snapshot validation and
ranking reconstruction, plus server-only repository and route-handler modules.
The database stores immutable check context and current symptom entries as
validated JSONB. The current shared intensity is copied to each symptom entry,
and partial pollen maps are canonicalized to a complete map with `unknown`.

The home route gains a POST action. It validates trusted origin, bounded
form-encoded input, snapshot structure, and a client-generated one-use request
ID before deriving owner identity through `requireUser`. The repository inserts
with an owner/request-ID uniqueness constraint so a retry with the same
canonical snapshot returns the same record rather than creating a duplicate.
Reuse of that request ID with different snapshot content returns a conflict.

For guests, pressing Save writes the validated pending snapshot to tab-local
`sessionStorage` with version and expiry, then sends the user to login with
`returnTo=/?save=pending`. The restored page shows an explicit confirmation;
only that POST writes the record. Successful save or cancellation clears the
pending draft.

History loaders call `requireUser`, never root viewer state. Repository list and
detail queries include `owner_id` in SQL. The detail route returns identical
not-found behavior for missing and foreign IDs and recomputes ranking from the
saved snapshot.

## Critical Implementation Details

### State Sequencing

Do not enable Save while pollen status is loading. Write pending browser state
only after Save is pressed, and do not clear it until the final save succeeds
or the user cancels. The successful detail destination clears only a pending
draft whose request ID matches the completed save, then replaces the URL to
remove transient success query state. The final server write must reuse
`hasTrustedRequestOrigin`, validate origin before parsing private data, and
authenticate before calling the repository.

### Privacy And Logging

Do not put symptom IDs, city labels, pollen values, or record owner IDs into
query strings, auth form fields, or application logs. Structured failures may
log an event name, stage, status, and request correlation value, but not the
snapshot payload.

## Phase 1: Versioned Snapshot And Additive Schema

### Overview

Define the durable symptom-check contract and additive database migration
without exposing user-facing save behavior.

### Changes Required:

#### 1. Snapshot types and validation

**Files**: `app/domain/symptom-checks/types.ts`,
`app/domain/symptom-checks/snapshot.ts`,
`app/domain/symptom-checks/snapshot.test.ts`

**Intent**: Create one app-owned, versioned representation for browser handoff,
database persistence, and history rendering.

**Contract**: Define snapshot version 1 with city place ID/label, completed-at
timestamp, unique symptom entries carrying individual intensity, a complete
pollen map, and ranking-contract version. Provide pure functions to build a
snapshot from the current shared-intensity check, parse unknown input with
bounded strings and supported enum values, canonicalize missing pollen entries
to `unknown`, and reconstruct the current ranking. Reject empty or duplicate
symptoms, invalid dates/versions/enums, oversized values, extra owner fields,
and malformed JSON. Direct signed-in saves derive completion time from the
server. Pending guest saves accept only timestamps within the draft lifetime
and a small future clock-skew allowance.

#### 2. Symptom-check schema

**Files**: `app/db/schema.server.ts`, `drizzle/**`

**Intent**: Add the smallest backward-compatible durable record shape.

**Contract**: Add `symptom_checks` with UUID primary key, non-null `owner_id`
foreign key to `users.id`, bounded client request ID, canonical snapshot
fingerprint, snapshot/ranking version, city place ID and label, JSONB symptoms
and pollen activity, completed/created/updated timezone timestamps, an
owner-created-time index, and a unique `(owner_id, client_request_id)`
constraint. Use cascading delete from users only if the database user lifecycle
is later implemented; do not add current account deletion behavior in this
slice. Migration must be additive and compatible with the previous
account-enabled revision.

#### 3. Database integration discovery

**Files**: `vitest.db.config.ts`, `package.json`

**Intent**: Ensure all repository integration tests can run through the existing
explicit `npm run test:db` gate.

**Contract**: Broaden the database Vitest include pattern to named repository
integration tests without including them in default `npm test`. Preserve the
mandatory disposable `TEST_DATABASE_URL` contract.

### Success Criteria:

#### Automated Verification:

- `npm test -- app/domain/symptom-checks/snapshot.test.ts` passes snapshot
  construction, parsing, canonicalization, version, and ranking tests.
- `npm run db:generate` produces an additive committed symptom-check migration.
- `npm run typecheck` passes with the new typed schema and snapshot domain.
- Repository checks confirm the table excludes coordinates, owner email,
  generated result prose, tokens, and session data.

#### Manual Verification:

- Generated SQL contains only the approved table, foreign key, indexes,
  uniqueness constraint, and additive metadata changes.
- Snapshot examples contain no more precise location data than place ID and
  display label.

**Implementation Note**: After automated verification, inspect the generated
migration and sample snapshot before proceeding.

---

## Phase 2: Owner-Scoped Persistence And Isolation

### Overview

Implement idempotent create, private list, and private detail operations behind
a typed repository, then prove ownership with two users in real PostgreSQL.

### Changes Required:

#### 1. Repository contract and mapping

**Files**: `app/domain/symptom-checks/symptom-check-repository.server.ts`,
`app/domain/symptom-checks/types.ts`

**Intent**: Make owner scoping unavoidable at every persistence entry point.

**Contract**: Expose only `createForOwner(ownerId, requestId, snapshot)`,
`listForOwner(ownerId)`, and `findForOwner(ownerId, checkId)`. Every query
includes the trusted owner UUID. Creation uses the owner/request-ID uniqueness
constraint and returns the existing owner record only when a retry carries the
same canonical snapshot fingerprint. The same key with different content
returns a typed conflict. Mapping validates stored JSON and supported versions
before returning domain records. No public `findById`, list-all, or
browser-supplied owner operation may exist.

#### 2. PostgreSQL integration suite

**Files**:
`app/domain/symptom-checks/symptom-check-repository.integration.test.ts`

**Intent**: Prove actual SQL ownership predicates and idempotency.

**Contract**: Apply committed migrations to a disposable database, create user
A and user B, create records for both, and prove lists contain only owner
records; owner detail succeeds; foreign and missing IDs both return null;
repeated request IDs return one stable record; and newer records sort first.
Add concurrent same-content retries and different-content key-reuse coverage.
Clean up test-owned rows and users. Do not call Identity Platform, Firebase, or
Google providers.

#### 3. Production dependency composition

**Files**: `app/domain/symptom-checks/dependencies.server.ts`

**Intent**: Give route handlers one production composition point while keeping
tests able to inject sessions and repositories.

**Contract**: Compose the existing auth session manager and symptom-check
repository without changing S-01 session behavior or constructing browser-side
database dependencies.

### Success Criteria:

#### Automated Verification:

- `npm run test:db` passes real two-user create/list/detail isolation and
  idempotency tests.
- `npm test -- app/domain/symptom-checks/snapshot.test.ts` still passes.
- `npm run typecheck` passes with repository and dependency contracts.
- A source check confirms every record query includes owner identity and no
  repository API accepts owner identity inside untrusted snapshot input.

#### Manual Verification:

- Disposable database inspection shows each record references only its intended
  local user and duplicate request IDs do not create duplicate rows.
- Cross-user and missing identifiers are indistinguishable at the repository
  boundary.
- Reusing one request ID with different snapshot content produces a conflict
  rather than returning an unrelated record.

**Implementation Note**: Do not proceed to routes until real PostgreSQL proves
the owner predicates.

---

## Phase 3: Explicit Save And Guest Authentication Handoff

### Overview

Add the explicit save control, authenticated action, and temporary guest
handoff while preserving the existing live guest check.

### Changes Required:

#### 1. Save route handler

**Files**:
`app/domain/symptom-checks/symptom-check-route-handlers.server.ts`,
`app/domain/symptom-checks/symptom-check-routes.test.ts`,
`app/routes/home.tsx`

**Intent**: Make the home route's POST action the only write entry point for a
new symptom check.

**Contract**: Accept only POST form submissions with trusted origin, bounded
body size, UUID request ID, and versioned snapshot JSON. Validate origin before
body parsing by reusing `hasTrustedRequestOrigin` and the configured
`APP_ORIGIN`; test matching Origin, Referer fallback, missing, null, malformed,
and cross-origin evidence. Then call `requireUser`, validate snapshot, and call
`createForOwner(user.id, requestId, snapshot)` and redirect to
`/history/:checkId?saved=1`. Invalid input returns safe Polish action data and
does not call the repository. Conflict returns a safe Polish response that
requires a fresh request ID. Missing/invalid sessions use the existing
revocation-aware redirect and cookie clearing behavior. No owner ID is accepted.

#### 2. Save UI and explicit-consent copy

**Files**: `app/routes/home.tsx`,
`app/components/symptom-check-save.tsx`

**Intent**: Add a clear user-controlled boundary after a completed result.

**Contract**: Extract the save/handoff behavior into a local component so the
route remains maintainable. Save is available only when city, symptoms,
intensity, and settled pollen state form a valid snapshot. Signed-in users
submit directly. Guests pressing Save create an expiring versioned pending
snapshot in `sessionStorage` and navigate to
`/login?returnTo=%2F%3Fsave%3Dpending`. Update page copy from "never saves" to
"does not save automatically; only explicit Save stores the check." Consume
action/fetcher errors and render actionable Polish feedback without discarding
the completed check.

#### 3. Pending save restoration

**Files**: `app/components/symptom-check-save.tsx`,
`app/domain/symptom-checks/pending-snapshot.ts`,
`app/domain/symptom-checks/pending-snapshot.test.ts`

**Intent**: Preserve the completed check through registration or sign-in
without pre-auth server persistence.

**Contract**: Store only after Save is pressed, with creation time, expiry,
snapshot version, request ID, and snapshot. On `?save=pending`, parse and
restore supported unexpired data, show the saved check summary, and require a
final explicit submit. Clear on success, cancellation, expiry, or invalid data.
On successful redirect, a minimal detail route clears only the matching request
ID and removes `saved` from the URL with `history.replaceState`, so refresh does
not repeat the message. Alternative login/register links must continue
preserving `returnTo`. Browser storage failures show a safe retry message and
never silently save.

#### 4. Authentication return path

**Files**: `app/domain/auth/return-to.ts`,
`app/domain/auth/auth.test.ts`

**Intent**: Permit the exact protected/public page destinations introduced by
this slice without weakening the existing redirect allowlist.

**Contract**: Allow `/history`, valid UUID detail paths, and the exact
`/?save=pending` handoff. Continue rejecting auth, API, mutation-only,
protocol-relative, malformed, and arbitrary paths.

#### 5. Minimal detail destination

**Files**: `app/routes/history.$checkId.tsx`, `app/routes.ts`

**Intent**: Give successful Phase 3 saves a working protected destination and
an executable pending-draft cleanup point.

**Contract**: Register the detail route and implement its protected loader with
owner-scoped lookup, private/no-store headers, and identical invalid, missing,
or foreign 404 behavior. Render a minimal Polish saved-check confirmation and
summary using shared domain values. Include a route-level Polish
`ErrorBoundary`. Phase 4 expands this page into the complete detail experience.

### Success Criteria:

#### Automated Verification:

- `npm test -- app/domain/symptom-checks/symptom-check-routes.test.ts` proves
  method, exact hardened origin cases, body limit, authentication, owner
  derivation, validation, conflict, idempotency handoff, and redirect behavior.
- `npm test -- app/domain/symptom-checks/pending-snapshot.test.ts` passes expiry,
  version, invalid-data, storage-failure, and clear-after-use cases.
- Existing auth tests pass with the narrow history and pending-save return
  paths.
- Full `npm test` and `npm run typecheck` pass.
- The minimal protected detail route, private cache headers, and Polish
  not-found boundary pass focused route tests.
- `npm run test:db` includes an explicit-consent integration scenario proving
  ordinary current-check/pollen requests leave row count unchanged and only the
  explicit authenticated save inserts.

#### Manual Verification:

- Signed-in current-check completion creates no row until Save is pressed, and
  double-click/retry creates one record.
- A guest completes a check, presses Save, registers or signs in, returns with
  the same city/symptoms/intensity/pollen context, confirms, and reaches detail.
- Successful detail navigation clears the matching pending draft and refresh
  does not repeat the saved message.
- Cancelling or allowing the pending save to expire creates no database row.
- Public current-symptoms and destination flows remain complete while signed
  out on mobile and desktop.

**Implementation Note**: Browser storage and authentication redirect behavior
must be exercised before private history UI is added.

---

## Phase 4: Private History List, Detail, And Release Verification

### Overview

Expand the protected detail destination, add the owner-only history list, and
complete functional, privacy, migration, and release verification.

### Changes Required:

#### 1. History route handlers

**Files**:
`app/domain/symptom-checks/symptom-check-route-handlers.server.ts`,
`app/domain/symptom-checks/symptom-check-routes.test.ts`

**Intent**: Centralize protected loader behavior and not-found semantics.

**Contract**: The list loader requires a revocation-aware user and calls
`listForOwner(user.id)`. The detail loader validates UUID syntax, calls
`findForOwner(user.id, checkId)`, and throws the same 404 for invalid, missing,
  or foreign IDs. Database failures propagate. Loader responses contain no
  owner IDs and set private/no-store cache headers. Keep the route-level Polish
  error boundary introduced in Phase 3.

#### 2. History pages

**Files**: `app/routes/history.tsx`,
`app/routes/history.$checkId.tsx`,
`app/components/symptom-check-summary.tsx`

**Intent**: Provide usable Polish list and detail views without duplicating
ranking or label logic.

**Contract**: List newest records with completion time, city, symptom summary,
and top ranked allergen context; show an empty state and link to a new check.
Expand the Phase 3 detail page to render immutable city/completion/pollen
context, saved symptom intensities, recomputed ranked result cards,
non-diagnostic copy, and a link back to history. The successful-save message is
cleared from the URL after first render. Components use domain labels and
ranking helpers rather than persisted prose.

#### 3. Route registration and navigation

**Files**: `app/routes.ts`, `app/components/account-nav.tsx`,
`app/routes/home.tsx`, `app/routes/destination-search.tsx`

**Intent**: Make private history discoverable only as an authenticated
capability while keeping public routes unguarded.

**Contract**: Register `/history` and `/history/:checkId`. Signed-in account
navigation includes a history link on both product pages. Signed-out navigation
continues to show login only. Do not add a global route guard.

#### 4. Production and operational documentation

**Files**: `README.md`, `context/deployment/deploy-plan.md`

**Intent**: Extend the explicit migration and data-protection release contract
for user symptom history.

**Contract**: Document migration ordering, verified Cloud SQL automated backups,
retention, a non-production restore drill and evidence, private-data logging
restrictions, no-traffic verification, rollback compatibility with the
account-enabled revision, and required database/auth smoke checks before
traffic movement. No production migration or traffic change is executed
without human approval.

### Success Criteria:

#### Automated Verification:

- Focused route tests prove signed-out redirects, owner-only list/detail,
  identical foreign/missing 404 behavior, private cache headers, and no owner
  IDs in loader data.
- `npm run test:db` passes the full user and symptom-check repository suites.
- `npm test` passes without live Firebase, PostgreSQL, or Google providers.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm audit --json` completes with advisories fixed or documented.
- Route checks confirm `/`, `/destination`, and public APIs remain unguarded.

#### Manual Verification:

- User A sees only A's records in history and detail; User B cannot open A's
  copied record URL and receives the same not-found page as a random UUID.
- Empty, one-record, and multi-record history states render correctly on mobile
  and desktop with no horizontal overflow.
- Detail reproduces the saved city, symptoms, intensity, unknown pollen states,
  and ranking with Polish non-diagnostic copy.
- Production migration sequencing, Cloud SQL retention, and a non-production
  restore drill are verified before symptom history is treated as durable.
- Runtime logs contain no symptom snapshot, city label, record contents,
  session cookie, token, or owner identifier.

**Implementation Note**: The final production migration, backup verification,
and traffic movement remain human-approved release actions.

---

## Testing Strategy

### Unit Tests:

- Snapshot construction from the current shared-intensity form.
- Complete pollen-map canonicalization with `unknown`.
- Validation of supported IDs, versions, dates, UUIDs, bounds, duplicates, and
  malformed JSON.
- Pending browser snapshot expiry, restoration, cancellation, and cleanup.
- Ranking reconstruction from saved inputs using explicit expected values.

### Integration Tests:

- Direct loader/action tests with fake sessions and repositories for method,
  origin, authentication, owner derivation, response, cache, and 404 contracts.
- Real PostgreSQL tests with two local users and owner-scoped create/list/detail
  predicates.
- Existing auth and current-location tests as regression coverage for return
  paths and public provider routes.
- Default suite remains deterministic and excludes live providers/database.

### Manual Testing Steps:

1. Complete a signed-out current-symptoms check and confirm no record exists.
2. Press Save, register, return to the restored check, and confirm the write.
3. Repeat through sign-in and through the alternate auth link.
4. Cancel and expire pending saves; confirm neither creates a row.
5. Save directly while signed in and confirm retry/double-click is idempotent.
6. Verify history empty, one-record, and multi-record states.
7. Copy a record URL from user A to user B and compare it with a random UUID.
8. Verify unknown pollen remains unknown and detail ranking matches the save.
9. Complete both public guest flows at mobile and desktop widths.
10. Inspect the disposable database, generated migration, and application logs.
11. Verify Cloud SQL retention, a non-production restore drill, and approved
    migration order before production use.

## Performance Considerations

History volume is small, but list queries must be owner-indexed and ordered by
completion time with a bounded initial result count. Detail uses one
owner-and-ID lookup. Ranking is recomputed in process from a small fixed
catalog. Do not introduce provider calls when viewing history.

## Migration Notes

The migration only adds `symptom_checks`, indexes, and constraints. Apply it
through the existing explicit migration job before the history-enabled revision
receives traffic. The previous account-enabled revision ignores the new table,
so application rollback remains compatible. No down migration or destructive
data operation is part of this plan.

## References

- `context/changes/save-and-view-symptom-check/research.md`
- `context/foundation/roadmap.md`
- `context/foundation/prd.md`
- `context/foundation/test-plan.md`
- `context/foundation/infrastructure.md`
- `context/changes/email-password-account-access/plan.md`
- `app/routes/home.tsx`
- `app/domain/allergen-ranking/types.ts`
- `app/domain/auth/session.server.ts`
- `app/domain/auth/return-to.ts`
- `app/db/schema.server.ts`
- `app/domain/auth/user-repository.server.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Versioned Snapshot And Additive Schema

#### Automated

- [x] 1.1 Snapshot construction, validation, canonicalization, and ranking tests pass — df32530
- [x] 1.2 Drizzle generates the additive symptom-check migration — df32530
- [x] 1.3 Typecheck passes with snapshot and schema contracts — df32530
- [x] 1.4 Schema excludes disallowed precise, derived, credential, and session data — df32530

#### Manual

- [x] 1.5 Generated migration contains only approved additive objects — df32530
- [x] 1.6 Snapshot examples contain only minimum location context — df32530

### Phase 2: Owner-Scoped Persistence And Isolation

#### Automated

- [ ] 2.1 Disposable PostgreSQL proves two-user create, list, and detail isolation
- [ ] 2.2 Same-content retries are idempotent and different-content key reuse conflicts
- [ ] 2.3 Snapshot tests remain green through repository mapping
- [ ] 2.4 Typecheck passes with repository and dependency contracts
- [ ] 2.5 Every persistence operation scopes by trusted owner identity

#### Manual

- [ ] 2.6 Database rows reference only their intended local users
- [ ] 2.7 Foreign and missing identifiers are indistinguishable
- [ ] 2.8 Different-content request ID reuse is rejected

### Phase 3: Explicit Save And Guest Authentication Handoff

#### Automated

- [ ] 3.1 Save action tests pass for method, hardened origin, auth, bounds, validation, conflict, ownership, and redirect
- [ ] 3.2 Pending snapshot tests pass for restoration, expiry, failure, cancellation, and cleanup
- [ ] 3.3 Auth return-path tests pass for history and pending-save destinations
- [ ] 3.4 PostgreSQL explicit-consent test proves only Save inserts
- [ ] 3.5 Full tests and typecheck pass after save and handoff UI
- [ ] 3.10 Minimal protected detail route and Polish not-found boundary work

#### Manual

- [ ] 3.6 Signed-in Save is explicit and idempotent
- [ ] 3.7 Guest check survives registration or sign-in and final confirmation
- [ ] 3.8 Cancelled or expired pending saves create no record
- [ ] 3.9 Both guest product flows remain complete on mobile and desktop
- [ ] 3.11 Successful save clears matching pending state and one-time URL status

### Phase 4: Private History List, Detail, And Release Verification

#### Automated

- [ ] 4.1 Route tests prove protected owner-only list and detail behavior
- [ ] 4.2 Foreign, missing, and invalid identifiers share not-found behavior
- [ ] 4.3 Private loader data and cache headers satisfy the privacy contract
- [ ] 4.4 Full PostgreSQL integration suite passes
- [ ] 4.5 Full deterministic test suite passes
- [ ] 4.6 Typecheck passes
- [ ] 4.7 Production build passes
- [ ] 4.8 Dependency audit completes with advisories resolved or documented
- [ ] 4.9 Public routes and APIs remain unguarded

#### Manual

- [ ] 4.10 Two authenticated users cannot view each other's records
- [ ] 4.11 History empty, one-record, and multi-record states render responsively
- [ ] 4.12 Detail reproduces saved inputs, unknown pollen, ranking, and safety copy
- [ ] 4.13 Production migration order, backup retention, and restore drill are verified
- [ ] 4.14 Runtime logs contain no private check, credential, token, or owner data
