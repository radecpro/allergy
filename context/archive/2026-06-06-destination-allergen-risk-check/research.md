---
date: 2026-06-06T11:14:48+02:00
researcher: Codex
git_commit: c806e024c4062340ecb5d5ba3c9386804dd56822
branch: develop
repository: allergy
topic: "Destination allergen risk check"
tags: [research, codebase, destination-flow, allergen-ranking, current-location]
status: complete
last_updated: 2026-06-06
last_updated_by: Codex
---

# Research: Destination allergen risk check

**Date**: 2026-06-06T11:14:48+02:00
**Researcher**: Codex
**Git Commit**: c806e024c4062340ecb5d5ba3c9386804dd56822
**Branch**: develop
**Repository**: allergy

## Research Question

Research the codebase for the `destination-allergen-risk-check` roadmap slice from `context/foundation/roadmap.md`: how should a guest destination city allergen/pollen risk check fit into the existing React Router app, domain contract, provider endpoints, and prior change decisions?

## Summary

S-02 is mostly ready to plan as a UI composition change. The core domain and provider pieces already exist: city autocomplete, selected-place pollen lookup, Google pollen normalization into the app-owned allergen activity scale, and a destination-specific `summarizeDestinationPollenActivity` helper. The destination flow should not reuse current-symptom ranking because first-use destination output must be activity-only and must avoid personal likelihood/probability wording.

The likely implementation path is a new route module such as `app/routes/destination-search.tsx`, registered in `app/routes.ts`, that reuses `/api/city-search` and `/api/current-pollen`, then renders `summarizeDestinationPollenActivity(payload.pollenActivity)` in Polish activity cards. The main planning choice is whether to duplicate the current city combobox locally, extract shared UI from the already-large home route, or accept short-term duplication for speed.

The main risk is operational rather than domain logic: `/api/current-pollen` is already documented as a public billable-call surface because a caller can send any syntactically valid `placeId` and trigger geocoding plus pollen lookup. S-02 will increase use of that endpoint, so planning should either handle abuse controls in this slice or explicitly keep the existing follow-up as a prerequisite before public release.

## Detailed Findings

### Product Scope

