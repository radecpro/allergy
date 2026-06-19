# Device Location For Current Check — Plan Brief

> Full plan: `context/changes/device-location-current-check/plan.md`  
> Research: `context/changes/device-location-current-check/research.md`

## What & Why

Add a locate-me shortcut to the current symptom-check flow so a user can use device location to select their current city. Manual city search remains a complete fallback when permission is denied, geolocation is unavailable, or lookup fails.

## Starting Point

The current check already has one canonical city state: `selectedCity: CitySuggestion | null`. Manual city selection drives `/api/current-pollen`, ranking readiness, and explicit-save snapshots, but no route currently accepts browser latitude/longitude.

## Desired End State

The current route shows a locate-me button next to the manual city input. On success, browser coordinates are sent to `/api/current-location`, resolved into a `CitySuggestion`, and passed through the same city-selection path as manual search. On failure, inline status explains the fallback and manual city selection remains fully usable.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Location state model | Reuse `CitySuggestion` and `selectedCity` | This preserves existing pollen lookup, ranking, and save behavior. | Research / Plan |
| API shape | Add `/api/current-location` | A dedicated coordinate-resolution route returns city identity without overloading `/api/current-pollen`. | Plan |
| Ambiguous location behavior | Auto-select best city-like result | Locate-me should be a fast shortcut; manual search remains fallback if resolution is not usable. | Plan |
| Failure UX | Inline message near location controls | The recovery path is visible without disrupting symptom entry. | Plan |
| Abuse controls | MVP endpoint guardrails only | Validation, POST/no-store, body caps, timeouts, and privacy fit S-05; broad provider abuse controls stay out of scope. | Plan |
| Browser geolocation | Fast city-level lookup | High precision is unnecessary because the app resolves to city-level pollen context. | Plan |
| Test depth | Route tests plus focused UI tests | This covers the named fallback risk without introducing a new browser e2e layer. | Research / Plan |

## Scope

**In scope:**

- New `/api/current-location` POST route.
- Coordinate validation and reverse-geocoding to `CitySuggestion`.
- Locate-me button beside the current city field.
- Inline success/failure/loading state for locate-me.
- Reuse of existing selected-city, pollen, ranking, and save snapshot paths.
- Deterministic route/domain tests and focused locate-me UI tests.

**Out of scope:**

- Separate coordinate-selected route state or pollen flow.
- Coordinate persistence or snapshot schema changes.
- Automatic saving.
- Broad abuse-control infrastructure for all public provider-backed endpoints.
- Destination search changes.
- New browser e2e test stack.

## Architecture / Approach

Browser geolocation stays client-side until the user clicks locate me. The client posts coordinates to `/api/current-location`; the server validates bounds, reverse-geocodes through Google using existing provider config/timeouts, maps the best city-like result to `CitySuggestion`, and returns no-store JSON. The route then calls the same `handleCitySelect` path used by `CityCombobox`, so downstream pollen lookup and saving remain unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Server Coordinate Resolution Contract | `/api/current-location`, response types, reverse-geocoding, route tests | Accidentally leaking coordinates or returning a shape that cannot drive existing state |
| 2. Locate-Me UI Integration | Button, browser geolocation, inline status, selected-city wiring | Failure states clearing city selection or blocking manual fallback |
| 3. Fallback Regression Coverage And Handoff Verification | Focused UI tests and full verification gates | Under-testing the PRD risk that denial/failure blocks manual completion |

**Prerequisites:** Existing `GOOGLE_MAPS_API_KEY` configuration for provider-backed local/manual testing.  
**Estimated effort:** ~2-3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- Google reverse-geocoding may return imperfect city identity near borders or rural areas; the plan auto-selects the best city-like result and falls back to manual search when unusable.
- Broad public billable-provider abuse controls remain an accepted MVP risk outside this slice.
- Focused Vitest tests are expected to cover fallback behavior; browser e2e remains deferred unless implementation reveals a gap lower layers cannot prove.

## Success Criteria (Summary)

- A granted locate-me request selects a city and continues through the existing pollen/ranking flow.
- Denied, unsupported, timed-out, or failed locate-me attempts leave manual city search fully usable.
- Saved checks created after locate-me contain only city label/place ID, symptoms, and pollen activity, never precise coordinates.
