# Per-Symptom Intensity Ranking - Plan Brief

> Full plan: `context/changes/per-symptom-intensity-ranking/plan.md`
> Research: `context/changes/per-symptom-intensity-ranking/research.md`

## What & Why

The current check applies one low/high intensity to every selected symptom, which cannot represent mixed symptom severity. This change gives every selected symptom its own required intensity and uses those individual values throughout ranking, saving, persistence, and history.
## Starting Point

The live route stores selected IDs plus one shared intensity, and the ranking domain multiplies matched symptom count by that value. Persistence already stores intensity per symptom, but snapshots and history only support the shared-intensity `current-v1` ranking contract.

## Desired End State

Selecting a symptom creates an explicit unassigned state until the user chooses low or high. Ranking and saving become available only when every selected symptom is assigned, and result cards show the assigned intensity beside matched symptoms. New and saved checks use the same `current-v2` scoring contract.

Existing saved checks and old pending browser drafts are intentionally removed rather than converted or retained.
## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Ranking input | One `{ symptomId, intensity }` entry per symptom | Removes the shared-intensity assumption from every consuming path | Research |
| Scoring | Sum matched intensity weights, then add pollen contribution | Preserves existing all-low/all-high outcomes while supporting mixed values | Research |
| Initial intensity | Require an explicit choice | Avoids silently recording inaccurate defaults | Plan |
| Deselection | Remove intensity; reselect unassigned | Keeps hidden state from surviving a visible removal | Plan |
| Result transparency | Show low/high beside matched symptoms | Explains ordering without exposing raw arithmetic | Plan |
| Ranking version | Replace with `current-v2` only | Product owner does not require legacy history | Plan |
| Existing checks | Delete all saved checks during rollout | Avoids compatibility and conversion work | Plan |
| Pending saves | Replace storage key and discard old drafts | Matches the accepted clean reset | Plan |
| UI testing | Pure selection-state tests plus manual browser checks | Fits the existing Node Vitest setup at low cost | Plan |
| Database shape | Keep existing schema | JSONB already stores individual symptom intensities | Research |

## Scope

**In scope:**
- Per-symptom low/high controls and explicit completeness.
- Mixed-intensity ranking and matched-intensity result labels.
- `current-v2` snapshot building, validation, saving, and reconstruction.
- New pending-save storage key.
- Destructive migration deleting existing symptom checks.
- Domain, save, repository, and history verification.

**Out of scope:**
- Legacy `current-v1` compatibility or data conversion.
- History-driven personalization.
- Raw score arithmetic in the UI.
- Saved-check editing.
- DOM/browser test infrastructure and changes to pollen normalization or likelihood thresholds.

## Architecture / Approach

The ranking domain owns a complete per-symptom input contract. A pure selection-state module manages unassigned and assigned entries for the home route. The same complete entries feed ranking and snapshot construction. Snapshots remain shape version `1` but use ranking version `current-v2`; JSONB persists entries unchanged, and history reconstructs through the same ranking helper.

A tracked custom Drizzle migration deletes legacy `symptom_checks` rows before the new application receives traffic. A new browser-storage key prevents old pending drafts from entering the new save path.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Ranking And Selection State | Mixed scoring plus deterministic explicit-assignment rules | A shared-intensity assumption survives in a helper |
| 2. Snapshots And Reset | Strict `current-v2`, new draft key, destructive data migration | Data deletion or rollback is misunderstood |
| 3. UI And Save Flow | Per-symptom controls, live ranking, mixed snapshots | Incomplete state enables ranking or saving |
| 4. Persistence And Release | JSONB round trips, history, deployment verification | Old and new revisions become data-incompatible |

**Prerequisites:** Existing Vitest and symptom-history foundations; a disposable PostgreSQL database for migration tests; explicit human approval before production data deletion.

**Estimated effort:** Approximately 3-4 implementation sessions across four phases, plus production migration and browser verification.

## Open Risks & Assumptions

- Deleting all existing saved checks and abandoning old pending drafts is an accepted product decision.
- The normal previous-revision rollback guarantee is waived. Rollback after `current-v2` writes needs backup restoration or deletion of incompatible rows.
- A verified database backup remains required before production deletion even though the data is not being retained in the product.
- Pure state tests protect interaction logic, but final control labeling, layout, and browser behavior still require manual verification.

## Success Criteria (Summary)

- Users assign low/high independently to every selected symptom, with no implicit defaults or stale reselection values.
- Live, pending, persisted, and history-reconstructed checks preserve identical mixed assignments and ranking.
- Legacy checks and drafts are removed through an explicitly approved, tested release sequence without deleting user accounts.
