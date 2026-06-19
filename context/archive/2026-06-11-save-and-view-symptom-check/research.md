---
topic: save-and-view-symptom-check
researcher: codex
date: 2026-06-11
---

# Research: Save And View Symptom Check

## Summary

S-02 can build on the completed authentication and PostgreSQL foundations. The
current symptom check is entirely client-side, while protected operations can
already obtain a revocation-checked local user UUID. The new slice should add
one additive table, a typed snapshot contract, owner-scoped repository
operations, an explicit save action, and protected history list/detail routes.

## Product Constraints

- Saving must happen only after an explicit user action.
- A completed guest check must survive registration or sign-in.
- History list and detail reads must be private to the authenticated owner.
- Saved history must not influence future rankings.
- Existing guest current-symptoms and destination flows stay public.
- User-facing history remains Polish and non-diagnostic.

## Current State

- `app/routes/home.tsx:52` owns city, symptom, intensity, pollen, and ranking
  state in React. It has no loader, action, persistence call, local storage, or
  cookie state.
- `app/routes/home.tsx:79` performs only the existing pollen GET after city
  selection.
- `app/domain/auth/session.server.ts:189` exposes `requireUser`, which performs
  revocation-aware session verification and returns the stable local user UUID.
- `app/db/schema.server.ts:3` and `app/domain/auth/user-repository.server.ts:17`
  establish UUID, timezone timestamp, Drizzle, and repository conventions.
- `app/domain/auth/return-to.ts:1` currently permits only `/` and
  `/destination`; protected history paths are not yet valid auth destinations.
- `app/routes.ts:3` requires every route to be registered explicitly.
- `vitest.db.config.ts:10` currently runs only the user repository integration
  test and must include the symptom-check repository suite.

## Snapshot Contract

Persist the minimum data needed to reproduce and later edit the saved check:

- application owner UUID;
- snapshot version and ranking-contract version;
- check completion timestamp and database timestamps;
- city provider place ID and display label;
- symptom entries shaped as `{ symptomId, intensity }`;
- a complete pollen activity map for all supported allergen IDs.

The current single intensity is copied onto each selected symptom. This avoids
an immediate storage migration when S-04 introduces per-symptom intensity.
Partial pollen maps are canonicalized by filling missing allergens with
`unknown`.

Do not persist latitude/longitude, owner identity from the browser, generated
labels, explanations, scores, or ranked arrays. Ranking output is deterministic
from the saved snapshot and should be recomputed for list/detail rendering.

## Guest Authentication Handoff

The completed check cannot be placed in the URL or authentication form because
it contains symptom and location data. After the user presses Save, store a
versioned, expiring pending snapshot in browser `sessionStorage`, redirect to
authentication with `returnTo=/?save=pending`, restore the form after auth, and
require a final explicit save POST. No database row is created before that POST.
Clear the pending snapshot after success, cancellation, expiry, or invalid data.

Save must remain disabled while pollen lookup is loading so an unknown
placeholder cannot race with the real response.

## Ownership Boundary

Repository operations must accept owner ID as a separate trusted argument:

- `createForOwner(ownerId, input)`
- `listForOwner(ownerId)`
- `findForOwner(ownerId, checkId)`

The browser never submits an owner ID. Detail lookup uses both record ID and
owner ID in the SQL predicate. Missing and foreign records produce the same
not-found response. Database failures remain server errors rather than being
disguised as not-found.

## Test Strategy

- Unit tests validate and canonicalize snapshots and reproduce rankings.
- Route tests prove POST/origin/session requirements, owner derivation, invalid
  payload rejection, protected redirects, and identical not-found behavior.
- PostgreSQL integration tests create two users and prove owner-scoped create,
  list, and detail behavior with a foreign record ID.
- Explicit-consent integration tests inspect PostgreSQL row counts and prove
  ordinary check completion performs no write while only the explicit save
  action inserts.
- Existing public-route, ranking, auth, full-suite, and typecheck tests remain
  required.

## Risks

- IDOR from an unscoped record lookup.
- Duplicate records from double submission or retry.
- Guest state loss through alternate registration/sign-in links.
- Persisting before explicit confirmation.
- Logging symptom or location payloads.
- JSON data becoming unreadable after contract evolution.
- Authentication return-path validation dropping protected history routes.

## References

- `context/foundation/roadmap.md`
- `context/foundation/prd.md`
- `context/foundation/test-plan.md`
- `context/foundation/infrastructure.md`
- `app/routes/home.tsx`
- `app/domain/allergen-ranking/types.ts`
- `app/domain/allergen-ranking/ranking.ts`
- `app/domain/auth/session.server.ts`
- `app/domain/auth/return-to.ts`
- `app/db/schema.server.ts`
- `app/domain/auth/user-repository.server.ts`
