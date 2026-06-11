# Save And View Private Symptom Checks — Plan Brief

> Full plan: `context/changes/save-and-view-symptom-check/plan.md`
> Research: `context/changes/save-and-view-symptom-check/research.md`

## What & Why

Add explicit persistence to the completed current-symptoms flow and private
history list/detail pages. The slice proves authentication, ownership,
persistence, existing ranking logic, and user consent together without
weakening the public guest experience.

## Starting Point

Account access already provides a revocation-aware local user UUID and a
PostgreSQL/Drizzle foundation. Current checks remain entirely client-side and
produce deterministic ranked output from city, symptoms, one shared intensity,
and normalized pollen activity.

## Desired End State

A signed-in user can explicitly save a completed check and open it from a
private history list. A guest who presses Save can authenticate without losing
the completed check, then confirms the final write. No user can list or open
another user's records, and ordinary check completion creates no database row.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Ownership | Owner ID comes only from `requireUser` | Prevents browser-controlled authorization | Research |
| Snapshot | City label/place ID, per-symptom entries, pollen map, timestamps, versions | Minimum data reproduces the check and supports later editing | Research |
| Current intensity | Copy shared intensity to every saved symptom | Avoids storage churn when S-04 lands | Research |
| Derived ranking | Recompute from saved inputs | Avoids duplicating labels, scores, and explanations | Plan |
| Guest handoff | Expiring `sessionStorage` draft after Save is pressed | Preserves state without pre-auth persistence or URL disclosure | Research |
| Save semantics | Final authenticated POST with one-use request ID | Keeps consent explicit and retries idempotent | Plan |
| Foreign record | Same 404 as missing record | Avoids confirming another user's record exists | Research |
| Test evidence | Real two-user PostgreSQL integration tests | UI filtering and mocks cannot prove ownership predicates | Test plan |

## Scope

**In scope:**

- Additive symptom-check schema and migration.
- Versioned snapshot validation and ranking reconstruction.
- Owner-scoped create, list, and detail repository operations.
- Explicit save on the current-symptoms route.
- Guest-to-auth pending save restoration.
- Protected `/history` and `/history/:checkId` pages.
- History navigation for authenticated users.
- Deterministic, route, and PostgreSQL ownership tests.

**Out of scope:**

- Updating or deleting records.
- Per-symptom intensity UI in the live current check.
- Device location and missing-data card labels.
- History-driven personalization.
- Anonymous history, exports, sharing, or exact coordinates.
- Automatic saving or background persistence.

## Architecture / Approach

The browser builds a versioned snapshot only when Save is pressed. Authenticated
users POST it through the public home action; guests place it temporarily in
`sessionStorage`, authenticate, restore it on `/`, and make the same final POST.
The action validates origin, session, bounded input, and a one-use request ID,
then calls an owner-scoped repository. Protected history loaders use the same
revocation-aware session boundary and recompute display rankings from saved
inputs.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Snapshot And Schema | Typed versioned record contract and additive migration | Persisting too much data or an unreadable future format |
| 2. Owner-Scoped Persistence | Create/list/detail repository and real isolation tests | Cross-user disclosure or duplicate writes |
| 3. Explicit Save Handoff | Signed-in save and guest authentication restoration | Implicit persistence or lost completed state |
| 4. Private History Experience | Protected list/detail UI and final verification | UI-only privacy or guest-flow regression |

**Prerequisites:** Implemented F-01 and implementation-reviewed S-01; disposable
PostgreSQL for integration verification.

**Estimated effort:** About 4 focused implementation sessions across 4 phases.

## Open Risks & Assumptions

- Browser `sessionStorage` is intentionally device/tab local and is cleared
  after success, cancellation, invalid data, or expiry.
- Ranking behavior can evolve; supported snapshot and ranking versions must
  remain readable, but exact historical wording is not persisted.
- Cloud SQL backups must be verified before symptom history is treated as
  durable production data.

## Success Criteria (Summary)

- Explicit Save creates one owner-assigned record; check completion alone
  creates none.
- Authenticated users can list and inspect only their own saved checks.
- Guest state survives registration/sign-in and final confirmation.
- Full tests, database integration tests, typecheck, build, and manual
  responsive flows pass without regressing public routes.
