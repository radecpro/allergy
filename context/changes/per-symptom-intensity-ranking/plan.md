# Per-Symptom Intensity Ranking Implementation Plan

## Overview

Replace the current shared symptom intensity with an explicit low/high value for every selected symptom. Ranking, saving, persistence, pending authentication handoff, and saved-history reconstruction will all consume the same per-symptom contract.

The product owner has accepted a destructive rollout for existing symptom-check data. The release will delete legacy saved checks and discard old pending browser drafts rather than retain `current-v1` compatibility.

## Current State Analysis

The current-check route stores selected symptom IDs separately from one nullable intensity and passes that scalar into both ranking and snapshot construction. The ranking domain multiplies the number of matched symptoms by the shared intensity weight.

Saved snapshots already store `{ symptomId, intensity }` entries in JSONB, so mixed intensity needs no structural schema change. However, only `current-v1` is accepted, and reconstruction rejects mixed entries. History list and detail routes recompute results from those saved inputs.

The default Vitest configuration runs Node-based `*.test.ts` files and excludes TSX and database integration suites. The cheapest useful UI protection is therefore an extracted pure state contract plus manual browser verification.

## Desired End State

Each selected symptom requires an explicit low/high assignment before ranking or saving becomes available. Deselecting a symptom removes its intensity, and reselecting it requires a new choice. Ranking sums each matched symptom's weight (`low = 1`, `high = 2`) and then adds the existing pollen contribution.

New snapshots use `current-v2`, preserve each assigned intensity through direct saves and guest authentication handoff, and reconstruct identically in history. Result cards identify the intensity attached to each matched symptom. Existing saved checks and old pending browser drafts are intentionally removed during rollout.

### Key Discoveries:

- The current ranking input still uses `selectedSymptomIds` plus one `intensity` (`app/domain/allergen-ranking/types.ts`).
- Ranking currently calculates `matchedSymptomIds.length * intensityMultiplier + pollenActivityScore` (`app/domain/allergen-ranking/ranking.ts`).
- The home route owns the shared intensity state, readiness condition, ranking input, and snapshot input (`app/routes/home.tsx`).
- Durable symptoms are already JSONB entries containing an individual intensity, so no table-shape migration is needed (`app/db/schema.server.ts`).
- Snapshot parsing accepts only `current-v1`, while reconstruction separately rejects mixed intensities (`app/domain/symptom-checks/snapshot.ts`).
- Pending saves are versioned by a browser-storage key and transport the full snapshot unchanged (`app/domain/symptom-checks/pending-snapshot.ts`).
- History list and detail both reconstruct rankings from stored snapshots (`app/routes/history.tsx`, `app/routes/history.$checkId.tsx`).
- The test plan identifies inconsistent overall-intensity assumptions as a high-likelihood product risk (`context/foundation/test-plan.md`).

## What We're NOT Doing

- No history-driven personalization of future checks.
- No change to symptom IDs, allergen catalog, pollen normalization, likelihood thresholds, or tie-breaking.
- No raw score arithmetic or contribution weights in the interface.
- No default intensity when a symptom is selected.
- No restoration of intensity after a symptom is deselected.
- No conversion or preservation of existing `current-v1` saved checks.
- No compatibility reader for old ranking versions after rollout.
- No DOM test environment, browser automation, or broad TSX test expansion.
- No editing of saved checks; that remains the later manage-saved-check slice.

## Implementation Approach

Define a ranking-domain symptom entry that contains a symptom ID and intensity, then use that shape across live ranking and snapshot construction. Extract pure selection state transitions from the route so readiness, assignment, deselection, ranking input, and snapshot input can be tested deterministically without a DOM environment.

Replace the ranking version with `current-v2` and make snapshot parsing strict to that version. Generate a tracked custom Drizzle migration and add a data-only `DELETE FROM symptom_checks` statement. Replace the pending browser-storage key so pre-release drafts are no longer loaded. Wire the route and history consumers to the new contracts, then verify mixed values through domain, save, storage, repository, and reconstruction paths.

## Critical Implementation Details

