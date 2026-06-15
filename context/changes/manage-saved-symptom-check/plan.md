# Manage Saved Symptom Checks Implementation Plan

## Overview

Allow an authenticated user to correct the symptoms and per-symptom intensities
of one saved check or permanently delete it. The implementation extends the
existing private `/history/:checkId` resource, preserves its original location
and pollen context, and enforces ownership in every database mutation.

## Current State Analysis

Saved checks already have a protected list and detail experience, a versioned
snapshot contract, owner-scoped reads, and deterministic ranking reconstruction.
The detail route is read-only and has no action. The repository supports create,
list, and owner-scoped find operations but no mutation methods.

The persisted schema already separates editable symptom JSON from immutable
city, pollen, completion, ownership, version, and creation metadata. Ranking is
not stored; both history routes reconstruct it from the saved symptoms and
pollen context. No schema migration or ranking change is required.

The current-check flow already provides pure symptom selection transitions and
an accessible per-symptom intensity control. These patterns can support editing
without introducing a second symptom model or a browser test stack.

## Desired End State

The saved-check detail page remains a clean read view until the user enters an
explicit edit mode. In edit mode, they can add or remove symptoms, assign a
low/high intensity to every selected symptom, and see a clearly identified live
preview of the unsaved ranking against the record's original pollen context.
Cancel restores the persisted values. A failed update keeps the draft and shows
an inline retry message.

Delete uses an inline confirmation step. A successful update returns to the
same detail page with the new symptoms and reconstructed ranking; a successful
delete returns to `/history`. Missing, malformed, and foreign targets remain
indistinguishable private 404 responses. Only symptoms and `updatedAt` change
during an update.

### Key Discoveries:

- The detail route currently has a loader and read-only presentation but no
  action (`app/routes/history.$checkId.tsx`).
- The repository contract stops at create/list/find and already scopes detail
  reads by owner and record ID
  (`app/domain/symptom-checks/types.ts`,
  `app/domain/symptom-checks/symptom-check-repository.server.ts`).
- Persisted symptoms are independent JSONB data, while city, pollen, completion
  time, versions, request ID, and fingerprint are separate immutable fields
  (`app/db/schema.server.ts`).
- Snapshot parsing already enforces non-empty, bounded, unique, known symptom
  entries (`app/domain/symptom-checks/snapshot.ts`).
- Current selection helpers already define add, remove, assignment,
  completeness, and reset semantics
  (`app/domain/allergen-ranking/current-symptom-selection.ts`).
- The test plan requires real two-user update/delete evidence and rejects
  UI-only filtering or repository mocks as ownership proof
  (`context/foundation/test-plan.md`).

## What We're NOT Doing

- No editing of saved city, place ID, pollen context, completion time, creation
  time, owner, snapshot version, or ranking version.
- No soft delete, archive, restore, undo, bulk delete, or retention workflow.
- No edit route separate from `/history/:checkId`.
- No optimistic locking, conflict dialog, record locks, or multi-user
  collaboration; the MVP uses last-write-wins.
- No history-driven personalization of future checks.
- No schema migration, persisted ranking, provider call, or transaction.
- No browser E2E or new DOM test stack.
- No changes to public guest checks, authentication behavior, or save consent.

## Implementation Approach

Extend the symptom-check domain with a parser dedicated to editable symptom
entries and owner-scoped repository methods for update and delete. Each
repository mutation uses both owner ID and record ID in one SQL predicate.
Update changes only the symptom JSON and explicitly advances `updatedAt`;
delete hard-removes the matching row. Zero affected rows map to the same private
not-found result for absent and foreign records.

Add one protected action to the existing detail route. The action uses an
explicit `intent=update|delete`, reuses the save action's POST, trusted-origin,
revocation-aware session, bounded form, and safe error patterns, and derives
owner identity only from the authenticated session. Update accepts only symptom
entries. Successful update redirects to the detail resource; successful delete
redirects to history.

Extract a small pure edit-state helper around the existing current-symptom
selection contract. The detail UI uses explicit view/edit modes, live draft
ranking reconstruction from immutable saved context, dirty/completeness
selectors, cancel/reset behavior, retained drafts after failed updates, and an
inline delete confirmation. Route and database tests protect server behavior;
pure state tests protect the UI interaction contract.

## Critical Implementation Details

