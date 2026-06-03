# Allergen Ranking Contract Implementation Plan

## Overview

Implement the foundational allergen ranking and result-framing contract for Allergen Finder. This change creates a small TypeScript domain module that later current-symptom and destination flows can import without adding UI, persistence, auth, or external pollen API integration.

## Current State Analysis

The project is a fresh React Router full-stack TypeScript scaffold with one public index route and starter UI. There is no product data layer, no database, no API route behavior, no validation library, and no test runner yet. The roadmap marks this foundation as ready and explicitly warns against expanding it beyond the minimum needed to unlock the two launch flows.

## Desired End State

The app has a reusable `app/domain/allergen-ranking/` contract that defines the pollen-only MVP catalog, symptom/intensity input contract, pollen activity scale, current-symptom ranking result shape, destination activity output shape, and Polish user-facing labels/explanations. The contract supports simple rule-based current-symptom ranking, unranked destination pollen activity output, and graceful `unknown` pollen activity fallback. It is verified by TypeScript plus lightweight deterministic smoke checks.

### Key Discoveries:

- F-01 must provide a minimal allergen, symptom, pollen-activity, probability-label, and non-diagnostic explanation contract for both launch flows (`context/foundation/roadmap.md:50`).
- F-01 unlocks S-01 and S-02 and must verify that result language avoids diagnosis, treatment, and medication advice before user-facing flows ship (`context/foundation/roadmap.md:55`).
- The roadmap risk is overbuilding the contract into data completeness work before users can try the product (`context/foundation/roadmap.md:61`).
- The current app has no product data or persistence layer, and only the `build`, `dev`, `start`, and `typecheck` scripts exist (`package.json:5`).
- TypeScript is strict and supports the `~/*` alias for app-local modules, making `~/domain/allergen-ranking` a natural import boundary (`tsconfig.json:16`).
- The PRD requires symptom intensity to be only low/high, because a 1-5 scale was rejected as false precision (`context/foundation/prd.md:73`).
- Destination checks must work without reported symptoms or saved history, showing pollen activity and a brief explanation rather than personal symptom probability (`context/foundation/prd.md:85`).
- The whole app should be available in Polish; this contract should establish Polish user-facing display strings while keeping internal TypeScript identifiers stable in English.

## What We're NOT Doing

- No current-symptoms UI flow.
- No destination search UI flow.
- No database, migrations, saved history, or account-gated personalization.
- No external pollen or environmental API integration.
- No device-location implementation.
- No broad allergen catalog beyond pollen-focused MVP values.
- No medical diagnosis, medication advice, treatment recommendations, chatbot behavior, image analysis, health-device integration, long-term forecast, or predictive AI model training.
- No full test-runner setup unless later work needs it; this change uses smoke checks plus `npm run typecheck`.

## Implementation Approach

Create a small app-local TypeScript domain module under `app/domain/allergen-ranking/`. Keep internal IDs and exported type names in English for maintainability, but require every string meant for users to be Polish. Use a simple deterministic score for current-symptom ranking based on symptom match, low/high intensity, and known pollen activity. Use a separate destination helper that returns an unranked activity list with explanatory copy, because the first-use destination flow should not imply personal symptom likelihood without symptoms or history.

## Critical Implementation Details

### User-Facing Language

All display labels and explanation text emitted by this contract must be Polish. Internal TypeScript names may stay English, but exported objects should clearly separate stable IDs from Polish labels so future route modules do not hard-code English fallback copy.

### Result Framing

Current-symptom output may be ranked and labeled `high`, `medium`, or `low` internally, with Polish display labels such as `Wysokie`, `Średnie`, and `Niskie`. Destination output without symptoms/history must be an unranked pollen activity list and must frame the result as environmental activity, not personal symptom probability.

## Phase 1: Domain Contract & Polish Catalog

### Overview

Add the shared TypeScript contract and compact pollen-only catalog that both launch flows can import.

### Changes Required:

#### 1. Domain module folder

**File**: `app/domain/allergen-ranking/index.ts`

**Intent**: Create the public import surface for the allergen ranking domain. Future route modules should import from this index rather than deep-linking into implementation files.

**Contract**: Re-export the domain types, catalog constants, ranking helpers, destination helpers, and display-label maps from this folder.

#### 2. Domain types

**File**: `app/domain/allergen-ranking/types.ts`

**Intent**: Define the stable data contract for allergens, symptoms, intensity, pollen activity, current-symptom input, current-symptom ranked output, and destination activity output.

**Contract**: Include internal string unions or readonly ID arrays for `SymptomIntensity` (`low`, `high`), `PollenActivityLevel` (`unknown`, `low`, `moderate`, `high`, `very-high`), and `LikelihoodLevel` (`high`, `medium`, `low`). Output types must expose Polish display fields separately from internal IDs.