### Destructive Release Ordering

The migration must run as an explicitly approved release action before the `current-v2` application receives traffic. A database backup must be confirmed first even though the product owner has accepted deletion. The old application revision cannot read new `current-v2` rows, so rollback after traffic moves requires either restoring the pre-release backup or deleting post-release symptom-check rows before routing traffic back.

### User Experience Spec

Selecting a symptom creates an incomplete selected state, not a default intensity. Ranking and saving remain unavailable until every selected symptom has an assignment. Deselecting removes the whole entry, so reselecting requires a fresh choice. Each result card shows matched symptom labels with their low/high labels, without exposing numeric weights.

## Phase 1: Ranking And Selection State Contracts

### Overview

Introduce the per-symptom ranking contract and a pure route-state boundary that makes explicit assignment, reset, and readiness deterministic.

### Changes Required:

#### 1. Ranking input and result types

**File**: `app/domain/allergen-ranking/types.ts`

**Intent**: Replace the parallel selected-ID/shared-intensity input with one entry per selected symptom and expose intensity metadata for matched symptoms.

**Contract**: Add a ranking input entry containing `symptomId` and `intensity`; `CurrentSymptomRankingInput` accepts a readonly collection of those entries plus pollen activity. Extend ranked output with matched symptom entries containing stable ID, Polish label, intensity, and Polish intensity label. Preserve existing allergen, likelihood, pollen, score, and explanation fields unless a consumer no longer needs a duplicated legacy matched-label field.

#### 2. Per-symptom scoring

**File**: `app/domain/allergen-ranking/ranking.ts`

**Intent**: Score each matched symptom using its own intensity while preserving all existing pollen and ordering behavior.

**Contract**: Symptom contribution is the sum of `low = 1` and `high = 2` for entries matched by an allergen. Pollen contribution, likelihood thresholds, pollen tie-break, catalog-order tie-break, unknown-data behavior, and explanation safety remain unchanged. Uniform all-low or all-high inputs must produce the same scores as the former shared-intensity formula.

#### 3. Current-check selection state

**File**: `app/domain/allergen-ranking/current-symptom-selection.ts`

**Intent**: Isolate the interaction rules from React so route readiness and state transitions have one testable source of truth.

**Contract**: Represent selected symptoms with nullable or explicitly incomplete intensity state. Export pure operations/selectors for selecting a symptom, assigning its intensity, deselecting it, determining whether at least one symptom is selected and all are assigned, and producing complete ranking/snapshot entries. Deselecting must remove the entry; reselecting must create an unassigned entry.

#### 4. Ranking and selection tests

**File**: `app/domain/allergen-ranking/allergen-ranking.test.ts`

**Intent**: Protect the scoring rule with independent mixed-intensity oracles.

**Contract**: Add explicit mixed tests such as `blocked-nose: high` plus `watery-eyes: low`, with expected symptom-only scores of `2` for weed/ragweed and `1` for grass/tree before pollen contribution. Assert result ordering, matched intensity metadata, and unchanged uniform-input behavior without deriving expected values from production helpers.

**File**: `app/domain/allergen-ranking/current-symptom-selection.test.ts`

**Intent**: Protect the UI state contract at the cheapest deterministic layer.

**Contract**: Cover selection as incomplete, independent assignments, readiness only after every assignment, immediate output changes after intensity updates, removal on deselection, fresh unassigned state on reselection, and stable selected order.

### Success Criteria:

#### Automated Verification:

- Mixed low/high inputs produce explicit expected scores and ordering with `npm test -- app/domain/allergen-ranking/allergen-ranking.test.ts`.
- Selection-state tests pass with `npm test -- app/domain/allergen-ranking/current-symptom-selection.test.ts`.
- Uniform all-low and all-high inputs retain the previous scoring outcomes.
- Type checking passes with `npm run typecheck`.

#### Manual Verification:

- Review confirms the ranking contract contains one intensity per selected symptom and no shared intensity field.
- Review confirms no default or cached intensity can emerge from the pure state transitions.
- Review confirms result metadata exposes labels and intensities without exposing numeric contribution arithmetic.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Current-V2 Snapshots And Destructive Reset

