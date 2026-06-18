---
date: 2026-06-18T21:46:56+02:00
researcher: Codex
git_commit: 1c1d85e5423f2bf1fc9a2651dd6384cc339a7ad7
branch: develop
repository: allergy
topic: "Ownership and explicit-consent isolation integration tests"
tags: [research, codebase, auth, symptom-checks, persistence, integration-tests]
status: complete
last_updated: 2026-06-18
last_updated_by: Codex
---

# Research: Ownership and explicit-consent isolation integration tests

**Date**: 2026-06-18T21:46:56+02:00
**Researcher**: Codex
**Git Commit**: 1c1d85e5423f2bf1fc9a2651dd6384cc339a7ad7
**Branch**: develop
**Repository**: allergy

## Research Question

Ground rollout Phase 2 of `context/foundation/test-plan.md`: integration tests
for ownership isolation, signed-out guest access, and explicit-consent
persistence. Risks covered are #1, #2, and #3.

## Summary

The app already has the right production boundaries for this rollout. Current
symptoms (`/`) and destination (`/destination`) are public user flows, with
optional root auth and public resource actions for city search, current pollen,
and current-location lookup. Saved history and saved-check mutations are the
protected surfaces.

Ownership is enforced below the UI. Route handlers derive the local user from
`sessions.requireUser(request)`, pass `user.id` to repository methods, and the
repository scopes list, detail, update, and delete queries by `ownerId`.
Existing tests prove this at either mocked route-handler level or repository
level. The useful Phase 2 gap is a real DB integration path that exercises route
handler response semantics plus real persistence for two users.

Explicit save is also already a clear boundary. Completing checks, destination
lookup, pollen lookup, and device-location lookup do not call the symptom-check
repository. The only symptom-history insert is the explicit save action. The
Phase 2 plan should add no-write count assertions for current-symptoms,
destination, and device-location lookup, with a positive authenticated save
control.

## Detailed Findings

### Route And Auth Boundaries

- Route registration makes `/` the current-symptoms route and `/destination`
  the destination route. History is separate at `/history` and
  `/history/:checkId` (`app/routes.ts:3`).
- The root loader uses `sessions.getOptionalUser(request)` and returns
  `{ viewer: null }` for guests instead of redirecting (`app/root.tsx:35`).
  Existing auth route tests assert guest viewer state for both `/` and
  `/destination` (`app/domain/auth/auth-routes.test.ts:351`).
- The home route has no loader guard. Its only server export is the explicit
  save action, wired to `createSaveSymptomCheckAction` (`app/routes/home.tsx:49`).
- The destination route has no loader or action. It is a client-side flow that
  calls `/api/current-pollen` after city selection (`app/routes/destination-search.tsx:85`,
  `app/routes/destination-search.tsx:110`).
- Public dependent APIs validate method/body input but do not call auth/session
  guards: city search (`app/routes/api.city-search.ts:12`), current-location
  (`app/routes/api.current-location.ts:19`), and current pollen
  (`app/routes/api.current-pollen.ts:18`).
- Authenticated identity comes from the session cookie, Firebase verification,
  and local user lookup by provider UID (`app/domain/auth/session.server.ts:112`).
  Protected flows call `requireUser`, which redirects signed-out users to login
  with a normalized return path (`app/domain/auth/session.server.ts:189`).

### Saved-Check Persistence And Ownership

- The save action validates origin, requires an authenticated user, parses a
  submitted snapshot, then calls `repository.createForOwner(user.id, requestId,
  snapshot, fingerprint)` (`app/domain/symptom-checks/symptom-check-route-handlers.server.ts:129`,
  `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:146`,
  `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:197`).
- The repository insert writes `ownerId`, and idempotency is scoped by
  `(ownerId, clientRequestId)` rather than globally by request ID
  (`app/domain/symptom-checks/symptom-check-repository.server.ts:72`,
  `app/domain/symptom-checks/symptom-check-repository.server.ts:86`,
  `app/db/schema.server.ts:60`).
- List, detail, update, and delete route handlers all require a user before
  persistence work (`app/domain/symptom-checks/symptom-check-route-handlers.server.ts:222`,
  `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:271`,
  `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:391`).
- Repository methods scope every user-facing saved-check operation by owner:
  `listForOwner` filters `ownerId`, `findForOwner` filters `ownerId` plus
  `id`, `updateForOwner` filters `ownerId` plus `id`, and `deleteForOwner`
  filters `ownerId` plus `id`
  (`app/domain/symptom-checks/symptom-check-repository.server.ts:120`,
  `app/domain/symptom-checks/symptom-check-repository.server.ts:134`,
  `app/domain/symptom-checks/symptom-check-repository.server.ts:149`,
  `app/domain/symptom-checks/symptom-check-repository.server.ts:167`).