### State Sequencing

Do not replace an active edit draft merely because loader data revalidates after
a failed or unrelated submission. After a successful update redirect, initialize
the next detail render from the persisted record and leave edit mode. While a
mutation is submitting, prevent duplicate update/delete requests and disable
conflicting controls.

### Persistence Invariant

An edit must not recompute `snapshotFingerprint` or change
`clientRequestId`. The fingerprint remains bound to the original explicit save
request so retrying that save after an edit still resolves to the existing row
instead of conflicting.

## Phase 1: Mutation Contracts And Persistence

### Overview

Define the symptom-only mutation boundary, implement atomic owner-scoped
database operations, and prove their behavior against real PostgreSQL.

### Changes Required:

#### 1. Editable symptom validation

**Files**: `app/domain/symptom-checks/snapshot.ts`,
`app/domain/symptom-checks/snapshot.test.ts`

**Intent**: Reuse the durable snapshot's symptom invariants without accepting
the rest of a browser-supplied snapshot during edits.

**Contract**: Expose a pure parser for an unknown collection of saved symptom
entries. It returns a complete `SavedSymptomEntry[]` only for a non-empty list
bounded by the symptom catalog, with exact entry keys, known symptom IDs,
known low/high intensities, and no duplicates. Keep full snapshot parsing
behavior unchanged.

#### 2. Repository mutation contract

**Files**: `app/domain/symptom-checks/types.ts`,
`app/domain/symptom-checks/symptom-check-repository.server.ts`

**Intent**: Make ownership mandatory at the persistence boundary for every new
mutation.

**Contract**: Add `updateForOwner(ownerId, checkId, symptoms)` returning the
updated record or `null`, and `deleteForOwner(ownerId, checkId)` returning a
deleted identifier/record or `null`. Each operation uses one statement
qualified by both owner ID and check ID. Update changes only `symptoms` and
`updatedAt`; it preserves all other columns, especially the request ID and
snapshot fingerprint.

#### 3. PostgreSQL mutation isolation

**File**:
`app/domain/symptom-checks/symptom-check-repository.integration.test.ts`

**Intent**: Prove the SQL predicates and preservation rules with two actual
users rather than mocks.

**Contract**: Cover owner update and hard delete, foreign and missing mutation
targets, unchanged owner records after foreign attempts, immutable-field
preservation, explicit `updatedAt` advancement, mixed-intensity reconstruction,
and an original-save retry after editing. Verify delete removes exactly the
owner's target and no other row.

### Success Criteria:

#### Automated Verification:

- Symptom-entry parser tests pass for valid mixed entries, empty, oversized,
  malformed, unknown, and duplicate inputs.
- `npm run test:db` proves owner-scoped update/delete and immutable-field
  preservation with two users.
- Database tests prove retrying the original explicit save after an edit still
  resolves to the existing record.
- `npm run typecheck` passes with the extended repository contract.

#### Manual Verification:

- Review confirms no mutation API accepts owner identity inside browser data.
- Review confirms update SQL changes only symptoms and `updatedAt`.
- Review confirms delete is a hard delete scoped by owner and record ID.

**Implementation Note**: Do not proceed to the route action until the real
database suite proves both mutation ownership predicates.

---

## Phase 2: Protected Detail Action

### Overview

Add one hardened intent-based action to the existing saved-check detail
resource and preserve private not-found semantics.

### Changes Required:

#### 1. Detail mutation handler

**Files**:
`app/domain/symptom-checks/symptom-check-route-handlers.server.ts`,
`app/domain/symptom-checks/symptom-check-routes.test.ts`

**Intent**: Centralize authenticated update and delete behavior beside the
existing save/list/detail handlers.

**Contract**: Add a detail action accepting only POST URL-encoded forms with a
trusted origin and bounded body. Authenticate through `requireUser`, validate
the route UUID, then dispatch explicit `intent=update|delete`. Update parses
only a JSON symptom collection and calls `updateForOwner`; delete accepts no
editable snapshot fields and calls `deleteForOwner`. Unknown intents and
invalid update payloads return safe Polish inline action errors without calling
the repository. Zero-row mutations throw the same private 404 used by the
detail loader. Database failures propagate for route error handling.

#### 2. Route action wiring

**File**: `app/routes/history.$checkId.tsx`