### Overview

Make `current-v2` the only supported snapshot ranking version, discard old pending drafts, and add the approved destructive data migration.

### Changes Required:

#### 1. Snapshot version contract

**File**: `app/domain/symptom-checks/types.ts`

**Intent**: Align saved-check types with the per-symptom ranking contract.

**Contract**: Change the ranking version literal to `current-v2`. Keep snapshot shape version `1` because serialized fields are unchanged. Change `BuildCurrentSymptomSnapshotInput` to accept complete per-symptom entries rather than IDs plus a shared intensity.

#### 2. Snapshot build, parse, and reconstruction

**File**: `app/domain/symptom-checks/snapshot.ts`

**Intent**: Preserve mixed entries exactly and reconstruct them under the new scoring rule.

**Contract**: The builder copies complete symptom entries without applying a shared value. Parsing accepts only snapshot version `1` plus ranking version `current-v2`, retains duplicate/ID/intensity/bounds checks, and rejects `current-v1` or unknown versions. Reconstruction sends saved entries directly to the per-symptom ranking contract and no longer enforces uniform intensity.

#### 3. Snapshot tests

**File**: `app/domain/symptom-checks/snapshot.test.ts`

**Intent**: Replace transitional shared-intensity expectations with strict `current-v2` behavior.

**Contract**: Assert mixed entries survive build/parse/reconstruction unchanged, produce the documented ranking, and reject `current-v1`, unknown versions, malformed entries, duplicates, invalid pollen values, and invalid timestamps.

#### 4. Pending-save storage reset

**File**: `app/domain/symptom-checks/pending-snapshot.ts`

**Intent**: Ensure browser drafts created under the old contract are intentionally abandoned.

**Contract**: Replace the storage key with a new versioned key for the `current-v2` save contract. Read, write, and clear only the new key; do not fall back to the old key.

**File**: `app/domain/symptom-checks/pending-snapshot.test.ts`

**Intent**: Verify mixed entries survive the authentication handoff while legacy drafts are ignored.

**Contract**: Cover storing/restoring `current-v2` mixed entries, expiration and malformed cleanup under the new key, and the absence of old-key fallback.

#### 5. Data-only Drizzle migration

**File**: `drizzle/<generated>_reset_symptom_checks_for_current_v2.sql`

**Intent**: Delete existing saved checks before the application stops supporting `current-v1`.

**Contract**: Generate a tracked custom migration using Drizzle Kit's `generate --custom` workflow, then add only the approved deletion of all rows from `symptom_checks`. Do not drop the table, alter columns, delete users, or mutate schema objects. Commit the generated journal metadata with the migration.

### Success Criteria:

#### Automated Verification:

- Snapshot tests pass with `npm test -- app/domain/symptom-checks/snapshot.test.ts`.
- Pending-save tests pass with `npm test -- app/domain/symptom-checks/pending-snapshot.test.ts`.
- `current-v1` and unknown ranking versions are rejected before persistence or reconstruction.
- `npm run db:generate -- --custom --name=reset_symptom_checks_for_current_v2` produces a tracked custom migration.
- The generated SQL contains the approved symptom-check deletion and no schema or user-data changes.
- `npm run test:db` applies the complete migration chain to a disposable database.
- Type checking passes with `npm run typecheck`.

#### Manual Verification:

- Review confirms snapshot version remains `1` while ranking version becomes `current-v2`.
- Review confirms old pending-save keys are not read or migrated.
- Review confirms the custom migration deletes only `symptom_checks` rows.
- Human explicitly approves the destructive migration and acknowledges the rollback limitation.

**Implementation Note**: Do not apply this migration to production while implementing the phase. Production backup verification and migration execution remain approved release actions.

---

## Phase 3: Current-Check UI And Save Flow

### Overview

Replace the global intensity control with explicit controls for each selected symptom and carry the complete entries through ranking and saving.

### Changes Required:

#### 1. Per-symptom intensity controls

