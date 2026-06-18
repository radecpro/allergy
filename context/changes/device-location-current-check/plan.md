# Device Location For Current Check Implementation Plan

## Overview

Add browser device-location support to the current symptom-check flow as a shortcut for selecting the current city. The locate-me path resolves browser coordinates through a new app-owned `/api/current-location` endpoint, returns the same `CitySuggestion` shape used by manual city search, and then reuses the existing selected-city, pollen lookup, ranking, and explicit-save behavior.

## Current State Analysis

The current symptom-check route uses one `CitySuggestion | null` state value as its location boundary. Manual city search selects that shape, selected-city changes trigger `/api/current-pollen`, and save snapshots persist only city `placeId` and `label`. Browser geolocation is not implemented, and no route currently accepts latitude/longitude.

The provider layer already has useful conventions: POST-only resource routes, small JSON request bodies, no-store responses, provider timeouts, app-owned response types, and deterministic Vitest coverage that avoids live Google calls. The missing capability is reverse-resolving browser coordinates into a city identity without exposing coordinates beyond the transient lookup.

## Desired End State

The current symptom-check screen offers manual city selection exactly as it works today, plus a locate-me button beside the text field. When a user grants browser location permission, the browser sends bounded coordinates to `/api/current-location`; the server resolves them into a `CitySuggestion`; the route sets that city through the same selection path as manual search; and the existing pollen lookup, ranking readiness, and save snapshot behavior continue unchanged.

Denied permission, unsupported geolocation, browser timeout, invalid coordinates, reverse-geocoding failure, and provider unavailability show an inline recovery message near the location controls and leave the manual city path fully usable. Precise latitude/longitude is never persisted, returned to the UI, placed in URLs, or added to saved symptom snapshots.

### Key Discoveries:

- The index route is the current symptom-check screen and owns `selectedCity` at `app/routes/home.tsx:59`.
- Selecting a city triggers the existing current-pollen fetch through the selected-city effect at `app/routes/home.tsx:109`.
- `handleCitySelect` is the correct transition boundary for both manual and locate-me selections at `app/routes/home.tsx:150`.
- `CityCombobox` owns manual search behavior and clears selection only when the user edits away from the selected label at `app/components/city-combobox.tsx:51`.
- `/api/current-pollen` accepts only `placeId`, not coordinates, at `app/routes/api.current-pollen.ts:18`.
- Request guards and public response helpers already live in `app/domain/current-location/http.ts:10`.
- `CitySuggestion` is the app-owned UI location shape at `app/domain/current-location/types.ts:11`.
- `lookupGooglePollen` already accepts coordinates below the server boundary at `app/domain/current-location/google-pollen.server.ts:119`.
- Saved snapshots persist city `placeId` and `label`, not coordinates, at `app/domain/symptom-checks/snapshot.ts:171`.
- The product test plan names denied or failed device location blocking manual city selection as risk #6 in `context/foundation/test-plan.md`.

## What We're NOT Doing

- No separate selected-coordinate model in the current route.
- No separate pollen lookup flow for geolocation.
- No automatic saving of location, symptoms, or history.
- No saved snapshot schema change and no coordinate persistence.
- No broad abuse-control infrastructure for all public Google-backed endpoints.
- No browser e2e stack unless focused Vitest coverage cannot prove the fallback behavior.
- No changes to destination search.
- No changes to ranking logic or per-symptom intensity behavior.

## Implementation Approach

Add a new server coordinate-resolution contract first, following the existing current-location route conventions. The endpoint accepts POST JSON with latitude and longitude, validates finite geographic bounds, reverse-geocodes the coordinates with Google, maps the best city-like result into `CitySuggestion`, and returns no-store JSON with app-owned status/message fields.

Then integrate a locate-me control into the current route beside `CityCombobox`. The control requests city-level browser geolocation with `enableHighAccuracy: false`, a short timeout, and a bounded cache age. Successful resolution calls the same `handleCitySelect` function used by manual selection. Failure states are independent of the combobox, so a failed locate-me attempt does not clear an existing selected city or disable manual search.

## Critical Implementation Details

### State sequencing

