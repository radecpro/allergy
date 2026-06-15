---
date: 2026-06-15T20:52:39+02:00
researcher: Codex
git_commit: 76b366b34e5cd627db431a04ed63f224a99c9cef
branch: develop
repository: allergy
topic: "Let users update or delete saved symptom checks"
tags: [research, codebase, symptom-checks, ownership, history]
status: complete
last_updated: 2026-06-15
last_updated_by: Codex
---

# Research: Let Users Update Or Delete Saved Symptom Checks

**Date**: 2026-06-15T20:52:39+02:00
**Researcher**: Codex
**Git Commit**: 76b366b34e5cd627db431a04ed63f224a99c9cef
**Branch**: develop
**Repository**: allergy

## Research Question

How should `manage-saved-symptom-check` add secure update and delete behavior to the existing private symptom-check history?

## Summary

The feature can be implemented on the existing `/history/:checkId` route without a database migration. The persisted row already stores editable symptoms separately from immutable city, pollen, completion time, owner, and version fields. Updating the symptom JSON and `updatedAt` is sufficient because history views reconstruct rankings from stored symptoms and pollen context at read time.

Both mutations should use one protected route action with an explicit `intent=update|delete`. The server must derive the owner from the revocation-aware session, accept only symptom IDs and intensities for updates, reuse trusted-origin and bounded-form protections, and execute owner-qualified `UPDATE ... RETURNING` or `DELETE ... RETURNING` statements. Missing and foreign records should remain indistinguishable private `404` responses.

The highest-value verification is real PostgreSQL coverage with two users. Route tests alone or UI filtering do not prove ownership isolation. No transaction is required because each mutation is one atomic row statement and rankings are derived rather than persisted.

## Detailed Findings

### Existing History Flow

