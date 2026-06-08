# Destination Allergen Risk Check Implementation Plan

## Overview

Build the travel-preparation flow for Allergen Finder. A guest user can switch from the current-symptoms flow to a destination mode, search for a destination city, and see current destination pollen activity for every MVP allergen without reporting symptoms or using saved history.

## Current State Analysis

The app already has the main ingredients for S-02. The home route implements city autocomplete, selected-place pollen lookup, and fallback UI inline, but it is about 500 lines and should not absorb a second product mode. The domain contract already includes `summarizeDestinationPollenActivity`, which returns activity-only destination summaries with no personal likelihood fields. The resource routes `/api/city-search` and `/api/current-pollen` already expose app-owned city and pollen JSON, but `/api/current-pollen` remains a public billable-call surface and must be treated as a release blocker before public exposure.

## Desired End State

The app has a route-backed top mode switch with "Aktualne objawy" at `/` and "Podróż" at `/destination`. Both routes share a city combobox and Google attribution treatment. The destination route fetches pollen for the selected destination through the existing app-local endpoints, renders all destination activity summaries in Polish, and clearly frames results as environmental context rather than diagnosis or personal symptom probability.

### Key Discoveries:

- Route registration is explicit and currently includes the index route plus `/api/city-search` and `/api/current-pollen` (`app/routes.ts:3`).
- The home route owns city search, pollen lookup, form state, and result rendering in one large module (`app/routes/home.tsx:73`).
- The current combobox uses a 2-character threshold, 250 ms debounce, `AbortController`, accessible combobox/listbox roles, and Google attribution in the suggestion popover (`app/routes/home.tsx:22`, `app/routes/home.tsx:129`, `app/routes/home.tsx:267`, `app/routes/home.tsx:336`).
- The current route already calls `/api/current-pollen?placeId=...` after city selection (`app/routes/home.tsx:172`).
- Destination output should use `summarizeDestinationPollenActivity`, which preserves catalog order and emits activity labels and environmental explanations (`app/domain/allergen-ranking/destination.ts:9`).
- Destination explanations explicitly avoid personal probability wording (`app/domain/allergen-ranking/explanations.ts:36`).
- The allergen smoke check already verifies destination output includes every MVP allergen, omits likelihood fields, and uses environmental wording (`app/domain/allergen-ranking/smoke-check.ts:124`).
- `/api/current-pollen` validates a selected `placeId`, geocodes it server-side, calls the pollen provider, and returns normalized activity (`app/routes/api.current-pollen.ts:11`).
- The pending S-01 follow-up documents `/api/current-pollen` as a billable proxy that needs cache/rate-limit/token controls before public exposure (`context/changes/guest-current-symptoms-check/follow-ups/review-fixes.md:3`).

## What We're NOT Doing

- No symptom input, intensity input, current-symptom ranking, matched-symptom display, or personal likelihood labels in destination mode.
- No saved symptom history or history-based travel probability.
- No account creation, login gate, database, persistence, or location history storage.
- No new pollen provider or provider-native UI data shape.
- No rename of `/api/current-pollen` in this slice.
- No public-release abuse-control implementation in this slice; it remains an explicit release blocker.
- No medication, treatment, diagnosis, or Google health recommendation copy.

## Implementation Approach

Keep the user experience as one product with a visible mode switch, but keep implementation split by route. Extract the reusable city autocomplete and Google attribution behavior from the large home route into shared components, add a route-backed mode switch, then create a sibling destination route. The destination route reuses `/api/city-search` and `/api/current-pollen`, converts returned `pollenActivity` through `summarizeDestinationPollenActivity`, and always renders the full MVP allergen list with clear fallback copy when provider data is unavailable or partially unknown.

## Critical Implementation Details

### Route-Backed Mode Switch

The mode switch is part of the product navigation, not local tab state. It should link `/` and `/destination` so each route module stays small and can own only the state for its flow.

### Destination Copy Boundary

Destination cards must describe pollen activity and environmental context only. They must not import or render likelihood labels, symptom matches, `rankCurrentSymptomAllergens`, or any wording that implies personal symptom probability without history.

### Release Blocker

S-02 may reuse `/api/current-pollen`, but the plan must keep the existing abuse-control follow-up visible as a public-release blocker. Implementation can be accepted locally before that blocker is solved, but public exposure should wait for a separate cache/rate-limit/token control change.

## Phase 1: Shared Mode Navigation & City Combobox

