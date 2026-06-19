---
date: 2026-06-18T16:34:30+02:00
researcher: Codex
git_commit: 9fc7fb49b0ff2771f93859f863530bea6d4bc0a6
branch: develop
repository: allergy
topic: "device-location-current-check from context/foundation/roadmap.md"
tags: [research, codebase, current-location, current-symptoms, geolocation, city-search]
status: complete
last_updated: 2026-06-18
last_updated_by: Codex
---

# Research: device-location-current-check from context/foundation/roadmap.md

**Date**: 2026-06-18T16:34:30+02:00  
**Researcher**: Codex  
**Git Commit**: 9fc7fb49b0ff2771f93859f863530bea6d4bc0a6  
**Branch**: develop  
**Repository**: allergy

## Research Question

Research roadmap slice S-05, `device-location-current-check`: user can use current
device location for a symptom check with manual city selection preserved as
fallback.

## Summary

S-05 is not implemented yet. The current symptom-check flow is built around a
selected `CitySuggestion` from manual city autocomplete. That selected city
drives `/api/current-pollen`, ranking readiness, and the optional explicit-save
snapshot. Browser geolocation cannot plug into the existing API directly because
no route accepts latitude/longitude, and the existing `/api/current-pollen`
contract only accepts a Google `placeId`.

The lowest-friction implementation path is to make device location an additive
current-check control that resolves browser coordinates into the same
`CitySuggestion`-compatible selection boundary already used by manual search.
Permission denial, unsupported browser geolocation, timeout, reverse-geocoding
failure, and pollen lookup failure should set separate location status/error
state and leave manual city search fully usable. Coordinates should remain
transient: do not return, save, log, or snapshot precise latitude/longitude
unless a later plan explicitly changes the privacy boundary.

## Detailed Findings

### Current Symptom Check Flow

- The index route is the current symptom check screen (`app/routes.ts:4`).
- The route stores the chosen city as `CitySuggestion | null` in `selectedCity`
  (`app/routes/home.tsx:59`).
- Results are state-driven, not submit-driven: readiness requires a selected
  city and at least one complete symptom entry (`app/routes/home.tsx:72`), then
  ranking is derived with `rankCurrentSymptomAllergens` (`app/routes/home.tsx:79`).
- The route builds a save snapshot only when the selected city exists and every
  selected symptom has an intensity (`app/routes/home.tsx:89`). The snapshot
  stores city `placeId` and `label`, complete symptom entries, and pollen
  activity (`app/routes/home.tsx:94`).
- Selecting a city triggers pollen loading through `handleCitySelect`, updates
  `activePollenPlaceIdRef`, resets pollen state, and starts loading for non-null
  selections (`app/routes/home.tsx:150`).
- The selected city effect posts only `{ placeId: selectedCity.placeId }` to
  `/api/current-pollen`, ignores stale responses via `activePollenPlaceIdRef`,
  and aborts in-flight requests on city changes (`app/routes/home.tsx:109`).
- Pollen loading is visible in the results header (`app/routes/home.tsx:286`).
  Unknown or unavailable pollen renders a warning while preserving ranked
  results (`app/routes/home.tsx:305`).
- Saving remains explicit through `SymptomCheckSave`; the route passes the
  generated snapshot and disables save while pollen is loading
  (`app/routes/home.tsx:384`).

### Manual City Selection

- `CityCombobox` is a shared controlled component accepting `selectedCity` and
  `onSelect` (`app/components/city-combobox.tsx:10`).
- It owns manual query, suggestions, status, message, open state, and active
  suggestion index (`app/components/city-combobox.tsx:37`).
- Manual lookup is debounced by 250 ms and posts `{ query }` to
  `/api/city-search` when the trimmed query has at least two characters
  (`app/components/city-combobox.tsx:51`, `app/components/city-combobox.tsx:78`).
- Editing the text away from the selected city clears the selection by calling
  `onSelect(null)` (`app/components/city-combobox.tsx:62`).
- Choosing a suggestion calls `onSelect(suggestion)`, mirrors its label into the
  input, clears suggestions, and closes the listbox
  (`app/components/city-combobox.tsx:131`).
- The combobox already renders loading, unavailable, empty, and suggestion
  states, with Google attribution when suggestions are shown
  (`app/components/city-combobox.tsx:208`).
- The component displays either selected-city confirmation or helper text
  (`app/components/city-combobox.tsx:264`). This is the natural manual fallback
  anchor after geolocation failure.

### API And Provider Contracts

- Current location resource routes are explicit:
  `/api/city-search` and `/api/current-pollen` are registered in
  `app/routes.ts:11` and `app/routes.ts:12`.
- `/api/city-search` is POST-only, reads JSON, sanitizes `query`, returns an
  empty response for short/invalid input, and delegates to `searchGoogleCities`
  (`app/routes/api.city-search.ts:12`).
- `/api/current-pollen` is POST-only, reads JSON, sanitizes and validates
  `placeId`, geocodes the place ID, then looks up pollen for the geocoded
  coordinates (`app/routes/api.current-pollen.ts:18`).