**Intent**: Make the existing detail resource the only update/delete endpoint.

**Contract**: Export the route `action` and compose the production
symptom-check dependencies. Successful update redirects to
`/history/:checkId` with a one-time update-success signal; successful delete
redirects to `/history` with a one-time delete-success signal. Preserve the
existing loader, private cache headers, saved-success cleanup, and error
boundary behavior.

### Success Criteria:

#### Automated Verification:

- Focused route tests pass for POST-only behavior, trusted origins, supported
  content type, bounded forms, and signed-out redirects.
- Route tests reject invalid UUIDs, unknown intents, malformed JSON, empty
  symptoms, duplicate symptoms, and extra update authority before persistence.
- Route tests prove owner identity comes from the session and success redirects
  target detail for update and history for delete.
- Missing and foreign update/delete targets produce identical private 404
  responses.
- Repository methods are not called for rejected requests.
- `npm run typecheck` passes with the detail route action.

#### Manual Verification:

- Review confirms update and delete share the existing revocation-aware session
  and trusted-origin boundaries.
- Review confirms error responses contain no owner, symptom, city, pollen, or
  record contents.

**Implementation Note**: Keep authentication before private payload parsing,
matching the established save-action ordering.

---

## Phase 3: Edit And Delete Experience

### Overview

Add the approved explicit edit mode, live unsaved ranking preview, retry-safe
errors, and inline delete confirmation to the saved-check detail page.

### Changes Required:

#### 1. Pure edit-state contract

**Files**:
`app/domain/symptom-checks/saved-check-edit-state.ts`,
`app/domain/symptom-checks/saved-check-edit-state.test.ts`

**Intent**: Protect UI state transitions without introducing DOM or browser
test infrastructure.

**Contract**: Initialize an editable `CurrentSymptomSelection` from persisted
entries and expose pure transitions/selectors for symptom selection, intensity
assignment, deselection, completeness, dirty state, reset/cancel, and complete
submission entries. The persisted order and values are the reset baseline.
Selecting a new symptom starts unassigned; deselecting and reselecting requires
a fresh intensity.

#### 2. Reusable pending controls

**File**: `app/components/symptom-intensity-selector.tsx`

**Intent**: Reuse the existing accessible intensity control safely during
mutations.

**Contract**: Support a disabled state if required by the detail editor, while
preserving controlled radio semantics, visible incomplete guidance, and the
current live-check behavior.

#### 3. Detail edit mode and ranking preview

**File**: `app/routes/history.$checkId.tsx`

**Intent**: Let users review changes before committing while keeping the
default detail view uncluttered.

**Contract**: Add an explicit `Edytuj` entry point. Initialize draft state from
the loaded symptoms, reuse the catalog checkbox/intensity pattern, and retain
city, completion time, and pollen context as read-only. Show a clearly labeled
unsaved ranking preview derived from complete draft entries plus the persisted
pollen map. Save is enabled only for a complete dirty draft. Cancel restores
persisted entries and exits edit mode. An update failure renders an inline
retry message and retains the draft; a successful redirect returns to view mode
with the persisted updated ranking and one-time success feedback.

#### 4. Inline delete confirmation

**File**: `app/routes/history.$checkId.tsx`

**Intent**: Prevent accidental hard deletion without excessive friction.

**Contract**: Add a destructive action that first opens an inline confirmation
panel explaining permanence. Confirmation submits `intent=delete`; cancellation
closes the panel. Delete failure keeps the record and confirmation context
visible with an inline retry message. Disable conflicting edit/delete controls
and duplicate submissions while either mutation is pending.

#### 5. History delete feedback

**File**: `app/routes/history.tsx`

**Intent**: Confirm successful deletion at the destination without leaving a
repeatable query-state message.

**Contract**: Render one-time Polish deletion feedback from the approved
redirect signal and remove transient URL state after display, following the
existing saved-success cleanup pattern.

### Success Criteria:

#### Automated Verification:

- Pure edit-state tests pass for initialization, dirty detection, incomplete
  assignment, add/remove, intensity changes, cancel/reset, and submission
  entries.
- `npm test -- app/domain/symptom-checks/symptom-check-routes.test.ts` remains
  green with UI submission contracts.
- Full `npm test` passes.
- `npm run typecheck` passes.

#### Manual Verification:

- Detail opens in read mode and enters editing only after `Edytuj`.
- Live preview is visibly marked unsaved and recalculates from draft symptoms
  against unchanged saved pollen context.
- Save remains disabled for unchanged or incomplete drafts; cancel restores the
  exact persisted values.
- Failed update preserves all draft changes and supports retry.
- Inline delete confirmation can be cancelled, and a failed delete leaves the
  record and retry context intact.
- Pending controls prevent duplicate or conflicting mutations.
- Edit and confirmation layouts remain usable with all symptoms selected on
  mobile and desktop.

**Implementation Note**: After automated checks, pause for manual confirmation
of draft retention, live preview labeling, and destructive-action behavior.

---

## Phase 4: Integrated Verification And Handoff

### Overview

Exercise the complete management lifecycle, confirm regressions remain closed,
and synchronize roadmap metadata for implementation handoff.

### Changes Required:

#### 1. Cross-layer regression verification

**Files**:
`app/domain/symptom-checks/symptom-check-routes.test.ts`,
`app/domain/symptom-checks/symptom-check-repository.integration.test.ts`

**Intent**: Verify route semantics and real ownership isolation remain aligned
after UI integration.

**Contract**: Retain focused route evidence for validation, redirects, and
private 404s, plus real database evidence that user B cannot update or delete
user A's record. Confirm failed foreign operations leave the owner-visible
snapshot unchanged and successful edits reconstruct the documented mixed
ranking.

#### 2. Roadmap closeout metadata

**File**: `context/foundation/roadmap.md`

**Intent**: Remove the existing S-03 status inconsistency after implementation
is complete.

**Contract**: During closeout, update S-03 consistently in the at-a-glance
table, detailed slice, and backlog handoff according to the repository's normal
archive workflow. Do not mark the roadmap item done during implementation
planning.

### Success Criteria:

#### Automated Verification:

- `npm test` passes without live providers or PostgreSQL.
- `npm run test:db` passes the complete user and symptom-check repository
  integration suites.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm audit --json` completes with advisories fixed or documented for release
  handoff.
- Source and route checks confirm `/`, `/destination`, and public APIs remain
  unguarded.

#### Manual Verification:

- User A can edit and delete A's records; user B receives the same not-found
  behavior for A's identifier as for a random UUID.
- Editing changes only symptoms and the displayed ranking; location, pollen,
  completion time, versions, and creation metadata remain unchanged.
- Successful deletion removes the record from history and direct detail access
  returns not found.
- New current-symptoms and destination checks remain independent of saved
  history.
- Runtime logs contain no symptom payload, city label, record content, owner
  identifier, session cookie, or token.
- S-03 roadmap metadata is synchronized during implementation closeout.

**Implementation Note**: Database integration and dependency audit remain
release gates even though the default deterministic suite excludes PostgreSQL.

---

## Testing Strategy

### Unit Tests:

- Symptom-only parsing for bounds, exact keys, known IDs/intensities, non-empty
  input, and duplicate rejection.
- Pure edit-state initialization, dirty/completeness selectors, add/remove,
  assignment, cancel/reset, and complete submission conversion.
- Ranking reconstruction from edited mixed-intensity symptoms and preserved
  pollen context.

### Integration Tests:

- Direct action tests for method, trusted origin, authentication, UUID, intent,
  bounded body, symptom validation, owner derivation, redirects, retry-safe
  action errors, and private 404 semantics.
- Real PostgreSQL tests with two users for owner update/delete success, foreign
  failure, immutable-field preservation, hard deletion, and original-save retry
  after editing.
- Existing read, explicit-save, auth, and public-route tests remain regression
  coverage.

### Manual Testing Steps:

1. Open a saved check and verify it starts in read mode.
2. Enter edit mode, add/remove symptoms, assign mixed intensities, and compare
   the labeled live preview with the eventual saved ranking.
3. Cancel an edit and verify every original symptom and intensity returns.
4. Simulate an update failure and verify the draft remains available to retry.
5. Save an edit and verify only symptoms, ranking, and `updatedAt` change.
6. Open delete confirmation, cancel it, reopen it, and complete deletion.
7. Simulate a delete failure and verify the record and confirmation remain.
8. Copy user A's record URL while signed in as user B and attempt both
   mutations; compare the result with a random UUID.
9. Verify edit and delete interactions at mobile and desktop widths.
10. Complete both guest product flows and confirm history does not affect them.

## Performance Considerations

Each mutation is one indexed owner-and-ID statement over a small record. Live
preview runs the existing in-process ranking over a fixed allergen and symptom
catalog and requires no network request. Avoid provider calls, list reloads, or
persisted ranking data during editing.

## Migration Notes

No database migration is required. The existing columns already isolate
editable symptoms from immutable snapshot context. Update and delete are
compatible with the currently deployed schema and do not require transaction
coordination or data backfill.

## References

- Related research:
  `context/changes/manage-saved-symptom-check/research.md`
- Product requirements: `context/foundation/prd.md`
- Roadmap slice S-03: `context/foundation/roadmap.md`
- Risk guidance: `context/foundation/test-plan.md`
- Prior saved-check implementation:
  `context/archive/2026-06-11-save-and-view-symptom-check/plan.md`
- Current detail route: `app/routes/history.$checkId.tsx`
- Repository boundary:
  `app/domain/symptom-checks/symptom-check-repository.server.ts`
- Mutation handler pattern:
  `app/domain/symptom-checks/symptom-check-route-handlers.server.ts`
- Editable selection pattern:
  `app/domain/allergen-ranking/current-symptom-selection.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Mutation Contracts And Persistence