### Overview

Extract the reusable city-search UI behavior and add the top route-backed mode switch, while preserving the current-symptoms flow behavior.

### Changes Required:

#### 1. Shared Google attribution component

**File**: `app/components/google-attribution.tsx`

**Intent**: Move the Google attribution treatment out of the home route so both city suggestion popovers can satisfy the same attribution requirement.

**Contract**: Export a presentational React component that renders the existing compact "powered by Google" treatment. It has no route state and no provider calls.

#### 2. Shared city combobox component

**File**: `app/components/city-combobox.tsx`

**Intent**: Extract the existing city search behavior so current and destination routes share debounce, abort, fallback, suggestion display, disambiguation, and selection behavior.

**Contract**: Export a controlled or semi-controlled component that accepts the current selected `CitySuggestion | null`, an `onSelect` callback, Polish label/helper/placeholder text, and stable element IDs. It fetches `/api/city-search`, uses the existing 2-character threshold and 250 ms debounce behavior, displays `adminArea`/`country` context, preserves combobox/listbox accessibility roles, and includes `GoogleAttribution` whenever Google suggestions UI is shown.

#### 3. Route-backed mode switch

**File**: `app/components/mode-switch.tsx`

**Intent**: Give users an obvious top-level choice between current symptoms and travel preparation without merging both flows into one route module.

**Contract**: Export a small navigation component with two options: `/` labeled "Aktualne objawy" and `/destination` labeled "Podróż". It should use route-aware active styling and match the existing restrained Tailwind visual language.

#### 4. Home route extraction

**File**: `app/routes/home.tsx`

**Intent**: Replace inline city autocomplete and attribution code with shared components, and add the mode switch at the top of the current-symptoms page.

**Contract**: Preserve current behavior: selected city drives `/api/current-pollen`, results require selected city, at least one symptom, and intensity, and current results still use `rankCurrentSymptomAllergens`. The route should import shared UI from `app/components/` and domain APIs through public barrels.

### Success Criteria:

#### Automated Verification:

- Shared components and home route compile with `npm run typecheck`.
- Existing current-location smoke checks pass with `npm run verify:current-location`.
- Existing allergen smoke checks pass with `npm run verify:allergen-ranking`.
- Home route still imports the allergen domain through `~/domain/allergen-ranking` rather than deep implementation paths.

#### Manual Verification:

- Current-symptoms city search still debounces, displays suggestions, handles empty/unavailable states, and selects a city.
- Google attribution is still visible when city predictions are displayed.
- The top switch shows both modes and marks the current route as active.
- The current-symptoms flow still reaches ranked results after city, symptoms, and intensity are selected.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; checkbox state lives only in `## Progress`.

---

## Phase 2: Destination Route & Activity Results

### Overview

Add the destination page, wire it into routing, and render destination-specific pollen activity results from the existing domain helper.

### Changes Required:

#### 1. Destination route registration

**File**: `app/routes.ts`

**Intent**: Expose the travel-preparation flow as a sibling route.

**Contract**: Add `route("/destination", "routes/destination-search.tsx")` while preserving the index and resource routes.

#### 2. Destination route module

**File**: `app/routes/destination-search.tsx`

**Intent**: Implement the Polish travel-preparation screen with route-local destination state and activity results.

**Contract**: Export route metadata and a default route component. The component renders `ModeSwitch`, uses `CityCombobox` for destination city selection, calls `/api/current-pollen` after a destination is selected, and computes `summarizeDestinationPollenActivity({ pollenActivity })` for display. It must not import `rankCurrentSymptomAllergens`, symptom catalogs, intensity labels, likelihood labels, or current-symptom result types.

#### 3. Destination result cards

**File**: `app/routes/destination-search.tsx`

**Intent**: Show the environmental activity output users need before travel.

**Contract**: Render one card per destination summary in catalog order. Each card shows allergen label, pollen activity label, and the destination explanation. Copy should use Polish terms such as "aktywność pyłków" and "kontekst środowiskowy" rather than personal probability. Cards should not highlight a single "most likely" result because destination output is intentionally unranked.

#### 4. Destination loading and fallback states

**File**: `app/routes/destination-search.tsx`

**Intent**: Make selected-destination and provider states understandable without blocking the flow on missing data.

**Contract**: Before city selection, show an empty state that asks the user to choose a destination. During pollen fetch, show a compact loading state. If the pollen response is unavailable or includes `unknown` activity, render all cards anyway and show an amber notice with the provider message or a Polish fallback explaining that some destination pollen data is unavailable.

