---
project: Allergen Finder
version: 2
status: draft
created: 2026-06-09
updated: 2026-06-15
prd_version: 3
main_goal: speed
top_blocker: time
---

# Roadmap: Allergen Finder MVP Expansion

> Derived from `context/foundation/prd.md` (v3) + auto-researched codebase baseline.
> Edit in place; archive when superseded.
> Items are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Allergen Finder already provides guest current-symptoms and destination checks. This expansion adds authenticated, user-owned saved symptom checks with complete create, read, update, and delete behavior while preserving the fast guest experience and improving location, symptom-intensity, and missing-pollen-data handling.

## North star

In this roadmap, the north star means the smallest end-to-end capability that proves the expanded product promise works.

**S-02: Explicitly save and view a private symptom check** — This is the first point where authentication, ownership, persistence, existing ranking behavior, and explicit consent work together in one user-visible flow.

## At a glance

| ID | Change ID | Outcome (user can ...) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | risk-based-test-foundation | (foundation) Standard automated verification and a named risk plan are available for every expansion slice | — | Success Criteria, Guardrails, NFRs | done |
| S-01 | email-password-account-access | Register, sign in with email and password, and sign out while guest checks remain public | F-01 | FR-001, FR-002, FR-003, FR-004, FR-005 | done |
| S-02 | save-and-view-symptom-check | Explicitly save a completed current-symptoms check and view it in private history | F-01, S-01 | US-01, FR-005, FR-006, FR-007, FR-010 | done |
| S-03 | manage-saved-symptom-check | Correct symptoms and per-symptom intensities in a saved check or delete the record | F-01, S-02 | US-02, FR-005, FR-008, FR-009, FR-010 | proposed |
| S-04 | per-symptom-intensity-ranking | Assign low/high intensity to each selected symptom and receive the recalculated ranking | F-01 | US-04, FR-001, FR-003, FR-013 | proposed |
| S-05 | device-location-current-check | Use current device location for a symptom check with manual city selection preserved as fallback | F-01 | US-03, FR-001, FR-003, FR-011, FR-012 | proposed |
| S-06 | missing-pollen-warning-label | Identify at first glance which current-symptoms result cards lack provider pollen data | F-01 | US-04, FR-001, FR-003, FR-014 | proposed |

## Baseline

What's already in place in the codebase as of `2026-06-09` (auto-researched).
Foundations below assume these are present and do not recreate them.

- **Frontend:** present — Polish current-symptoms and destination route interfaces, shared city selection, mode navigation, and responsive styling are implemented (`app/routes/home.tsx`, `app/routes/destination-search.tsx`, `app/components/`).
- **Backend / API:** present — product-owned city search and pollen lookup handlers are registered and used by both product flows (`app/routes.ts`, `app/routes/api.city-search.ts`, `app/routes/api.current-pollen.ts`).
- **Data:** absent — no persistent application data store, schema, or repository layer exists (`package.json`, `app/`).
- **Auth:** absent — no account, credential, session, or route-authorization behavior exists (`app/routes.ts`, `package.json`).
- **Deploy / infra:** partial — a production container and deployment plan exist, but no automated delivery workflow is present (`Dockerfile`, `context/deployment/deploy-plan.md`).
- **Observability:** partial — route error handling exists, but structured application logging, metrics, and external error reporting are absent (`app/root.tsx`).

## Foundations

### F-01: Risk-Based Test Foundation

- **Outcome:** (foundation) A standard test command, focused test runner, and `test-plan.md` risk inventory are available before authentication or persistence behavior is added.
- **Change ID:** risk-based-test-foundation
- **PRD refs:** Success Criteria, Guardrails, NFRs
- **Unlocks:** S-01 through S-06; provides the named cross-user authorization verification path required by S-02 and S-03.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This foundation must stay limited to executable verification and the required risk plan; broad test-suite expansion would consume the fixed delivery window before user-visible work starts.
- **Status:** done

## Slices

### S-01: Email And Password Account Access

- **Outcome:** User can register, sign in with email and password, and sign out while both existing allergen checks remain fully usable as a guest.
- **Change ID:** email-password-account-access
- **PRD refs:** FR-001, FR-002, FR-003, FR-004, FR-005
- **Prerequisites:** F-01
- **Parallel with:** S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - Which minimum password policy and session lifetime fit the MVP safety boundary? — Owner: team. Block: no.
- **Risk:** Authentication is sequenced before saved history because ownership cannot be retrofitted safely after records exist; overbuilding account lifecycle features would threaten the deadline.
- **Status:** done

### S-02: Explicitly Save And View A Private Symptom Check

- **Outcome:** Authenticated user can explicitly save a completed current-symptoms check and view it in a history list and detail view that contains only their records.
- **Change ID:** save-and-view-symptom-check
- **PRD refs:** US-01, FR-005, FR-006, FR-007, FR-010
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - Which minimum snapshot fields are required to reproduce the saved check while preserving the PRD's explicit-consent boundary? — Owner: team. Block: no.
- **Risk:** This slice combines account identity, persistence, ownership, and an existing completed check; ownership verification must be built into the first record path rather than added later.
- **Status:** done