#### Automated

- [ ] 1.1 Symptom-entry parser tests pass for valid and rejected inputs
- [ ] 1.2 PostgreSQL proves owner-scoped update/delete and immutable-field preservation
- [ ] 1.3 Original explicit-save retry remains idempotent after editing
- [ ] 1.4 Typecheck passes with repository mutation contracts

#### Manual

- [ ] 1.5 Mutation APIs derive owner identity outside browser data
- [ ] 1.6 Update SQL changes only symptoms and updatedAt
- [ ] 1.7 Delete is a hard owner-and-record scoped operation

### Phase 2: Protected Detail Action

#### Automated

- [ ] 2.1 Detail action passes method, origin, content-type, body-bound, and auth tests
- [ ] 2.2 Invalid UUID, intent, and symptom payloads are rejected before persistence
- [ ] 2.3 Authenticated owner derivation and update/delete redirects are correct
- [ ] 2.4 Missing and foreign mutations share private not-found behavior
- [ ] 2.5 Rejected requests do not call repository mutations
- [ ] 2.6 Typecheck passes with the detail route action

#### Manual

- [ ] 2.7 Mutations reuse revocation-aware session and trusted-origin boundaries
- [ ] 2.8 Mutation errors disclose no private record or owner data

### Phase 3: Edit And Delete Experience

#### Automated

- [ ] 3.1 Pure edit-state tests pass for initialization, transitions, reset, and submission
- [ ] 3.2 Focused symptom-check route tests remain green with UI contracts
- [ ] 3.3 Full deterministic test suite passes
- [ ] 3.4 Typecheck passes

#### Manual

- [ ] 3.5 Detail uses explicit read and edit modes
- [ ] 3.6 Unsaved ranking preview recalculates against preserved pollen context
- [ ] 3.7 Save readiness and cancel restore persisted values
- [ ] 3.8 Failed update preserves the draft and supports retry
- [ ] 3.9 Inline delete confirmation supports cancel, failure, and retry
- [ ] 3.10 Pending controls prevent duplicate or conflicting mutations
- [ ] 3.11 Edit and delete layouts work on mobile and desktop

### Phase 4: Integrated Verification And Handoff

#### Automated

- [ ] 4.1 Full deterministic test suite passes
- [ ] 4.2 Complete PostgreSQL integration suite passes
- [ ] 4.3 Typecheck passes
- [ ] 4.4 Production build passes
- [ ] 4.5 Dependency audit is fixed or documented
- [ ] 4.6 Public guest routes and APIs remain unguarded

#### Manual

- [ ] 4.7 Two users cannot update or delete each other's records
- [ ] 4.8 Editing preserves immutable saved context and metadata
- [ ] 4.9 Successful deletion removes history and detail access
- [ ] 4.10 New checks remain independent of saved history
- [ ] 4.11 Runtime logs contain no private check, owner, credential, or token data
- [ ] 4.12 S-03 roadmap metadata is synchronized during closeout