The locate-me success path must call `handleCitySelect(resolvedCity)` rather than setting pollen state directly. Locate-me failures must not call `handleCitySelect(null)`; clearing a selected city remains a manual text-edit behavior owned by `CityCombobox`.

### User experience spec

The locate-me button belongs next to the manual city field and must not replace the text input. Inline status copy should appear near the location controls so the fallback path is visible at the moment of failure.

## Phase 1: Server Coordinate Resolution Contract

### Overview

Create the backend contract that turns browser coordinates into the same city suggestion shape already used by manual city selection.

### Changes Required:

#### 1. Current-location domain types and HTTP helpers

**File**: `app/domain/current-location/types.ts`

**Intent**: Add app-owned result types for resolving device coordinates into a selected city without leaking Google response shapes into route or UI code.

**Contract**: Introduce a coordinate-resolution result whose successful branch contains `city: CitySuggestion` and whose failure branch uses the existing `CurrentLocationProviderStatus` plus a Polish user-facing message. Keep latitude/longitude out of the success payload returned to the client.

**File**: `app/domain/current-location/http.ts`

**Intent**: Extend the existing request guard and response-helper module for coordinate input and current-location resolution responses.

**Contract**: Add finite latitude/longitude sanitization and validation with world bounds, keep the existing 1,024-byte request body guard, return POST-only/no-store JSON responses, and expose a `CurrentLocationResponse` shape containing `status`, optional `city`, and optional `message`.

#### 2. Google reverse-geocoding adapter

**File**: `app/domain/current-location/google-current-location.server.ts`

**Intent**: Resolve validated browser coordinates to the best city-like Google geocoding result and map it into the existing `CitySuggestion` contract.

**Contract**: Use the existing Google Maps provider config and provider timeout. Request reverse geocoding with latitude/longitude, Polish language context, and map the selected result into `placeId`, `label`, `mainText`, optional `secondaryText`, optional `country`, optional `adminArea`, and `isPolandPriority`. Return `not-found` when no usable city-like result exists and `provider-unavailable` for failed provider calls.

#### 3. Current-location API route

**File**: `app/routes/api.current-location.ts`

**Intent**: Add a public resource action for coordinate resolution that mirrors the existing city-search/current-pollen route style.

**Contract**: Export a dependency-injected action factory for tests and a production `action`. Reject non-POST requests with 405, parse JSON through `readCurrentLocationRequestBody`, validate latitude/longitude, and return a `CurrentLocationResponse` with HTTP 200 for normal input/provider failures.

**File**: `app/routes.ts`

**Intent**: Register the new resource route.

**Contract**: Add `/api/current-location` without changing `/`, `/destination`, `/api/city-search`, or `/api/current-pollen`.

#### 4. Deterministic route and domain tests

**File**: `app/domain/current-location/current-location.test.ts`

**Intent**: Protect the new public contract and privacy boundary without live provider calls.

**Contract**: Add tests for malformed/missing coordinates, out-of-range coordinates, GET rejection, oversized body fallback, missing API key fallback, successful dependency-injected coordinate resolution, and response privacy. Assert coordinates stay in POST bodies and do not appear in returned JSON.

### Success Criteria:

#### Automated Verification:

- Current-location tests pass: `npm test -- app/domain/current-location/current-location.test.ts`
- Type checking passes: `npm run typecheck`

#### Manual Verification:

- None for this server-only phase.

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2 without manual confirmation because no user-visible UI is shipped yet.

---

## Phase 2: Locate-Me UI Integration

### Overview

Add the user-visible locate-me control to the current symptom-check screen while preserving manual city selection as the primary fallback path.

### Changes Required:

#### 1. Focused locate-me UI boundary

**File**: `app/components/current-location-control.tsx`

**Intent**: Encapsulate browser geolocation, `/api/current-location` fetch state, inline status messaging, and the locate-me button so fallback behavior can be tested cheaply.

**Contract**: Accept an `onResolve(city: CitySuggestion)` callback and optional disabled state. On click, request `navigator.geolocation.getCurrentPosition` with city-level options: `enableHighAccuracy: false`, timeout between 6 and 8 seconds, and a maximum cached age of a few minutes. On successful server response with a city, call `onResolve`. On browser or server failure, render a concise inline message and never clear the current selected city by itself.