- Foreign or missing detail, update, and delete targets produce the same private
  404 route semantics (`app/domain/symptom-checks/symptom-check-route-handlers.server.ts:114`,
  `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:235`,
  `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:351`,
  `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:374`).

### Explicit-Save Boundary

- Home route completion is local React state plus `/api/current-pollen`.
  Snapshot creation is local in `useMemo` and does not write to the database
  (`app/routes/home.tsx:90`, `app/routes/home.tsx:120`).
- The save component only submits to persistence when the user clicks save.
  Signed-in users submit directly; signed-out users store a pending snapshot in
  `sessionStorage` and navigate to login (`app/components/symptom-check-save.tsx:79`,
  `app/components/symptom-check-save.tsx:84`,
  `app/components/symptom-check-save.tsx:92`).
- After login, a pending save still requires an explicit confirmation click
  before `fetcher.submit` sends the persistence POST
  (`app/components/symptom-check-save.tsx:126`,
  `app/components/symptom-check-save.tsx:147`).
- Pending snapshots use browser storage under
  `allergen-finder:pending-symptom-check:v2`; they are not server records
  (`app/domain/symptom-checks/pending-snapshot.ts:4`,
  `app/domain/symptom-checks/pending-snapshot.ts:33`).
- Device-location lookup posts coordinates to `/api/current-location`, receives
  an app-owned city suggestion, and reuses the city selection path
  (`app/components/current-location-control.tsx:76`,
  `app/components/current-location-control.tsx:81`,
  `app/routes/api.current-location.ts:27`,
  `app/routes/api.current-location.ts:40`).
- `/api/current-pollen` geocodes and returns pollen activity. It has no
  persistence dependency (`app/routes/api.current-pollen.ts:38`,
  `app/routes/api.current-pollen.ts:47`).

### Existing Test Coverage And Gaps

- `npm test` runs colocated unit/route tests and excludes integration files
  (`vitest.config.ts:10`). `npm run test:db` gates repository integration tests
  behind `TEST_DATABASE_URL` (`package.json:13`, `vitest.db.config.ts:10`).
- The DB integration suite already creates a real PostgreSQL pool, runs
  migrations, inserts two users, and cleans them up
  (`app/domain/symptom-checks/symptom-check-repository.integration.test.ts:24`,
  `app/domain/symptom-checks/symptom-check-repository.integration.test.ts:32`,
  `app/domain/symptom-checks/symptom-check-repository.integration.test.ts:103`,
  `app/domain/symptom-checks/symptom-check-repository.integration.test.ts:106`,
  `app/domain/symptom-checks/symptom-check-repository.integration.test.ts:125`).
- Existing DB tests prove repository-level create/list/detail scoping
  (`app/domain/symptom-checks/symptom-check-repository.integration.test.ts:137`),
  foreign update/delete null results with unchanged owner rows
  (`app/domain/symptom-checks/symptom-check-repository.integration.test.ts:269`),
  owner-only delete (`app/domain/symptom-checks/symptom-check-repository.integration.test.ts:310`),
  and no row insert until explicit authenticated save
  (`app/domain/symptom-checks/symptom-check-repository.integration.test.ts:416`).
- Existing route tests prove route-handler semantics with mocked repositories:
  save uses authenticated owner (`app/domain/symptom-checks/symptom-check-routes.test.ts:113`),
  signed-out save redirects before repository work
  (`app/domain/symptom-checks/symptom-check-routes.test.ts:169`),
  update/delete use authenticated owner
  (`app/domain/symptom-checks/symptom-check-routes.test.ts:463`,
  `app/domain/symptom-checks/symptom-check-routes.test.ts:500`), and
  missing/foreign mutation targets produce private 404
  (`app/domain/symptom-checks/symptom-check-routes.test.ts:519`).
- The main gap is not another repository-only predicate test. The gap is a
  route-handler plus real repository integration test that proves User B gets
  no list/detail/update/delete capability over User A's `checkId`, with User
  A's row still intact after attempted update and delete.

## Code References

- `app/root.tsx:35` - Root loader uses optional auth and returns guest viewer
  state.
- `app/routes/home.tsx:49` - Current-symptoms save action is the route's only
  persistence entry point.
- `app/routes/destination-search.tsx:85` - Destination route is a public client
  flow with no server loader/action.
- `app/routes/api.current-location.ts:19` - Device-location resource action is
  public and dependency-injectable.
- `app/routes/api.current-pollen.ts:18` - Pollen lookup resource action is
  public and has no repository dependency.
- `app/components/symptom-check-save.tsx:79` - Explicit save button branches
  direct save versus pending auth handoff.
- `app/domain/auth/session.server.ts:189` - `requireUser` is the protected route
  identity boundary.
