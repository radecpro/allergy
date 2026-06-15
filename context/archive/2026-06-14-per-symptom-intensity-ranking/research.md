---
date: 2026-06-14T10:15:03+02:00
researcher: codex
git_commit: d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4
branch: develop
repository: allergy
topic: "Per-symptom intensity ranking across UI, persistence, and saved checks"
tags: [research, codebase, allergen-ranking, symptom-checks, persistence]
status: complete
last_updated: 2026-06-14
last_updated_by: codex
---

# Research: Per-Symptom Intensity Ranking

**Date**: 2026-06-14T10:15:03+02:00
**Researcher**: codex
**Git Commit**: d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4
**Branch**: develop
**Repository**: allergy

## Research Question

Ground roadmap slice S-04, `per-symptom-intensity-ranking`: identify how
individual low/high symptom intensities should flow through the current-check
UI, ranking logic, explicit saving, persistence, and saved-history
reconstruction while keeping existing records readable.

## Summary

The live current-symptoms flow still stores one shared intensity and the ranking
domain applies one multiplier to the number of matched symptoms. S-04 must
replace that parallel `selectedSymptomIds + intensity` contract with symptom
entries shaped as `{ symptomId, intensity }`, then score an allergen by summing
the weights of its matched symptom entries before adding the existing pollen
contribution.

Persistence is already prepared for this change. Saved snapshots store
intensity per symptom in JSONB, and the database has separate snapshot and
ranking-version columns. A database migration is not required for mixed
intensities. The compatibility boundary is `rankingVersion`: existing
`current-v1` records must retain shared-intensity scoring, while new snapshots
need a new ranking version and version-dispatched reconstruction.

The main cross-system defect risk is already present: snapshot parsing accepts
mixed intensities, but `current-v1` reconstruction throws when it encounters
them. Version-aware validation must reject mixed `current-v1` snapshots while
accepting mixed entries for the new ranking version.

“Personalized” is limited to the symptoms entered in the current check. Saved
history must remain display-only and must not influence future rankings.

## Detailed Findings

### Ranking Domain