#### 2. Current route layout and state wiring

**File**: `app/routes/home.tsx`

**Intent**: Place the locate-me button next to the existing manual city field and route successful resolution through the existing city-selection transition.

**Contract**: Render `CurrentLocationControl` adjacent to `CityCombobox` in the location area. Pass `handleCitySelect` as the resolve callback. Preserve all existing readiness, pollen loading, unknown pollen warning, ranking, and `SymptomCheckSave` behavior.

#### 3. Manual city selection compatibility

**File**: `app/components/city-combobox.tsx`

**Intent**: Make any minimal prop or layout adjustments needed for side-by-side rendering without changing manual search semantics.

**Contract**: Preserve debounced `/api/city-search`, suggestion rendering, keyboard behavior, selected-city helper text, Google attribution when Places suggestions are shown, and the existing rule that editing away from the selected label clears the selection.

#### 4. Client request/response handling

**File**: `app/domain/current-location/http.ts`

**Intent**: Reuse the app-owned `CurrentLocationResponse` type on the client side.

**Contract**: The locate-me UI consumes only `status`, `city`, and `message`. It must not expect or display precise latitude/longitude from the server response.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Existing current-location tests still pass: `npm test -- app/domain/current-location/current-location.test.ts`

#### Manual Verification:

- Clicking locate me with permission granted resolves a city, fills the selected-city state, and triggers the existing pollen loading indicator.
- Manual city typing, suggestion selection, and keyboard behavior still work after a successful locate-me selection.
- Manual city typing, suggestion selection, and keyboard behavior still work after locate-me denial, unsupported geolocation, timeout, or server failure.
- Saving a completed check created from locate-me stores only city label/place ID plus symptoms and pollen activity.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the visible locate-me flow and fallback behavior work in the browser before proceeding to Phase 3.

---

## Phase 3: Fallback Regression Coverage And Handoff Verification

### Overview

Add focused automated coverage for the named product risk and run the project handoff gates.

### Changes Required:

#### 1. Locate-me fallback tests

**File**: `app/components/current-location-control.test.tsx`

**Intent**: Prove the browser failure modes leave manual city selection recoverable without introducing an e2e stack.

**Contract**: Test unsupported `navigator.geolocation`, permission/error callback, geolocation timeout/error callback, failed `/api/current-location` response, successful resolved city callback, and repeated click/loading behavior. Use deterministic fakes for `navigator.geolocation` and `fetch`; do not call live providers.

#### 2. Current-check integration guard

**File**: `app/routes/home.tsx`

**Intent**: Keep the route integration small enough that focused component coverage remains meaningful.

**Contract**: If route size or repeated UI state grows beyond the local convention, split only local child components/helpers required to keep `home.tsx` maintainable. Do not refactor unrelated ranking, save, account nav, or symptom selector behavior.

#### 3. Release verification notes

**File**: `context/changes/device-location-current-check/plan.md`

**Intent**: Keep the implementation handoff explicit about the commands that must pass and the manual cases that must be verified.

**Contract**: Progress checkboxes are updated only by implementation skills after evidence exists. Accepted MVP risk is limited to broad public-provider abuse controls being out of scope for this slice; endpoint-level validation, POST/no-store, body-size guards, timeouts, and coordinate privacy are still required.

### Success Criteria:

#### Automated Verification:

- Locate-me component tests pass: `npm test -- app/components/current-location-control.test.tsx`
- Full test suite passes: `npm test`
- Type checking passes: `npm run typecheck`
- Dependency audit completes for release handoff: `npm audit --json`

#### Manual Verification:

- Browser smoke test passes for permission granted, denied, and skipped manual-selection paths.
- Existing guest current-symptoms flow remains complete without login.
- Existing destination flow still works and was not changed.
- The browser network panel shows coordinates only in the `/api/current-location` POST body and not in URLs.

**Implementation Note**: After completing this phase and all automated verification passes, pause for final manual confirmation before marking the change ready for implementation review or archive.

---

## Testing Strategy

### Unit Tests:

- Coordinate validation accepts finite latitude/longitude values within world bounds and rejects missing, malformed, non-finite, or out-of-range values.
- Reverse-geocoding normalization maps city-like provider payloads to `CitySuggestion` and returns deterministic fallback statuses for unusable payloads.
- Locate-me UI handles unsupported browser geolocation, geolocation error callbacks, server fallback responses, fetch failures, and success callbacks.

### Integration Tests:

- `/api/current-location` follows the existing resource route contract: POST-only, no-store JSON, bounded request body, app-owned response shape, no live providers in tests.
- Existing `/api/current-pollen` tests continue to prove selected-city pollen lookup behavior is unchanged.

### Manual Testing Steps:

1. Open `/`, click locate me, grant permission, and confirm the resolved city appears as the selected city.
2. Select at least one symptom and intensity after locate-me success and confirm pollen loading/results behave as they do after manual city selection.
3. Deny location permission and confirm the inline fallback message appears while manual city search still completes the check.
4. Use a browser/device where geolocation is unavailable or simulate server failure and confirm manual city search still works.
5. Save a completed locate-me check and confirm history displays city context without precise coordinates.
6. Open `/destination` and confirm destination city search still works.

## Performance Considerations

The browser request should use city-level geolocation options rather than high accuracy because pollen context is city-level and the resolved coordinates are not persisted. Server provider calls must keep the existing timeout pattern. The plan accepts that broad public billable-provider abuse controls remain outside S-05, but the new endpoint must still validate inputs, use POST/no-store, enforce body-size guards, and avoid coordinate logging or persistence.

## Migration Notes

No database migration is required. Saved symptom snapshot shape remains unchanged. Environment configuration continues to use the existing `GOOGLE_MAPS_API_KEY`; no new provider secret is introduced.

## References

- Related research: `context/changes/device-location-current-check/research.md`
- Product source: `context/foundation/roadmap.md:119`
- Test risk source: `context/foundation/test-plan.md:39`
- Current route state boundary: `app/routes/home.tsx:59`
- Current selected-city transition: `app/routes/home.tsx:150`
- Manual city combobox: `app/components/city-combobox.tsx:10`
- Current pollen route: `app/routes/api.current-pollen.ts:18`
- Current-location HTTP helpers: `app/domain/current-location/http.ts:10`
- Current-location types: `app/domain/current-location/types.ts:11`
- Saved snapshot privacy boundary: `app/domain/symptom-checks/snapshot.ts:171`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server Coordinate Resolution Contract

#### Automated

- [x] 1.1 Current-location tests pass: `npm test -- app/domain/current-location/current-location.test.ts` — 82e65d0
- [x] 1.2 Type checking passes: `npm run typecheck` — 82e65d0

### Phase 2: Locate-Me UI Integration

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck` — 86985dc
- [x] 2.2 Existing current-location tests still pass: `npm test -- app/domain/current-location/current-location.test.ts` — 86985dc

#### Manual

- [ ] 2.3 Clicking locate me with permission granted resolves a city, fills the selected-city state, and triggers the existing pollen loading indicator
- [ ] 2.4 Manual city typing, suggestion selection, and keyboard behavior still work after a successful locate-me selection
- [ ] 2.5 Manual city typing, suggestion selection, and keyboard behavior still work after locate-me denial, unsupported geolocation, timeout, or server failure
- [ ] 2.6 Saving a completed check created from locate-me stores only city label/place ID plus symptoms and pollen activity

### Phase 3: Fallback Regression Coverage And Handoff Verification

#### Automated

- [x] 3.1 Locate-me component tests pass: `npm test -- app/components/current-location-control.test.tsx` — 13618eb
- [x] 3.2 Full test suite passes: `npm test` — 13618eb
- [x] 3.3 Type checking passes: `npm run typecheck` — 13618eb
- [x] 3.4 Dependency audit completes for release handoff: `npm audit --json` — 13618eb

#### Manual

- [ ] 3.5 Browser smoke test passes for permission granted, denied, and skipped manual-selection paths
- [ ] 3.6 Existing guest current-symptoms flow remains complete without login
- [ ] 3.7 Existing destination flow still works and was not changed
- [ ] 3.8 The browser network panel shows coordinates only in the `/api/current-location` POST body and not in URLs