- Public response shapes are app-owned:
  `CitySearchResponse = { status, suggestions, message? }` and
  `CurrentPollenResponse = { status, pollenActivity, message? }`
  (`app/domain/current-location/http.ts:18`).
- `CitySuggestion` contains `placeId`, display labels, optional country/admin
  context, and `isPolandPriority` (`app/domain/current-location/types.ts:11`).
  `SelectedCity` adds latitude/longitude but is only used behind the server
  geocoding/pollen boundary (`app/domain/current-location/types.ts:27`).
- Request guards cap request bodies at 1,024 bytes, city query length at 2 to
  80 characters, and place ID length at 256 with a restricted character pattern
  (`app/domain/current-location/http.ts:10`).
- All normal provider/input failures return HTTP 200 fallback JSON; only wrong
  method returns 405 (`app/domain/current-location/http.ts:99`).
- Google configuration uses a single `GOOGLE_MAPS_API_KEY` and fixed Places
  Autocomplete, Geocoding, and Pollen endpoints
  (`app/domain/google-maps/config.server.ts:13`).
- City search calls Places Autocomplete for `(cities)`, asks for Polish
  language/region context, optionally restricts to Poland, deduplicates by
  `placeId`, and sorts Polish suggestions first
  (`app/domain/current-location/google-city-search.server.ts:99`,
  `app/domain/current-location/google-city-search.server.ts:129`).
- Current pollen geocodes a selected `placeId` through Google Geocoding, then
  calls Google Pollen with latitude and longitude
  (`app/domain/current-location/google-place-geocoding.server.ts:49`,
  `app/domain/current-location/google-pollen.server.ts:130`).
- `lookupGooglePollen` already accepts latitude and longitude, so a future
  coordinate route can reuse the pollen adapter once it has a validated
  coordinate contract (`app/domain/current-location/google-pollen.server.ts:119`).

### Data And Privacy Boundaries

- Saved symptom snapshots are deliberately minimal: city `placeId` and `label`,
  symptoms, and pollen activity (`app/domain/symptom-checks/snapshot.ts:171`).
- Snapshot parsing accepts only `placeId` and `label` under `city`; latitude and
  longitude are not part of persisted saved-check context
  (`app/domain/symptom-checks/snapshot.ts:198`).
- `SymptomCheckSave` writes only after an explicit user action. Guest users store
  a pending snapshot in session storage and are sent to login; authenticated
  users submit the snapshot directly (`app/components/symptom-check-save.tsx:79`).
- Integration coverage already verifies that calling the current pollen route
  does not create a saved symptom check (`app/domain/symptom-checks/symptom-check-repository.integration.test.ts:443`).

### Testing Surface

- The risk plan names device-location fallback as risk #6: denial or failure
  must not block the complete manual-city path (`context/foundation/test-plan.md:39`).
- The recommended proof is denied, unavailable, and failed geolocation all
  leaving manual city selection fully usable; focused component integration is
  preferred unless browser permission behavior itself requires e2e
  (`context/foundation/test-plan.md:50`).
- Current-location tests cover pollen normalization, short city input, malformed
  and missing place IDs, missing API key fallback, URL/body privacy, GET
  rejection, malformed JSON, and oversized bodies
  (`app/domain/current-location/current-location.test.ts:37`,
  `app/domain/current-location/current-location.test.ts:77`,
  `app/domain/current-location/current-location.test.ts:134`).
- There are no current component/browser tests for `Home` or `CityCombobox`, so
  S-05 will likely need either a newly extracted focused UI boundary or a new
  component integration setup for geolocation fallback behavior.

## Code References

- `app/routes.ts:4` - Index route maps to the current symptom-check screen.
- `app/routes.ts:11` - Registers `/api/city-search`.
- `app/routes.ts:12` - Registers `/api/current-pollen`.
- `app/routes/home.tsx:59` - `selectedCity` state for current check.
- `app/routes/home.tsx:72` - Result readiness requires selected city and
  complete symptom entries.
- `app/routes/home.tsx:79` - Current symptom ranking computation.
- `app/routes/home.tsx:89` - Save snapshot creation gate.
- `app/routes/home.tsx:109` - Pollen lookup effect for selected city.
- `app/routes/home.tsx:150` - City selection transition boundary.
- `app/routes/home.tsx:223` - Manual `CityCombobox` mount.
- `app/routes/home.tsx:305` - Unknown/unavailable pollen warning that preserves
  result display.
- `app/components/city-combobox.tsx:10` - Shared city combobox props contract.
- `app/components/city-combobox.tsx:51` - Manual city search effect.
- `app/components/city-combobox.tsx:62` - Manual edit clears current selection.
- `app/components/city-combobox.tsx:131` - Suggestion selection callback.
- `app/routes/api.city-search.ts:12` - City search route action.
- `app/routes/api.current-pollen.ts:18` - Current pollen action factory.
- `app/domain/current-location/types.ts:11` - `CitySuggestion` app-owned shape.
- `app/domain/current-location/types.ts:27` - `SelectedCity` server geocoded shape.
- `app/domain/current-location/http.ts:10` - Request guard constants.
- `app/domain/current-location/google-pollen.server.ts:119` - Pollen lookup accepts
  latitude/longitude at the provider adapter boundary.