### S-03: Manage A Saved Symptom Check

- **Outcome:** Authenticated user can update symptoms and per-symptom intensities in a saved check or delete that check, without changing its saved location and pollen context.
- **Change ID:** manage-saved-symptom-check
- **PRD refs:** US-02, FR-005, FR-008, FR-009, FR-010
- **Prerequisites:** F-01, S-02
- **Parallel with:** S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Update and delete complete the required CRUD lifecycle; every mutation must repeat ownership checks rather than trusting record identifiers supplied by the user interface.
- **Status:** proposed

### S-04: Per-Symptom Intensity Ranking

- **Outcome:** User can assign low/high intensity to each selected symptom and receive an automatically updated allergen ranking that uses those individual intensities.
- **Change ID:** per-symptom-intensity-ranking
- **PRD refs:** US-04, FR-001, FR-003, FR-013
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02, S-03, S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The domain rule and current-check interface change together; preserving one overall-intensity assumption anywhere would make results inconsistent.
- **Status:** proposed

### S-05: Device Location For Current Check

- **Outcome:** User can use current device location to select the current city and can still complete the check through manual city selection when permission or lookup fails.
- **Change ID:** device-location-current-check
- **PRD refs:** US-03, FR-001, FR-003, FR-011, FR-012
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02, S-03, S-04, S-06
- **Blockers:** —
- **Unknowns:**
  - What user-facing city should be shown when the resolved location is ambiguous? — Owner: team. Block: no.
- **Risk:** Permission denial and unavailable location are normal outcomes, so the manual path must remain equally complete rather than becoming an error-only fallback.
- **Status:** proposed

### S-06: Missing Pollen Data Warning Label

- **Outcome:** User can identify at first glance which current-symptoms result cards lack provider pollen data while still seeing the available symptom-based context.
- **Change ID:** missing-pollen-warning-label
- **PRD refs:** US-04, FR-001, FR-003, FR-014
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02, S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The warning must distinguish unknown data from low activity without making the entire ranking appear invalid or diagnostic.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | risk-based-test-foundation | Establish risk-based automated test foundation | yes | Run `/10x-plan risk-based-test-foundation` |
| S-01 | email-password-account-access | Add email and password account access | no | Depends on F-01 |
| S-02 | save-and-view-symptom-check | Let users explicitly save and view private symptom checks | no | Depends on F-01 and S-01 |
| S-03 | manage-saved-symptom-check | Let users update or delete saved symptom checks | no | Depends on F-01 and S-02 |
| S-04 | per-symptom-intensity-ranking | Rank with intensity selected per symptom | no | Depends on F-01 |
| S-05 | device-location-current-check | Add device location with manual fallback | no | Depends on F-01 |
| S-06 | missing-pollen-warning-label | Add visible missing-pollen warning labels | no | Depends on F-01 |

## Open Roadmap Questions

No open roadmap questions.

## Parked

- **History-driven ranking personalization** — Why parked: PRD v3 keeps saved history display-only to avoid unvalidated ranking and medical complexity.
- **Automatic check saving** — Why parked: explicit saving is the privacy boundary for location and symptom persistence.
- **Anonymous or guest history** — Why parked: persistent records belong to authenticated users.
- **Social or passwordless login** — Why parked: email and password is the selected MVP access method.
- **Password recovery** — Why parked: account recovery is excluded from this delivery window.
- **Role hierarchy and administration** — Why parked: the MVP has one flat authenticated-user role.
- **Editing saved location or environmental context** — Why parked: only symptoms and their intensities are editable.
- **Shared records, family accounts, and exports** — Why parked: the history workflow is private and single-user.
- **Medical advice or diagnosis** — Why parked: existing non-diagnostic product boundaries remain unchanged.
- **Offline-first and multi-region guarantees** — Why parked: they do not contribute to the required MVP foundations.

## Done

(Empty. `/10x-archive` appends entries here when roadmap items are archived.)
- **F-01: (foundation) A standard test command, focused test runner, and `test-plan.md` risk inventory are available before authentication or persistence behavior is added.** — Archived 2026-06-15 → `context/archive/2026-06-10-risk-based-test-foundation/`. Lesson: —.
- **S-01: User can register, sign in with email and password, and sign out while both existing allergen checks remain fully usable as a guest.** — Archived 2026-06-15 → `context/archive/2026-06-10-email-password-account-access/`. Lesson: —.
- **S-02: Authenticated user can explicitly save a completed current-symptoms check and view it in a history list and detail view that contains only their records.** — Archived 2026-06-15 → `context/archive/2026-06-11-save-and-view-symptom-check/`. Lesson: —.