#### 3. Pollen-only catalog

**File**: `app/domain/allergen-ranking/catalog.ts`

**Intent**: Provide the smallest useful MVP allergen and symptom catalog for pollen-focused launch flows.

**Contract**: Include exactly these MVP allergen IDs: `grass-pollen`, `tree-pollen`, `weed-pollen`, and `ragweed-pollen`, plus Polish display labels and a compact predefined symptom list for current-symptom matching. Treat `weed-pollen` as non-ragweed weed pollen so `ragweed-pollen` can be shown separately without double-counting. Do not include food, contact, animal, medication, broad mold, or indoor dust-mite scope in this change.

#### 4. Polish display labels

**File**: `app/domain/allergen-ranking/labels.ts`

**Intent**: Centralize Polish user-facing strings for likelihood labels, pollen activity labels, symptom labels, allergen labels, and short guardrail text.

**Contract**: Every user-facing label emitted by the domain module must come from this file or from catalog display fields. Internal IDs remain English; display strings are Polish.

### Success Criteria:

#### Automated Verification:

- Domain exports compile through `npm run typecheck`.
- The catalog contains only pollen-focused MVP allergens and predefined symptoms.
- All likelihood and pollen activity display labels are available in Polish.

#### Manual Verification:

- Review the catalog and confirm it is intentionally small enough for F-01 and does not include parked allergen categories.
- Review the Polish labels for clarity and consistency with a consumer-facing app.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Ranking & Polish Result Framing

### Overview

Add the deterministic helpers that turn contract inputs into current-symptom ranked results or destination activity output while preserving non-diagnostic Polish framing.

### Changes Required:

#### 1. Current-symptom ranking helper

**File**: `app/domain/allergen-ranking/ranking.ts`

**Intent**: Rank likely allergens for the current-symptom flow using a simple, transparent rule-based score.

**Contract**: Accept selected symptom IDs, `low`/`high` intensity, and pollen activity by allergen ID. Return ranked results with internal likelihood (`high`, `medium`, `low`), pollen activity, Polish display labels, and short Polish explanations. `unknown` pollen activity must not block a result and must omit pollen contribution from scoring while using lower-confidence explanation copy.

**Scoring Contract**:

- Symptom match score: for each allergen, count selected symptoms that appear in that allergen's catalog symptom IDs.
- Intensity multiplier: `low` keeps the symptom match score as-is; `high` doubles the symptom match score.
- Pollen activity contribution: `unknown` = 0, `low` = 0, `moderate` = 1, `high` = 2, `very-high` = 3.
- Total score: `(matchedSymptomCount * intensityMultiplier) + pollenActivityContribution`.
- Likelihood thresholds: `high` for score `5+`, `medium` for score `3-4`, `low` for score `0-2`.
- Sort order: total score descending, then pollen activity contribution descending, then catalog order for stable ties.
- Include every pollen-focused MVP allergen in the ranked output so `unknown` activity or weak symptom matches still produce an explainable low-confidence result.

**Representative Examples**:

- Two matching symptoms, `high` intensity, and `high` pollen activity should produce `high` likelihood for that allergen.
- One matching symptom, `low` intensity, and `moderate` pollen activity should produce `low` likelihood.
- Two allergens with the same total score should keep catalog order after comparing pollen activity contribution.
- An allergen with matching symptoms and `unknown` pollen activity should remain in the output with likelihood based only on symptom score and lower-confidence Polish explanation copy.

#### 2. Destination activity helper

**File**: `app/domain/allergen-ranking/destination.ts`

**Intent**: Support the destination flow before symptoms or saved history exist.

**Contract**: Accept pollen activity by allergen ID and return an unranked list of allergen activity summaries. The output must not include personal likelihood labels unless future history-based inputs are added in a later change.

#### 3. Explanation framing

**File**: `app/domain/allergen-ranking/explanations.ts`

**Intent**: Keep explanation generation separate from scoring so wording can be reviewed for medical-safety guardrails.

**Contract**: Produce short Polish explanations for current-symptom results, destination activity summaries, and `unknown` pollen fallback. Wording must describe likely allergen context or environmental activity, not diagnosis, treatment, or medication advice.

### Success Criteria:

#### Automated Verification:

- Current-symptom ranking returns stable ordering for representative symptom, intensity, and pollen activity combinations.
- Destination helper returns an unranked activity list and does not emit personal likelihood labels.
- `unknown` pollen activity produces a result with lower-confidence Polish explanation copy instead of blocking the flow.
- Domain exports compile through `npm run typecheck`.

#### Manual Verification:

- Review current-symptom explanations and confirm they read as likelihood/context rather than diagnosis.
- Review destination explanations and confirm they describe environmental activity rather than personal symptom probability.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Verification Contract

### Overview

Add lightweight deterministic smoke checks so future changes can verify the contract without introducing a full test runner yet.