`CurrentSymptomRankingInput` currently carries selected symptom IDs and one
scalar intensity ([types.ts:54](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/allergen-ranking/types.ts#L54)).
The ranking helper resolves one multiplier, counts each allergen's matched
symptoms, and computes:

`matched symptom count * shared intensity multiplier + pollen contribution`

([ranking.ts:42](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/allergen-ranking/ranking.ts#L42),
[ranking.ts:58](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/allergen-ranking/ranking.ts#L58)).

The existing transparent weights are `low = 1`, `high = 2`; pollen remains
`unknown/low = 0`, `moderate = 1`, `high = 2`, and `very-high = 3`
([ranking.ts:13](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/allergen-ranking/ranking.ts#L13)).
The additive S-04 rule that preserves uniform-input behavior is:

`sum(weight of each matched symptom) + pollen contribution`

This makes all-low and all-high inputs produce the same scores as `current-v1`
while allowing mixed inputs to affect ranking. Likelihood thresholds, pollen
normalization, stable tie-breaking, Polish labels, and non-diagnostic
explanations can remain unchanged.

The ranked-result contract exposes matched symptom IDs and labels but not their
intensities or score contributions
([types.ts:60](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/allergen-ranking/types.ts#L60)).
S-04 does not require exposing internal arithmetic, but any UI explanation of
why intensity changed an ordering would require extending this output contract.

### Current-Check UI

The home route stores `selectedSymptomIds` separately from one nullable
`intensity`
([home.tsx:62](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/routes/home.tsx#L62)).
Results and saving both require that scalar and pass it into ranking and
snapshot construction
([home.tsx:72](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/routes/home.tsx#L72),
[home.tsx:78](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/routes/home.tsx#L78),
[home.tsx:89](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/routes/home.tsx#L89)).

The interface renders symptom checkboxes followed by one global intensity radio
group
([home.tsx:228](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/routes/home.tsx#L228),
[home.tsx:256](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/routes/home.tsx#L256)).
S-04 needs one intensity control associated with every selected symptom. The UI
state must make an incomplete assignment explicit so results and Save are not
enabled until every selected symptom has a valid intensity.

The state transition policy needs deliberate handling:

- selecting a symptom must initialize or request its intensity;
- changing one intensity must immediately recompute ranking;
- deselecting a symptom must remove its intensity from ranking and snapshots;
- reselecting behavior must be defined rather than emerging accidentally from
  stale React state.

The pollen API and provider normalization do not accept symptom intensity and
are outside the required change.

### Snapshot And Persistence

The durable representation already models each saved symptom as
`{ symptomId, intensity }`
([types.ts:12](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/symptom-checks/types.ts#L12)).
The current builder only copies the shared scalar onto every selected symptom
([snapshot.ts:169](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/symptom-checks/snapshot.ts#L169)).

The database stores symptoms as JSONB and stores snapshot and ranking versions
in separate columns
([schema.server.ts:30](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/db/schema.server.ts#L30)).
The repository writes those values without flattening per-symptom intensity.
Therefore, mixed intensities need no schema migration unless the implementation
adds queryable/indexed intensity columns or database constraints.

`snapshotVersion` describes the serialized shape, while `rankingVersion`
describes scoring semantics
([types.ts:9](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/symptom-checks/types.ts#L9)).
Because the shape already supports per-entry intensity, snapshot version 1 can
remain valid. New snapshots should use a new ranking version, while decoding
continues to support `current-v1`.

Parsing currently permits different valid intensities between symptom entries
([snapshot.ts:123](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/symptom-checks/snapshot.ts#L123)),
but accepts only `current-v1` and reconstruction then rejects mixed values
([snapshot.ts:190](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/symptom-checks/snapshot.ts#L190),
[snapshot.ts:228](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/symptom-checks/snapshot.ts#L228)).
This permits a crafted mixed `current-v1` snapshot to pass save validation and
fail later during history reconstruction. Validation must enforce invariants by
ranking version:

- `current-v1`: supported for reads and requires one shared intensity;
- new ranking version: accepts independent symptom intensities and uses the new
  scoring rule;
- unknown ranking versions: remain rejected.

### Save, Authentication Handoff, And History

The save component serializes the complete snapshot, and the server action
reparses it before the repository write. The guest authentication handoff stores
the same snapshot in tab-local `sessionStorage`. These transports are already
structurally capable of carrying mixed intensities.

The pending snapshot key is branded `v1`
([pending-snapshot.ts:4](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/symptom-checks/pending-snapshot.ts#L4)).
Deployment must not strand an in-progress old pending save. The least disruptive
option is to retain the key while the parser supports both ranking versions, or
temporarily read both old and new keys if the key changes.

History list and detail recompute ranking from stored inputs instead of storing
ranked output
([history.tsx:67](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/routes/history.tsx#L67),
[history.$checkId.tsx:39](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/routes/history.$checkId.tsx#L39)).
Both paths depend on version-dispatched reconstruction. The shared summary
component already renders each symptom's own intensity and does not need a data
shape change
([symptom-check-summary.tsx:37](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/components/symptom-check-summary.tsx#L37)).

Backward compatibility is mandatory because existing saved records must remain
readable, and production rollback must preserve compatibility across the current
and previous application revisions
([prd.md:151](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/context/foundation/prd.md#L151),
[infrastructure.md:101](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/context/foundation/infrastructure.md#L101)).

### Test Surface

The documented risk is that some path keeps assuming one overall intensity.
The test plan calls for mixed low/high inputs through every consuming path,
using unit plus focused integration coverage
([test-plan.md:37](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/context/foundation/test-plan.md#L37),
[test-plan.md:48](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/context/foundation/test-plan.md#L48)).

Current ranking tests cover only uniform low or high intensity
([allergen-ranking.test.ts:50](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/allergen-ranking/allergen-ranking.test.ts#L50)).
Snapshot tests explicitly codify the transitional shared-intensity behavior and
expect mixed reconstruction to throw
([snapshot.test.ts:27](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/symptom-checks/snapshot.test.ts#L27),
[snapshot.test.ts:118](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/app/domain/symptom-checks/snapshot.test.ts#L118)).

Vitest currently runs Node `*.test.ts` files and excludes `*.test.tsx`
([vitest.config.ts:10](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/vitest.config.ts#L10)).
Interactive UI verification therefore needs either a focused DOM-capable Vitest
configuration or an extracted pure state/component boundary test. A broad E2E
layer is not justified for this slice.

Cheapest useful protection:

1. Domain unit tests with explicit mixed-intensity score and order oracles.
2. Compatibility tests proving uniform per-symptom inputs match `current-v1`.
3. Snapshot tests for version-aware validation and reconstruction.
4. Save action and pending-snapshot tests preserving exact mixed entries.
5. Repository integration tests proving mixed entries round-trip unchanged.
6. One focused interactive UI test proving independent controls update ranking
   and the save snapshot.
7. History list/detail tests proving old and new ranking versions remain
   readable and render the expected ranking.

A strong independent oracle is `blocked-nose: high` plus `watery-eyes: low`
with low pollen activity. Expected symptom-only scores are `2` for weed and
ragweed and `1` for grass and tree. This catches implementations that apply
either selected intensity globally without deriving expectations from
production code.

## Architecture Insights

- Ranking semantics are a versioned domain contract, not just an internal helper
  implementation. Preserve `current-v1` and add an explicit new version.
- Snapshot shape and ranking semantics evolve independently. Do not increment
  the snapshot version when the serialized fields are unchanged.
- The existing `SavedSymptomEntry` is the natural shared input contract for
  live ranking, snapshot construction, and reconstruction. If ownership
  boundaries make direct reuse undesirable, use an equivalent ranking-domain
  type rather than returning to parallel arrays.
- Keep old-record decoding separate from new-record creation. New checks should
  always emit the new ranking version; old checks should never be silently
  reinterpreted under changed scoring.
- No database migration is required for the requested behavior. Adding one
  would increase rollout and rollback risk without adding signal.
- Saved history is an input snapshot for reproduction, not a personalization
  source for future checks.

## Historical Context

The original ranking contract deliberately used a transparent shared-intensity
formula
([archived plan:124](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/context/archive/2026-06-03-allergen-ranking-contract/plan.md#L124)).

The saved-check slice anticipated S-04 by persisting intensity on every symptom
entry and copying the current shared value into each entry. It explicitly chose
not to persist generated scores or ranked arrays so history could reconstruct
results from versioned inputs
([save research:43](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/context/changes/save-and-view-symptom-check/research.md#L43)).

The PRD requires per-symptom intensity but explicitly rejects history-driven
ranking personalization
([prd.md:97](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/context/foundation/prd.md#L97),
[prd.md:180](https://github.com/radecpro/allergy/blob/d9a6ef9dc05f60f3dfc3bcb2971d85e9fb1373d4/context/foundation/prd.md#L180)).

## Related Research

- `context/changes/save-and-view-symptom-check/research.md` - snapshot,
  ownership, explicit-save, and history reconstruction boundaries.
- `context/archive/2026-06-06-destination-allergen-risk-check/research.md` -
  pollen normalization and destination-flow boundaries unaffected by S-04.

## Open Questions

1. What should the new ranking version be named? A value such as
   `current-v2` is consistent with the existing contract.
2. When a symptom is first selected, should intensity default to `low`, default
   to `high`, or remain unset until the user chooses? Leaving it unset is the
   most explicit but adds interaction cost.
3. If a symptom is deselected and reselected in the same session, should its
   previous intensity be restored or reset?
4. Should result explanations display which matched symptoms were high versus
   low, or is automatic ranking change sufficient for S-04?
5. Should the pending-save storage key remain unchanged while supporting both
   ranking versions, or should deployment temporarily read two keys?