- `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:197` -
  Save action writes by authenticated owner.
- `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:345` -
  Update action calls `updateForOwner`.
- `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:369` -
  Delete action calls `deleteForOwner`.
- `app/domain/symptom-checks/symptom-check-repository.server.ts:120` -
  List query filters by owner.
- `app/domain/symptom-checks/symptom-check-repository.server.ts:134` -
  Detail query filters by owner and record ID.
- `app/domain/symptom-checks/symptom-check-repository.server.ts:149` -
  Update query filters by owner and record ID.
- `app/domain/symptom-checks/symptom-check-repository.server.ts:167` -
  Delete query filters by owner and record ID.
- `app/domain/symptom-checks/symptom-check-repository.integration.test.ts:416`
  - Existing no-write/explicit-save DB-count pattern.

## Architecture Insights

The app has a useful separation for Phase 2 tests:

- Route modules are thin wiring surfaces.
- Auth/session identity is injectable through route-handler dependencies.
- Symptom-check route handlers own response semantics and user-derived owner
  propagation.
- The repository owns SQL predicates and idempotency.
- Current-location and pollen APIs are public provider-boundary routes with no
  persistence dependency.

The cheapest meaningful Phase 2 tests should reuse this separation. Keep fast
route tests for response semantics that do not need a database, but put the
cross-user ownership proof in the existing opt-in DB integration suite so the
test cannot pass through a permissive mock.

Recommended Phase 2 test shape:

1. In `app/domain/symptom-checks/symptom-check-repository.integration.test.ts`,
   create a User A record with the real repository, invoke list/detail/update
   and delete route handlers as User B using real repository dependencies, and
   assert User B sees no record, gets private 404 for detail/update/delete, and
   User A's row remains unchanged.
2. Add no-write count assertions for current-symptoms completion,
   destination `/api/current-pollen`, and device-location `/api/current-location`
   followed by `/api/current-pollen`.
3. Retain or extend the existing positive control that an explicit
   authenticated save increments `symptom_checks` by exactly one.
4. Record `npm run test:db` verification only when it runs against a disposable
   `TEST_DATABASE_URL`; this follows the repository lesson for opt-in
   integration gates.

## Historical Context

- The test plan names Phase 2 as the dedicated gap-filling rollout for risks
  #1, #2, and #3 and requires two-user fixtures plus read/update/delete
  coverage, not UI-only filtering (`context/foundation/test-plan.md:43`,
  `context/foundation/test-plan.md:78`).
- Auth was intentionally added without guarding `/`, `/destination`,
  `/api/city-search`, or `/api/current-pollen`
  (`context/archive/2026-06-10-email-password-account-access/plan.md:31`).
- Auth established server-derived local user UUIDs as the stable owner identity,
  not browser-submitted owner data
  (`context/archive/2026-06-10-email-password-account-access/plan.md:47`).
- Save/view established pending snapshots in `sessionStorage` and a final POST
  as the explicit-save boundary
  (`context/archive/2026-06-11-save-and-view-symptom-check/research.md:63`).
- Save/view also established `createForOwner`, `listForOwner`, and
  `findForOwner`, with missing and foreign records sharing not-found semantics
  (`context/archive/2026-06-11-save-and-view-symptom-check/research.md:75`).
- Manage-saved extended ownership to update/delete: one owner-qualified SQL
  statement per mutation and private 404 for foreign or missing targets
  (`context/archive/2026-06-15-manage-saved-symptom-check/plan.md:74`,
  `context/archive/2026-06-15-manage-saved-symptom-check/plan.md:137`).
- The accepted lesson says opt-in integration gates must be run against their
  documented disposable environment or explicitly recorded as unverified
  (`context/foundation/lessons.md:10`).
- Device-location research confirms coordinates should remain transient and
  saved snapshots exclude latitude/longitude
  (`context/changes/device-location-current-check/research.md:37`,
  `context/changes/device-location-current-check/research.md:134`).

## Related Research

- `context/archive/2026-06-11-save-and-view-symptom-check/research.md`
- `context/archive/2026-06-15-manage-saved-symptom-check/research.md`
- `context/archive/2026-06-06-destination-allergen-risk-check/research.md`
- `context/changes/device-location-current-check/research.md`

## Open Questions

- Whether Phase 2 should rename or split the current
  `symptom-check-repository.integration.test.ts` file if route-handler plus DB
  integration grows beyond repository coverage. Keeping it there avoids
  `vitest.db.config.ts` churn because the config currently includes only
  `app/**/*-repository.integration.test.ts`.
- Whether the plan should require a browser/component test for the pending
  login save confirmation UI. Current evidence suggests route plus DB count
  tests are cheaper and sufficient for the named risks.