### Changes Required:

#### 1. Smoke verification script

**File**: `app/domain/allergen-ranking/smoke-check.ts`

**Intent**: Exercise the domain contract in representative scenarios that would otherwise regress silently.

**Contract**: Verify current-symptom likelihood labels, destination unranked output, `unknown` pollen fallback, Polish display string presence, and banned medical/treatment wording. The script should fail fast with readable errors and not depend on browser APIs.

#### 2. npm verification command

**File**: `package.json`

**Intent**: Give implementers and CI a simple command for the smoke checks.

**Contract**: Add `"verify:allergen-ranking": "vite-node app/domain/allergen-ranking/smoke-check.ts"` so the smoke-check TypeScript runs without a full test runner. Add `vite-node` as an explicit dev dependency if this command relies on it; do not rely on a transitive React Router/Vite dependency for a committed npm script.

#### 3. README or inline verification note

**File**: `context/changes/allergen-ranking-contract/plan.md`

**Intent**: Keep the verification command discoverable for the implementer through this plan's progress contract.

**Contract**: No separate documentation file is required; the command must be listed in automated success criteria and progress.

### Success Criteria:

#### Automated Verification:

- Smoke checks pass with `npm run verify:allergen-ranking`.
- Type checking passes with `npm run typecheck`.
- `npm audit --json` runs and any advisories are fixed or documented for release handoff.

#### Manual Verification:

- Review smoke-check scenarios and confirm they cover the accepted planning decisions.
- Confirm no user-facing English strings remain in the allergen ranking contract outputs.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No full test runner is configured for this change.
- Use the smoke-check script as deterministic domain coverage for current-symptom ranking, destination output, missing pollen fallback, Polish labels, and banned wording.

### Integration Tests:

- Not applicable for F-01 because no route, loader, API, database, or UI flow is implemented.
- S-01 and S-02 should add route-level verification after consuming this contract.

### Manual Testing Steps:

1. Read the exported domain contract and confirm it is understandable from route modules.
2. Review the pollen-only catalog and confirm it is intentionally MVP-sized.
3. Review Polish display labels and explanations for clarity.
4. Confirm destination output is activity-only and not personalized.
5. Confirm current-symptom copy avoids diagnosis, treatment, and medication advice.

## Performance Considerations

The catalog is intentionally small and in-memory. Ranking should be synchronous and deterministic, with no network, persistence, or browser dependencies. This keeps the future under-30-second MVP flow focused on UI and data-source latency rather than local ranking overhead.

## Migration Notes

No database or persisted data exists for this contract. There are no migrations. Later data-source integration should normalize provider pollen scales into this contract rather than changing route code to match provider-native values.

## References

- Roadmap F-01: `context/foundation/roadmap.md:50`
- Roadmap risk boundary: `context/foundation/roadmap.md:61`
- PRD current-symptom success criteria: `context/foundation/prd.md:36`
- PRD destination success criteria: `context/foundation/prd.md:37`
- PRD guardrails: `context/foundation/prd.md:43`
- PRD symptom/intensity requirements: `context/foundation/prd.md:71`
- PRD destination fallback: `context/foundation/prd.md:85`
- Current scripts: `package.json:5`
- TypeScript app alias: `tsconfig.json:16`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Domain Contract & Polish Catalog

#### Automated

- [ ] 1.1 Domain exports compile through `npm run typecheck`
- [ ] 1.2 Catalog contains only pollen-focused MVP allergens and predefined symptoms
- [ ] 1.3 All likelihood and pollen activity display labels are available in Polish

#### Manual

- [ ] 1.4 Catalog is intentionally small enough for F-01 and excludes parked allergen categories
- [ ] 1.5 Polish labels are clear and consistent with a consumer-facing app

### Phase 2: Ranking & Polish Result Framing

#### Automated

- [ ] 2.1 Current-symptom ranking returns stable ordering for representative inputs
- [ ] 2.2 Destination helper returns an unranked activity list without personal likelihood labels
- [ ] 2.3 Unknown pollen activity produces a lower-confidence Polish explanation instead of blocking flow
- [ ] 2.4 Domain exports compile through `npm run typecheck`

#### Manual

- [ ] 2.5 Current-symptom explanations read as likelihood/context rather than diagnosis
- [ ] 2.6 Destination explanations describe environmental activity rather than personal symptom probability

### Phase 3: Verification Contract

#### Automated

- [ ] 3.1 Smoke checks pass with `npm run verify:allergen-ranking`
- [ ] 3.2 Type checking passes with `npm run typecheck`
- [ ] 3.3 `npm audit --json` runs and advisories are fixed or documented

#### Manual

- [ ] 3.4 Smoke-check scenarios cover the accepted planning decisions
- [ ] 3.5 No user-facing English strings remain in allergen ranking contract outputs