**File**: `app/components/symptom-intensity-selector.tsx`

**Intent**: Keep the already-large home route readable while rendering accessible low/high choices for every selected symptom.

**Contract**: Accept selected symptom state plus callbacks for assigning and deselecting. Render each selected symptom's Polish label and its own named low/high control group with stable accessible labels. Unassigned symptoms must be visibly incomplete. Do not select a default value.

#### 2. Home route state and readiness

**File**: `app/routes/home.tsx`

**Intent**: Drive live ranking and save availability from complete per-symptom state.

**Contract**: Replace `selectedSymptomIds` and shared `intensity` state with the extracted selection contract. Checkbox selection adds an unassigned symptom; deselection removes it. Render the per-symptom selector instead of the global fieldset. Results and snapshots require a city, at least one symptom, and a valid assignment for every selected symptom. Intensity changes recompute ranking immediately.

#### 3. Snapshot creation

**File**: `app/routes/home.tsx`

**Intent**: Ensure saving uses exactly the same symptom entries as live ranking.

**Contract**: Pass one complete per-symptom collection into ranking and `buildCurrentSymptomSnapshot`. Do not separately derive IDs and intensities or duplicate readiness logic.

#### 4. Result-card intensity display

**File**: `app/routes/home.tsx`

**Intent**: Make the effect of mixed intensity visible without exposing raw score arithmetic.

**Contract**: Under each result's matched-symptom section, render every matched symptom with its Polish low/high label. Preserve non-diagnostic wording, top-result treatment, pollen labels, and missing-data notice behavior.

#### 5. Save and pending-flow verification

**File**: `app/domain/symptom-checks/symptom-check-routes.test.ts`

**Intent**: Prove the server save boundary accepts and preserves mixed `current-v2` snapshots.

**Contract**: Add direct and pending-save cases whose repository arguments retain distinct symptom intensities. Keep authentication, trusted-origin, request-size, idempotency, and safe-error assertions intact.

### Success Criteria:

#### Automated Verification:

- Selection-state tests prove the route's readiness and reset rules.
- Save action tests preserve exact mixed symptom entries with `npm test -- app/domain/symptom-checks/symptom-check-routes.test.ts`.
- The default suite passes with `npm test`.
- Type checking passes with `npm run typecheck`.

#### Manual Verification:

- Selecting a symptom shows an unassigned low/high control and does not show results yet.
- Assigning every selected symptom enables ranking and saving.
- Changing one intensity immediately changes the relevant ranking without changing other assignments.
- Deselecting removes that symptom from controls, ranking, and snapshots; reselecting requires a new choice.
- Result cards show the low/high label beside each matched symptom.
- The layout remains usable with all symptoms selected on mobile and desktop.
- Guest save through login restores the exact mixed assignments under the new storage key.

**Implementation Note**: After completing this phase and all automated verification passes, pause for browser confirmation before proceeding.

---

## Phase 4: Persistence, History, And Release Verification

### Overview

Verify mixed entries through PostgreSQL and saved-history reconstruction, then document and exercise the destructive release sequence.

### Changes Required:

#### 1. Repository round-trip coverage

**File**: `app/domain/symptom-checks/symptom-check-repository.integration.test.ts`

**Intent**: Prove JSONB persistence does not flatten or normalize mixed intensities.

**Contract**: Add a `current-v2` fixture with at least one low and one high symptom. Verify create, list, and detail reads return the exact entries and ranking version. Preserve owner scoping, idempotency, explicit-save, and cleanup coverage.

#### 2. History reconstruction coverage

**File**: `app/domain/symptom-checks/snapshot.test.ts`

**Intent**: Protect the shared reconstruction boundary used by both history routes.

**Contract**: Assert a mixed persisted snapshot reconstructs the expected top result, score, ordering, and matched intensity metadata. Since old rows are deleted, no `current-v1` history expectation remains.

#### 3. History presentation

**File**: `app/routes/history.tsx`

**Intent**: Keep history-list ranking summaries working with `current-v2`.