- `/history` and `/history/:checkId` are the only history routes; no edit route or mutation action exists ([routes.ts:9](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/app/routes.ts#L9)).
- The detail route is read-only and reconstructs the saved ranking before rendering the summary and result cards ([history.$checkId.tsx:24](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/app/routes/history.%24checkId.tsx#L24)).
- Existing symptom-selection and intensity controls can be reused for editing, initialized from `record.snapshot.symptoms` ([symptom-intensity-selector.tsx:14](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/app/components/symptom-intensity-selector.tsx#L14)).
- The detail page needs edit/save/cancel states, validation feedback, delete confirmation, pending behavior, and post-mutation navigation.

### Persistence And Ranking

- The schema already separates `symptoms` JSONB from owner, city, pollen, completion time, version, and idempotency metadata ([schema.server.ts:30](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/app/db/schema.server.ts#L30)).
- `updatedAt` currently has only an insertion default, so successful edits must set it explicitly ([schema.server.ts:51](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/app/db/schema.server.ts#L51)).
- The repository contract currently supports only create, list, and owner-scoped find operations ([types.ts:60](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/app/domain/symptom-checks/types.ts#L60)).
- Add `updateForOwner(ownerId, checkId, symptoms)` and `deleteForOwner(ownerId, checkId)`. Each operation should include both identifiers in a single SQL predicate and return the affected row or identifier.
- Ranking is pure and derived from symptoms plus saved pollen context ([ranking.ts:46](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/app/domain/allergen-ranking/ranking.ts#L46)). Existing snapshot reconstruction recalculates it at read time ([snapshot.ts:225](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/app/domain/symptom-checks/snapshot.ts#L225)).
- Preserve city, pollen activity, `completedAt`, `createdAt`, owner, snapshot/ranking versions, `clientRequestId`, and `snapshotFingerprint`.
- Keep the creation fingerprint unchanged. It describes the original idempotent save request; recomputing it after an edit would make a retry of that original save conflict with its existing row.
- No transaction is needed: each update or delete is one atomic row mutation and no persisted ranking must be synchronized.

### Validation And Security

- The server must accept only a bounded collection of `{ symptomId, intensity }` values. It must not accept a complete snapshot, owner ID, city, pollen, timestamps, or version fields from the browser.
- Existing snapshot parsing already enforces a non-empty bounded list, known symptom IDs and intensities, and no duplicates ([snapshot.ts:123](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/app/domain/symptom-checks/snapshot.ts#L123)). Extract or wrap this logic for mutation-specific validation.
- Reuse the revocation-aware `requireUser()` path and derive `ownerId` only from its result ([session.server.ts:189](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/app/domain/auth/session.server.ts#L189)).
- Reuse trusted-origin checking and the existing save action's method, bounded-form, authentication, and validation ordering ([symptom-check-route-handlers.server.ts:112](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/app/domain/symptom-checks/symptom-check-route-handlers.server.ts#L112)).
- A zero-row owner-qualified update or delete should produce the same private `404` used for malformed, missing, and foreign detail identifiers. This preserves non-enumeration.
- Successful update should redirect back to the detail page. Successful delete should redirect to `/history`.
- Last-write-wins is adequate for the current small MVP. Optimistic concurrency would require new stale-edit semantics and is not required by the PRD.

### Product Constraints

- Users may edit only symptoms and their individual low/high intensities; saved location, pollen context, and completion time remain immutable ([prd.md:73](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/context/foundation/prd.md#L73)).
- Delete is a required hard-delete user capability, not archival ([prd.md:135](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/context/foundation/prd.md#L135)).
- History remains display-only for future checks; edits must not personalize new rankings ([prd.md:137](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/context/foundation/prd.md#L137)).
- Guest current-symptom and destination flows must remain public. Only saved-history management is authenticated.
- Current records use snapshot version `1` and ranking contract `current-v2`; the previous slice removed legacy `current-v1` records, so no legacy edit path is needed ([per-symptom plan.md:127](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/context/archive/2026-06-14-per-symptom-intensity-ranking/plan.md#L127)).

### Verification Requirements

- Add route tests for method restrictions, trusted origin, signed-out redirect, invalid UUID, unknown intent, malformed/empty/duplicate symptoms, owner derivation, success redirects, and repository non-invocation on rejected requests.
- Add real PostgreSQL two-user tests proving owner update/delete success and foreign update/delete failure. Failed foreign mutations must leave the owner's row unchanged.
- Verify updates preserve city, pollen, completion time, versions, creation metadata, and fingerprint while changing only symptoms and `updatedAt`.
- Verify the updated record reconstructs the expected mixed-intensity ranking.
- Verify missing and foreign mutation targets produce identical route outcomes.
- Verify retrying the original save after an edit still resolves to the existing row rather than conflicting.
- The project test plan names cross-user read/update/delete as its highest ownership risk and explicitly rejects UI-only or repository-mock evidence ([test-plan.md:34](https://github.com/radecpro/allergy/blob/76b366b34e5cd627db431a04ed63f224a99c9cef/context/foundation/test-plan.md#L34)).

## Code References

- `app/routes.ts:9` - Registered history list and detail routes.
- `app/routes/history.$checkId.tsx:24` - Read-only detail loader and component.
- `app/domain/symptom-checks/types.ts:60` - Repository contract missing update/delete.
- `app/domain/symptom-checks/symptom-check-repository.server.ts:119` - Existing owner-scoped list/find SQL pattern.
- `app/domain/symptom-checks/symptom-check-route-handlers.server.ts:112` - Hardened save action pattern.
- `app/domain/symptom-checks/snapshot.ts:123` - Existing symptom validation.
- `app/domain/symptom-checks/snapshot.ts:225` - Ranking reconstruction from saved context.
- `app/db/schema.server.ts:30` - Persisted editable and immutable fields.
- `app/domain/symptom-checks/symptom-check-routes.test.ts:72` - Current save/list/detail route tests.
- `app/domain/symptom-checks/symptom-check-repository.integration.test.ts:113` - Current PostgreSQL ownership-read coverage.

## Architecture Insights

The established architecture has a useful boundary: route handlers authenticate and validate, repositories enforce ownership in SQL, and ranking remains a pure derived calculation. Update/delete should extend these boundaries rather than creating a parallel service or edit-specific persistence model.

The safest route shape is one action on the existing detail resource with an explicit intent. The safest persistence shape is one owner-qualified statement per mutation. A preliminary read followed by an unscoped mutation would introduce an avoidable authorization race and should not be used.

Keeping immutable context in separate columns means the feature does not require snapshot replacement. Updating only the symptom column also minimizes accidental authority granted to browser payloads.

## Historical Context (from prior changes)

- `context/archive/2026-06-10-email-password-account-access/plan.md` established revocation-aware protected routes and server-derived local user identity.
- `context/archive/2026-06-11-save-and-view-symptom-check/research.md` established private no-store responses, owner-scoped reads, and indistinguishable missing/foreign records.
- `context/archive/2026-06-11-save-and-view-symptom-check/plan.md` established the snapshot, repository, route/UI, and verification layering this change should extend.
- `context/archive/2026-06-14-per-symptom-intensity-ranking/plan.md` migrated saved records to per-symptom intensities and removed legacy `current-v1` data.
- `context/foundation/test-plan.md` requires real two-user evidence for read, update, and delete isolation. Its dedicated ownership/explicit-consent rollout remains pending until this slice is complete.

## Related Research

- `context/archive/2026-06-11-save-and-view-symptom-check/research.md`
- `context/archive/2026-06-14-per-symptom-intensity-ranking/research.md`
- `context/archive/2026-06-06-destination-allergen-risk-check/research.md`

## Open Questions

- Delete confirmation UX is not specified. Recommended default: an explicit confirmation step on the detail page, followed by redirect to `/history`.
- Database failure copy and retry behavior need Polish user-facing wording during planning.
- Roadmap metadata is inconsistent: S-03 is `proposed` in the summary but `done` in its detailed section, while this active change was newly created. Planning should treat the active change folder as authoritative and correct roadmap status during closeout.