- The PRD requires travel preparation to work end-to-end: a user searches for a destination city and sees allergen/pollen risks and current pollen activity without reporting symptoms ([context/foundation/prd.md:37](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/foundation/prd.md#L37)).
- FR-003 makes destination city search and selection must-have ([context/foundation/prd.md:70](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/foundation/prd.md#L70)).
- FR-009 deliberately frames destination output as allergen and pollen risk, not personal symptom risk, when no symptoms are reported ([context/foundation/prd.md:82](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/foundation/prd.md#L82)).
- FR-011 requires destination pollen activity plus a brief explanation, without symptom probability, when there is no history ([context/foundation/prd.md:86](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/foundation/prd.md#L86)).
- Global guardrails still apply: no medical diagnosis, no medication/treatment advice, no implicit location or symptom history storage, and Polish user-facing copy ([context/foundation/prd.md:43](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/foundation/prd.md#L43)).
- The roadmap defines S-02 as `destination-allergen-risk-check`, dependent on F-01 and parallelizable with S-01 ([context/foundation/roadmap.md:80](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/foundation/roadmap.md#L80)).
- The roadmap's open S-02 unknown is destination search scope: city-only, city plus country, or another minimal disambiguation ([context/foundation/roadmap.md:88](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/foundation/roadmap.md#L88)).

### App Structure And UI Patterns

- Route registration is explicit and currently includes only the index route plus `/api/city-search` and `/api/current-pollen` ([app/routes.ts:3](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes.ts#L3)).
- The root layout is minimal: it imports global CSS, declares font links, and renders only `<Outlet />` for route content ([app/root.tsx:11](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/root.tsx#L11), [app/root.tsx:44](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/root.tsx#L44)).
- Styling is Tailwind v4 through `@import "tailwindcss"` and the Vite Tailwind plugin ([app/app.css:1](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/app.css#L1), [vite.config.ts:6](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/vite.config.ts#L6)).
- The current-symptoms home route owns route state, async fetches, combobox UI, symptom controls, and result rendering in one module ([app/routes/home.tsx:73](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L73)). It is already about 500 lines, so adding destination behavior to the same module would push against the repo's route-size guideline.
- The current city search interaction is already implemented as a debounced client fetch to `/api/city-search` ([app/routes/home.tsx:129](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L129), [app/routes/home.tsx:132](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L132)).
- Pollen lookup already runs after city selection by calling `/api/current-pollen?placeId=...` ([app/routes/home.tsx:162](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L162), [app/routes/home.tsx:172](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L172)).
- Existing result cards show personal likelihood and matched symptoms ([app/routes/home.tsx:463](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L463), [app/routes/home.tsx:473](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L473)). Destination cards need different rendering: pollen activity and environmental explanation only.

### Domain Contract

- F-01 defines a small pollen-only MVP catalog with four allergen IDs: grass, tree, non-ragweed weed, and ragweed pollen ([app/domain/allergen-ranking/types.ts:19](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/allergen-ranking/types.ts#L19), [app/domain/allergen-ranking/catalog.ts:4](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/allergen-ranking/catalog.ts#L4)).
- The contract already includes destination-specific input and output types ([app/domain/allergen-ranking/types.ts:73](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/allergen-ranking/types.ts#L73)).
- Current-symptom ranking uses symptom matches, low/high intensity, and pollen activity score ([app/domain/allergen-ranking/ranking.ts:42](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/allergen-ranking/ranking.ts#L42)). This helper should not drive first-use destination output because it emits likelihood fields.
- Destination output is already activity-only through `summarizeDestinationPollenActivity`, which keeps catalog order and returns allergen label, pollen activity label, and explanation ([app/domain/allergen-ranking/destination.ts:9](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/allergen-ranking/destination.ts#L9)).
- Destination explanations explicitly avoid personal probability wording and describe environmental activity or missing data context ([app/domain/allergen-ranking/explanations.ts:36](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/allergen-ranking/explanations.ts#L36)).
- The public barrel exports the destination helper and types, so route modules should import from `~/domain/allergen-ranking` instead of deep implementation paths ([app/domain/allergen-ranking/index.ts:5](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/allergen-ranking/index.ts#L5)).
- Existing smoke checks verify that destination output includes every MVP allergen, stays unranked, omits likelihood fields, and uses environmental wording ([app/domain/allergen-ranking/smoke-check.ts:124](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/allergen-ranking/smoke-check.ts#L124)).

### Provider And API Surface

- `/api/city-search` trims and validates the query, short-circuits invalid input, and returns app-owned suggestion JSON from the Google city search adapter ([app/routes/api.city-search.ts:10](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/api.city-search.ts#L10)).
- `/api/current-pollen` validates a selected `placeId`, geocodes it server-side, looks up pollen, and returns normalized `pollenActivity` plus fallback metadata ([app/routes/api.current-pollen.ts:11](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/api.current-pollen.ts#L11)).
- The public API response helpers define request guardrails and cache behavior: city queries are length-bounded, place IDs are length and character bounded, provider timeout is 4 seconds, successful pollen payloads cache for 300 seconds, and fallback payloads use `no-store` ([app/domain/current-location/http.ts:10](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/http.ts#L10), [app/domain/current-location/http.ts:116](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/http.ts#L116)).
- The Google city adapter uses Places Autocomplete, requests only fields needed for suggestions, uses Polish language/region settings, prioritizes Poland, and falls back to global suggestions when Polish results are insufficient ([app/domain/current-location/google-city-search.server.ts:5](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/google-city-search.server.ts#L5), [app/domain/current-location/google-city-search.server.ts:86](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/google-city-search.server.ts#L86), [app/domain/current-location/google-city-search.server.ts:142](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/google-city-search.server.ts#L142)).
- The Google geocoding adapter resolves the selected place ID into coordinates and display metadata needed by pollen lookup ([app/domain/current-location/google-place-geocoding.server.ts:30](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/google-place-geocoding.server.ts#L30)).
- The Google pollen adapter maps Google `GRASS`, `TREE`, `WEED`, and plant-level `RAGWEED` into the F-01 allergen IDs ([app/domain/current-location/google-pollen.server.ts:28](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/google-pollen.server.ts#L28)).
- Google pollen index values normalize into `unknown`, `low`, `moderate`, `high`, and `very-high`; missing or unusable data returns fallback statuses rather than blocking UI output ([app/domain/current-location/google-pollen.server.ts:50](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/google-pollen.server.ts#L50), [app/domain/current-location/google-pollen.server.ts:157](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/google-pollen.server.ts#L157)).
- `GOOGLE_MAPS_API_KEY` is read only from server-side config, and README documents required APIs and key restrictions ([app/domain/google-maps/config.server.ts:19](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/google-maps/config.server.ts#L19), [README.md:47](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/README.md#L47)).
- Current-location smoke checks cover Google pollen normalization, short city-search input, malformed/missing place IDs, and missing API key fallback ([app/domain/current-location/smoke-check.ts:52](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/smoke-check.ts#L52), [app/domain/current-location/smoke-check.ts:100](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/smoke-check.ts#L100)).

### Gaps For S-02

- There is no destination route module, tab, navigation, or dedicated destination UI state; only `context/changes/destination-allergen-risk-check/change.md` exists for this change.
- `app/routes.ts` has no destination page entry yet ([app/routes.ts:3](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes.ts#L3)).
- The home route imports and uses `rankCurrentSymptomAllergens`, not `summarizeDestinationPollenActivity` ([app/routes/home.tsx:3](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L3), [app/routes/home.tsx:95](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L95)).
- Destination-specific empty, loading, unavailable, and activity-card copy still needs to be written in Polish.
- Current Google attribution UI exists inside `home.tsx`, so a new destination route either needs to reuse/extract that small component or duplicate it carefully ([app/routes/home.tsx:57](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L57)).
- The endpoint name `/api/current-pollen` is semantically current-location oriented but technically accepts any selected place ID. Planning should decide whether S-02 reuses it directly or adds a clearer destination-named facade over the same provider logic.

## Code References

- [app/routes.ts:3](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes.ts#L3) - Explicit React Router route list; destination route registration belongs here.
- [app/routes/home.tsx:73](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L73) - Current-symptoms route component owns state, fetches, combobox, inputs, and results.
- [app/routes/home.tsx:129](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L129) - Existing debounced city search pattern.
- [app/routes/home.tsx:172](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/home.tsx#L172) - Existing selected-place pollen lookup pattern.
- [app/routes/api.city-search.ts:10](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/api.city-search.ts#L10) - City search resource route loader.
- [app/routes/api.current-pollen.ts:11](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/routes/api.current-pollen.ts#L11) - Pollen lookup resource route loader.
- [app/domain/allergen-ranking/destination.ts:9](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/allergen-ranking/destination.ts#L9) - Destination activity summary helper to use for S-02.
- [app/domain/allergen-ranking/explanations.ts:36](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/allergen-ranking/explanations.ts#L36) - Destination explanation wording.
- [app/domain/current-location/google-pollen.server.ts:70](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/google-pollen.server.ts#L70) - Google pollen forecast normalization.
- [app/domain/current-location/smoke-check.ts:52](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/app/domain/current-location/smoke-check.ts#L52) - Current-location smoke verification for provider normalization and fallback paths.

## Architecture Insights

The app is currently route-module heavy rather than component-library driven. For S-02, the cleanest near-term structure is likely a sibling route module with local child components if it grows beyond 150 lines. Shared extraction is useful only for real duplication: the city combobox and Google attribution are likely candidates, but result cards differ enough that destination should render its own activity-only cards.

The provider boundary is already app-owned. UI code should continue consuming `CitySuggestion`, `CurrentPollenResponse`, and `PollenActivityByAllergen`, not Google-native response shapes. That keeps the destination route independent of Google API details and lets future provider changes happen below `app/domain/current-location/`.

The domain boundary is also already suitable. S-02 should import `summarizeDestinationPollenActivity` from `~/domain/allergen-ranking` and avoid `rankCurrentSymptomAllergens`, `likelihoodLabels`, symptom IDs, and intensity controls. This preserves the first-use destination fallback decision from F-01.

The visible product pattern is Polish, compact, and guardrail-forward. Destination copy should say "aktywność" or "kontekst środowiskowy" rather than personal probability. It should not add treatment, medication, or diagnostic advice.

## Historical Context

- F-01 explicitly created the shared allergen ranking/result-framing contract for both current and destination launch flows ([context/changes/allergen-ranking-contract/plan.md:5](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/allergen-ranking-contract/plan.md#L5)).
- F-01 decided destination output should be an unranked pollen activity list and should not include personal likelihood labels until a later history-based input exists ([context/changes/allergen-ranking-contract/plan.md:141](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/allergen-ranking-contract/plan.md#L141)).
- F-01 planned unknown pollen fallback as a valid non-blocking state ([context/changes/allergen-ranking-contract/plan.md:122](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/allergen-ranking-contract/plan.md#L122)).
- The F-01 plan brief records the high-level decision: destination mode is an unranked activity list to avoid implying personal symptom likelihood without symptoms/history ([context/changes/allergen-ranking-contract/plan-brief.md:25](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/allergen-ranking-contract/plan-brief.md#L25)).
- S-01 introduced Google Places, Geocoding, and Pollen provider integration, resource routes, and current-location UI wiring ([context/changes/guest-current-symptoms-check/plan.md:41](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/guest-current-symptoms-check/plan.md#L41)).
- S-01 required Google attribution when Places predictions are displayed without a map ([context/changes/guest-current-symptoms-check/plan.md:55](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/guest-current-symptoms-check/plan.md#L55)).
- The S-01 implementation review left one pending follow-up: `/api/current-pollen` can be used as a billable proxy and needs server-side abuse controls before public exposure ([context/changes/guest-current-symptoms-check/reviews/impl-review.md:40](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/guest-current-symptoms-check/reviews/impl-review.md#L40), [context/changes/guest-current-symptoms-check/follow-ups/review-fixes.md:3](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/guest-current-symptoms-check/follow-ups/review-fixes.md#L3)).
- No archived prior change exists for this area; `context/archive/` contains only its README.

## Related Research

No prior `research.md` artifacts exist under `context/changes/**` or `context/archive/**` for this topic. Relevant planning artifacts are:

- [context/changes/allergen-ranking-contract/plan.md](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/allergen-ranking-contract/plan.md)
- [context/changes/guest-current-symptoms-check/plan.md](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/guest-current-symptoms-check/plan.md)
- [context/changes/guest-current-symptoms-check/reviews/impl-review.md](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/guest-current-symptoms-check/reviews/impl-review.md)
- [context/changes/guest-current-symptoms-check/follow-ups/review-fixes.md](https://github.com/radecpro/allergy/blob/c806e024c4062340ecb5d5ba3c9386804dd56822/context/changes/guest-current-symptoms-check/follow-ups/review-fixes.md)

## Open Questions

- Should S-02 create a separate `/destination` route, or should the product first screen become a two-mode experience with current symptoms and destination tabs? A separate route is cleaner for route size, while tabs may reduce navigation work.
- Should the shared city autocomplete UI be extracted before S-02, or is short-term duplication acceptable to keep the slice small?
- Should `/api/current-pollen` be reused as-is for destination lookup, renamed/generalized, or wrapped by a destination-named facade?
- Should the pending abuse-control follow-up for `/api/current-pollen` be included in S-02 before release, given destination search will increase endpoint exposure?
- What exact destination search scope is acceptable for MVP disambiguation: city-only display, city plus country/admin area, or another minimal format?