### Success Criteria:

#### Automated Verification:

- Destination route and route registration compile with `npm run typecheck`.
- Existing allergen smoke checks pass with `npm run verify:allergen-ranking`.
- Existing current-location smoke checks pass with `npm run verify:current-location`.
- Static review confirms the destination route imports `summarizeDestinationPollenActivity` and does not import current-symptom ranking or likelihood helpers.

#### Manual Verification:

- A guest can open `/destination`, search for a destination city, select it, and see all four MVP allergen activity cards without selecting symptoms.
- The mode switch navigates from `/destination` back to `/` and from `/` to `/destination`.
- Unknown or unavailable pollen data shows an amber notice and keeps all activity cards visible.
- Destination cards use Polish environmental wording and avoid diagnosis, treatment, medication, and personal probability language.
- The destination page is usable on mobile and desktop without overlapping text or controls.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; checkbox state lives only in `## Progress`.

---

## Phase 3: Guardrails, Release Blocker & Handoff Verification

### Overview

Make the release risk explicit, verify both flows after shared extraction, and document the manual checks needed before handoff.

### Changes Required:

#### 1. Destination release-blocker note

**File**: `context/changes/destination-allergen-risk-check/plan.md`

**Intent**: Keep the known `/api/current-pollen` public cost risk visible to implementers and reviewers.

**Contract**: The plan's references and manual verification must state that S-02 reuses `/api/current-pollen`, but public release remains blocked by a separate abuse-control fix from `context/changes/guest-current-symptoms-check/follow-ups/review-fixes.md`.

#### 2. Verification command coverage

**File**: `package.json`

**Intent**: Ensure the existing verification commands remain sufficient after adding shared UI and a destination route.

**Contract**: No new command is required unless implementation changes provider/domain contracts. Handoff verification should run `npm run verify:allergen-ranking`, `npm run verify:current-location`, and `npm run typecheck`.

#### 3. Manual flow verification

**File**: `context/changes/destination-allergen-risk-check/plan.md`

**Intent**: Capture the human verification surface for the two-mode UI.

**Contract**: Manual checks must cover current flow regression, destination happy path, destination fallback path, mode switch behavior, Polish copy, non-diagnostic framing, Google attribution, and public-release blocker acknowledgement.

### Success Criteria:

#### Automated Verification:

- `npm run verify:allergen-ranking` passes.
- `npm run verify:current-location` passes.
- `npm run typecheck` passes.
- `npm audit --json` runs for release handoff and any advisories are fixed or documented.

#### Manual Verification:

- Current-symptoms flow still works after shared combobox extraction.
- Destination flow works with a configured Google Maps API key for at least one real city.
- Destination flow falls back gracefully when provider data or API key is unavailable.
- Mode switch is visible and understandable at the top of both product routes.
- Google attribution appears when suggestions are displayed in both flows.
- Reviewer confirms `/api/current-pollen` abuse controls are tracked as a public-release blocker before exposing S-02.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; checkbox state lives only in `## Progress`.

---

## Testing Strategy

### Unit Tests:

- No full test runner is configured yet.
- Keep relying on `npm run verify:allergen-ranking` for destination contract guarantees: all allergens included, no likelihood fields, environmental wording.
- Keep relying on `npm run verify:current-location` for normalized provider fallback behavior and resource-route guards.

### Integration Tests:

- No integration test runner exists yet.
- If a test runner is added later, cover route navigation between `/` and `/destination`, shared combobox selection, destination result rendering after mocked pollen response, and unavailable-provider fallback.

### Manual Testing Steps:

1. Start the app with `npm run dev`.
2. Visit `/` and verify the current-symptoms flow still completes.
3. Use the top switch to navigate to `/destination`.
4. Search for and select a destination city.
5. Confirm all four MVP allergen activity cards render without symptom input.
6. Verify unavailable or unknown pollen data still renders all cards with an amber notice.
7. Navigate back to `/` through the switch and confirm active state changes correctly.
8. Check mobile and desktop viewports for layout and text overflow.
9. Review visible copy for Polish language, environmental framing, and no diagnosis/treatment/medication advice.
10. Confirm public release is not approved until the `/api/current-pollen` abuse-control follow-up is handled.

## Performance Considerations