- `app/domain/symptom-checks/snapshot.ts:171` - Saved snapshot builder excludes
  precise coordinates.
- `app/components/symptom-check-save.tsx:79` - Explicit save action boundary.
- `context/foundation/test-plan.md:39` - Device-location fallback product risk.
- `context/foundation/test-plan.md:50` - Suggested evidence for location fallback.

## Architecture Insights

S-05 should keep one selected-city boundary. The current app already treats
`CitySuggestion` as the route-level location contract; both current and
destination flows use it, and `/api/current-pollen` expects a `placeId` derived
from that selection. Introducing a separate "coordinate-selected" branch inside
the route would duplicate readiness, result, and save logic. A better plan is to
resolve browser geolocation into a city-like selection, then call the existing
`handleCitySelect` path.

The missing backend concept is reverse resolution. A new endpoint could accept
bounded latitude/longitude from browser geolocation, resolve it to a nearby city
and app display label, and return a `CitySuggestion` plus pollen activity or a
status/message. Alternatively, `/api/current-pollen` could grow a coordinate
branch, but that would not by itself provide the city `placeId` and label needed
for saved snapshots. Because snapshots and UI currently require city identity,
a dedicated resolve-current-location contract is cleaner for planning.

Manual fallback must be independent state, not an error mode of the combobox.
Geolocation errors should not call `handleCitySelect(null)` unless the user
explicitly clears a selected location. This preserves any existing manual
selection and keeps the combobox fully operational after permission denial,
browser API absence, timeout, reverse-geocoding failure, or provider fallback.

Public endpoint cost risk remains relevant. `/api/current-pollen` is already a
known billable-call surface, and a coordinate endpoint may add reverse-geocoding
and pollen calls. Planning should explicitly decide whether S-05 includes abuse
controls such as caching, rate limits, or short-lived signed tokens, or records
the accepted MVP risk before public exposure.

## Historical Context (from prior changes)

- `context/archive/2026-06-05-guest-current-symptoms-check/plan.md:32` -
  Device geolocation was intentionally excluded from the original guest current
  symptoms slice; manual selection was the accepted path.
- `context/archive/2026-06-05-guest-current-symptoms-check/plan.md:238` -
  The original current-check contract says selected city changes request
  `/api/current-pollen`, keep the form usable while loading, and retain selected
  city with unknown pollen when provider lookup fails.
- `context/archive/2026-06-05-guest-current-symptoms-check/reviews/impl-review.md:54` -
  Prior review treated returned latitude/longitude as unnecessary UI exposure.
- `context/archive/2026-06-05-guest-current-symptoms-check/follow-ups/review-fixes.md:9` -
  `/api/current-pollen` can be abused as a billable proxy and still needs public
  exposure controls or explicit acceptance.
- `context/archive/2026-06-06-destination-allergen-risk-check/plan.md:77` -
  `CityCombobox` was extracted as the shared manual city-search component and
  must preserve debounce, short-input guard, accessible combobox/listbox roles,
  and Google attribution.
- `context/archive/2026-06-11-save-and-view-symptom-check/research.md:59` -
  Saved-check research recommended persisting place ID/display label rather than
  latitude/longitude.
- `context/archive/2026-06-14-per-symptom-intensity-ranking/plan.md:226` -
  Current-check readiness after S-04 requires complete per-symptom intensity,
  not a single route-level intensity.
- `context/archive/2026-06-10-risk-based-test-foundation/plan.md:80` -
  Current-location tests should remain deterministic and avoid live Google calls.

## Related Research

- `context/archive/2026-06-06-destination-allergen-risk-check/research.md` -
  Earlier research on shared city search and `/api/current-pollen` reuse.
- `context/archive/2026-06-11-save-and-view-symptom-check/research.md` -
  Saved symptom-check persistence and snapshot boundary research.
- `context/archive/2026-06-14-per-symptom-intensity-ranking/research.md` -
  Per-symptom intensity changes that now define current-check readiness.
- `context/foundation/test-plan.md` - Risk #6 and test strategy for device
  location fallback.

## Open Questions

- Should S-05 add a dedicated `/api/current-location` or `/api/resolve-location`
  endpoint that returns a `CitySuggestion`-compatible object, or extend
  `/api/current-pollen` with coordinate input?
- If browser coordinates resolve to an ambiguous or non-city location, should
  the UI auto-select the nearest city, show a confirmation choice, or fall back
  to manual search with a prefilled query?
- Should public exposure of S-05 include abuse controls for new coordinate-based
  provider calls, or should that operational risk be explicitly accepted for the
  MVP?
- What timeout should the browser geolocation request use, and should the app
  request high accuracy or prefer faster approximate city-level accuracy?