**Contract**: Continue reconstructing the top result from the stored snapshot and render the existing summary, which already shows intensity per symptom. No legacy fallback or warning is required.

**File**: `app/routes/history.$checkId.tsx`

**Intent**: Render saved `current-v2` results consistently with the live result explanation.

**Contract**: Continue reconstructing all results and show matched symptom intensity labels where the detailed result displays matching evidence. Preserve private cache headers and non-diagnostic wording.

#### 4. Release and rollback documentation

**File**: `context/deployment/deploy-plan.md`

**Intent**: Record the one-time destructive release procedure and its rollback consequences.

**Contract**: Add a release note requiring verified backup status, human approval, the custom migration before traffic movement, no-traffic `current-v2` verification, and acknowledgment that old checks and pending drafts are intentionally removed. State that rollback after `current-v2` writes requires restoring the pre-release database backup or deleting incompatible symptom-check rows before returning traffic to the old revision.

### Success Criteria:

#### Automated Verification:

- The default deterministic suite passes with `npm test`.
- Type checking passes with `npm run typecheck`.
- The disposable PostgreSQL suite passes with `npm run test:db`.
- Repository integration proves exact mixed-entry round trips and owner isolation.
- A production build completes with `npm run build`.
- `npm audit --json` runs and advisories are fixed or documented for release handoff.

#### Manual Verification:

- History list and detail render a newly saved mixed-intensity check with the same ranking seen before saving.
- History is empty after applying the reset migration to a disposable database containing legacy checks.
- Existing users remain intact after the reset migration.
- Backup status and restore procedure are confirmed before production migration approval.
- Reviewer acknowledges that existing saved checks and old pending browser drafts will be permanently removed.
- No production traffic moves until the migration and no-traffic `current-v2` verification succeed.

**Implementation Note**: Production migration, backup/restore decisions, and traffic movement require explicit human approval.

---

## Testing Strategy

### Unit Tests:

- Mixed per-symptom score and ordering oracles.
- Uniform-input equivalence with previous scoring outcomes.
- Pure selection, assignment, completeness, deselection, and reselection transitions.
- Strict `current-v2` snapshot building, parsing, and reconstruction.
- New-key pending storage with mixed entries and no old-key fallback.
- Save action preservation of exact mixed entries.

### Integration Tests:

- Apply the complete migration chain to disposable PostgreSQL.
- Seed a legacy symptom check, apply the reset migration, and verify checks are deleted while users remain.
- Round-trip a mixed `current-v2` snapshot through create, list, and detail.
- Preserve owner scoping, explicit-save, idempotency, and conflict behavior.

### Manual Testing Steps:

1. Open `/`, select a city, then select one symptom without assigning intensity.
2. Confirm ranking and save remain unavailable and the symptom is visibly incomplete.
3. Assign low, add a second symptom, assign high, and confirm ranking appears.
4. Change one assignment and verify the result ordering or labels update immediately.
5. Deselect and reselect a symptom; confirm it returns unassigned.
6. Confirm every matched result symptom shows its low/high label.
7. Save directly while signed in and compare live and history ranking.
8. Save as a guest through login and confirm mixed assignments survive the new pending key.
9. Test with all symptoms selected at mobile and desktop widths.
10. Apply the reset migration to disposable legacy data and verify only saved checks are removed.

## Performance Considerations

The catalog contains six symptoms and four allergens, so summing per-entry weights is trivial. Keep state transformations synchronous and avoid introducing network requests or persistence side effects on intensity changes. Rendering all selected intensity controls should remain bounded by the fixed symptom catalog.

## Migration Notes

This change has no table-shape migration but intentionally includes a destructive data migration. Generate a custom tracked Drizzle migration and delete all rows from `symptom_checks`; do not drop or recreate the table.

Before production execution, confirm a usable database backup and obtain human approval. Apply the migration before moving traffic to the `current-v2` revision. Old browser drafts are discarded independently by changing the pending-save storage key.

The normal expand-and-contract rollback guarantee is explicitly waived for this release. Once the new revision has written `current-v2` checks, the previous revision is not data-compatible. Rollback requires restoring the pre-release backup or deleting incompatible symptom-check rows before sending traffic to old code.