The shared combobox should preserve the existing short-input guard, debounce, and abort behavior so destination search does not increase unnecessary autocomplete calls. Destination pollen lookup should fire only after a concrete suggestion is selected. Reusing `/api/current-pollen` preserves the existing 300-second success cache semantics, but it does not solve direct-call abuse risk; public release still needs a separate cache/rate-limit/token control.

## Migration Notes

No database migration or persisted data migration is required. This change adds a new route and shared UI files, but keeps existing API contracts stable. The only release sequencing requirement is operational: do not publicly expose the destination flow until the existing `/api/current-pollen` abuse-control follow-up is resolved or explicitly accepted by the project owner.

## References

- Research doc: `context/changes/destination-allergen-risk-check/research.md`
- Roadmap S-02: `context/foundation/roadmap.md:80`
- PRD destination requirements: `context/foundation/prd.md:70`, `context/foundation/prd.md:82`, `context/foundation/prd.md:86`
- Route registration: `app/routes.ts:3`
- Current home route: `app/routes/home.tsx:73`
- Existing city search pattern: `app/routes/home.tsx:129`
- Existing pollen lookup pattern: `app/routes/home.tsx:172`
- Existing Google attribution: `app/routes/home.tsx:57`
- Destination domain helper: `app/domain/allergen-ranking/destination.ts:9`
- Destination wording: `app/domain/allergen-ranking/explanations.ts:36`
- Current pollen endpoint: `app/routes/api.current-pollen.ts:11`
- API guard helpers: `app/domain/current-location/http.ts:10`
- Release blocker follow-up: `context/changes/guest-current-symptoms-check/follow-ups/review-fixes.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared Mode Navigation & City Combobox

#### Automated

- [x] 1.1 Shared components and home route compile with `npm run typecheck` — 1db040a
- [x] 1.2 Existing current-location smoke checks pass with `npm run verify:current-location` — 1db040a
- [x] 1.3 Existing allergen smoke checks pass with `npm run verify:allergen-ranking` — 1db040a
- [x] 1.4 Home route still imports the allergen domain through `~/domain/allergen-ranking` — 1db040a

#### Manual

- [x] 1.5 Current-symptoms city search still debounces, displays suggestions, handles empty/unavailable states, and selects a city — 1db040a
- [x] 1.6 Google attribution is still visible when city predictions are displayed — 1db040a
- [x] 1.7 The top switch shows both modes and marks the current route as active — 1db040a
- [x] 1.8 The current-symptoms flow still reaches ranked results after city, symptoms, and intensity are selected — 1db040a

### Phase 2: Destination Route & Activity Results

#### Automated

- [x] 2.1 Destination route and route registration compile with `npm run typecheck`
- [x] 2.2 Existing allergen smoke checks pass with `npm run verify:allergen-ranking`
- [x] 2.3 Existing current-location smoke checks pass with `npm run verify:current-location`
- [x] 2.4 Static review confirms destination route imports `summarizeDestinationPollenActivity` and not current-symptom ranking or likelihood helpers

#### Manual

- [x] 2.5 Guest can open `/destination`, search for a destination city, select it, and see all four MVP allergen activity cards without selecting symptoms
- [x] 2.6 Mode switch navigates between `/` and `/destination`
- [x] 2.7 Unknown or unavailable pollen data shows an amber notice and keeps all activity cards visible
- [x] 2.8 Destination cards use Polish environmental wording and avoid diagnosis, treatment, medication, and personal probability language
- [x] 2.9 Destination page is usable on mobile and desktop without overlapping text or controls

### Phase 3: Guardrails, Release Blocker & Handoff Verification

#### Automated

- [ ] 3.1 `npm run verify:allergen-ranking` passes
- [ ] 3.2 `npm run verify:current-location` passes
- [ ] 3.3 `npm run typecheck` passes
- [ ] 3.4 `npm audit --json` runs and advisories are fixed or documented

#### Manual

- [ ] 3.5 Current-symptoms flow still works after shared combobox extraction
- [ ] 3.6 Destination flow works with a configured Google Maps API key for at least one real city
- [ ] 3.7 Destination flow falls back gracefully when provider data or API key is unavailable
- [ ] 3.8 Mode switch is visible and understandable at the top of both product routes
- [ ] 3.9 Google attribution appears when suggestions are displayed in both flows
- [ ] 3.10 Reviewer confirms `/api/current-pollen` abuse controls are tracked as a public-release blocker before exposing S-02
