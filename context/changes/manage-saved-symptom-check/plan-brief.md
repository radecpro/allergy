# Manage Saved Symptom Checks — Plan Brief

> Full plan: `context/changes/manage-saved-symptom-check/plan.md`
> Research: `context/changes/manage-saved-symptom-check/research.md`

## What & Why

Let authenticated users correct the symptoms and individual low/high
intensities of a saved check or permanently delete it. This completes the
private CRUD lifecycle while keeping the record tied to its original location,
pollen context, and completion time.

## Starting Point

Private history list/detail pages, owner-scoped reads, explicit saving, and
ranking reconstruction already exist. The detail resource is read-only, but
the schema already separates editable symptoms from immutable check context.

## Desired End State

The detail page gains explicit editing, a live unsaved ranking preview,
retry-safe drafts, and inline delete confirmation. Every mutation remains
owner-scoped and foreign records reveal no existence information.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Mutation route | One intent-based action on `/history/:checkId` | Extends the existing resource without a parallel route | Research |
| Editable fields | Symptoms and per-symptom intensities only | Preserves the original environmental context required by the PRD | Research |
| Persistence | Owner-qualified atomic update/delete statements | Prevents authorization races and cross-user mutation | Research |
| Edit entry | Explicit `Edytuj` mode | Keeps the normal history view readable | Plan |
| Ranking feedback | Live unsaved preview | Lets users see the correction before committing | Plan |
| Delete safety | Inline confirmation panel | Accessible and testable without excessive friction | Plan |
| Mutation failure | Retain draft/confirmation and show inline retry | Avoids losing user work during transient failures | Plan |
| UI automation | Pure edit-state tests, no browser stack | Protects state transitions at the cheapest useful layer | Plan |
| Concurrency | Last-write-wins | Fits the small MVP without stale-edit protocol complexity | Research |
| Ownership evidence | Real two-user PostgreSQL tests | Route mocks and UI filtering cannot prove SQL isolation | Research |

## Scope

**In scope:**

- Symptom-only mutation validation.
- Owner-scoped repository update and hard delete.
- Protected update/delete action on the existing detail route.
- Explicit editing, live preview, cancel/reset, and retry-safe failures.
- Inline delete confirmation.
- Pure state, route, and PostgreSQL ownership tests.

**Out of scope:**

- Editing location, pollen, timestamps, versions, ownership, or save metadata.
- Soft delete, undo, bulk actions, or optimistic concurrency.
- History-driven personalization.
- New routes, migrations, provider calls, transactions, or browser E2E.

## Architecture / Approach

One detail POST action dispatches `intent=update|delete` after origin, session,
UUID, and bounded-form validation. Owner-qualified SQL updates only symptoms
and `updatedAt` or hard-deletes the row. A pure edit-state helper drives the UI,
and preview ranking reuses the saved pollen map.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Mutation Contracts And Persistence | Validation, owner-scoped SQL, and two-user DB proof | Cross-user mutation or metadata corruption |
| 2. Protected Detail Action | Hardened update/delete request boundary | Existence leaks or browser-controlled authority |
| 3. Edit And Delete Experience | Explicit editing, preview, retry, and confirmation UI | Lost drafts or accidental deletion |
| 4. Integrated Verification And Handoff | Full regression gates and roadmap closeout | UI confidence without real ownership evidence |

**Prerequisites:** Completed auth, save/history, per-symptom intensity, and a
disposable PostgreSQL database.  
**Estimated effort:** About 3–4 focused sessions across 4 phases.

## Open Risks & Assumptions

- Last-write-wins is accepted; concurrent stale edits are not detected.
- Hard deletion is immediate and has no undo or retention period.
- The original fingerprint remains unchanged so save retries stay idempotent.
- Loader revalidation must not overwrite an active draft after a failed or
  unrelated submission.

## Success Criteria (Summary)

- A user can edit symptoms/intensities and see the recalculated saved ranking
  without changing original location, pollen, or completion context.
- A user can permanently delete only their own saved check.
- Missing and foreign mutation targets remain indistinguishable private 404s.
- Failed mutations preserve user context, and deterministic plus real database
  verification passes.