## References

- Related research: `context/changes/per-symptom-intensity-ranking/research.md`
- Product requirements: `context/foundation/prd.md`
- Roadmap slice S-04: `context/foundation/roadmap.md`
- Risk guidance: `context/foundation/test-plan.md`
- Current ranking: `app/domain/allergen-ranking/ranking.ts`
- Current route state: `app/routes/home.tsx`
- Snapshot boundary: `app/domain/symptom-checks/snapshot.ts`
- Persistence schema: `app/db/schema.server.ts`
- Pending-save boundary: `app/domain/symptom-checks/pending-snapshot.ts`
- History consumers: `app/routes/history.tsx`, `app/routes/history.$checkId.tsx`
- Drizzle custom migration contract: `drizzle-kit generate --custom`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Ranking And Selection State Contracts

#### Automated

- [x] 1.1 Mixed low/high ranking tests pass with explicit score and ordering oracles — ade5aab
- [x] 1.2 Selection-state tests pass for assignment, readiness, deselection, and reselection — ade5aab
- [x] 1.3 Uniform inputs retain previous scoring outcomes — ade5aab
- [x] 1.4 Type checking passes — ade5aab

#### Manual

- [x] 1.5 Ranking contract has no shared intensity field — ade5aab
- [x] 1.6 State transitions cannot create default or cached intensity — ade5aab
- [x] 1.7 Result metadata exposes labeled intensities without numeric arithmetic — ade5aab

### Phase 2: Current-V2 Snapshots And Destructive Reset

#### Automated

- [x] 2.1 Snapshot tests pass for mixed current-v2 build, parse, and reconstruction
- [x] 2.2 Pending-save tests pass under the new storage key
- [x] 2.3 Current-v1 and unknown ranking versions are rejected
- [x] 2.4 Tracked custom reset migration is generated
- [x] 2.5 Reset SQL contains only the approved symptom-check deletion
- [x] 2.6 Database tests apply the complete migration chain
- [x] 2.7 Type checking passes

#### Manual

- [x] 2.8 Snapshot version remains 1 and ranking version becomes current-v2
- [x] 2.9 Old pending-save keys are not read or migrated
- [x] 2.10 Migration deletes only symptom-check rows
- [ ] 2.11 Human approves destructive migration and rollback limitation

### Phase 3: Current-Check UI And Save Flow

#### Automated

- [ ] 3.1 Selection-state tests prove route readiness and reset behavior
- [ ] 3.2 Save action tests preserve exact mixed symptom entries
- [ ] 3.3 Default test suite passes
- [ ] 3.4 Type checking passes

#### Manual

- [ ] 3.5 Newly selected symptoms remain incomplete until assigned
- [ ] 3.6 Ranking and saving require every selected symptom assignment
- [ ] 3.7 Intensity changes update ranking independently
- [ ] 3.8 Deselection removes state and reselection requires a fresh choice
- [ ] 3.9 Result cards show low/high labels for matched symptoms
- [ ] 3.10 All-symptom layout works on mobile and desktop
- [ ] 3.11 Guest login handoff preserves mixed assignments under the new key

### Phase 4: Persistence, History, And Release Verification

#### Automated

- [ ] 4.1 Default deterministic suite passes
- [ ] 4.2 Type checking passes
- [ ] 4.3 Disposable PostgreSQL suite passes
- [ ] 4.4 Repository tests prove exact mixed-entry round trips and owner isolation
- [ ] 4.5 Production build completes
- [ ] 4.6 Dependency audit is fixed or documented

#### Manual

- [ ] 4.7 Live and saved-history rankings match for a mixed check
- [ ] 4.8 Reset migration empties legacy history in a disposable database
- [ ] 4.9 Reset migration preserves user accounts
- [ ] 4.10 Backup status and restore procedure are confirmed
- [ ] 4.11 Reviewer acknowledges permanent removal of old checks and drafts
- [ ] 4.12 Migration and no-traffic verification finish before traffic movement
