# Guest Current-Symptoms Allergen Check Implementation Plan

## Overview

Build the first usable Allergen Finder product slice: a guest user can search for their current city, select current symptoms, choose low/high intensity, and see automatically updated ranked allergen results in Polish. The flow uses Google Maps Platform server-side for city autocomplete, selected-city geocoding, and pollen forecast lookup, then normalizes pollen activity into the existing F-01 allergen ranking contract.

## Current State Analysis

The app is still a React Router full-stack TypeScript scaffold with one index route. `app/routes/home.tsx` currently renders the starter `Welcome` component, so S-01 can become the first screen without migrating existing product UI. The reusable F-01 domain contract is already implemented under `app/domain/allergen-ranking/` and should be consumed through its public barrel. No city search, provider integration, persistence, auth, loader/action pattern, or UI test runner exists yet.

## Desired End State

The index route presents a Polish guest current-symptoms check. A user types at least a few characters, receives city suggestions biased toward Poland while still allowing global matches, selects a city, selects at least one predefined symptom, chooses low/high intensity, and sees all four F-01 allergen results ranked automatically. Google API calls stay server-side, `GOOGLE_MAPS_API_KEY` is never exposed to the browser, provider failures fall back to `unknown` pollen activity, and visible copy avoids diagnosis, medication, and treatment advice.

### Key Discoveries:

- S-01 is the roadmap north-star proof point: guest city entry plus current symptoms should produce compact likely-allergen results with pollen activity and non-diagnostic explanation (`context/foundation/roadmap.md:26`).
- Roadmap S-01 requires manual city entry, symptom selection, low/high intensity, automatic result updates, and compact likelihood results (`context/foundation/roadmap.md:66`).
- The PRD requires guest access, predefined symptoms, low/high intensity, automatic updates, ranked results, compact pollen/probability/explanation output, and manual current-city fallback (`context/foundation/prd.md:66`).
- The app must stay Polish, avoid diagnosis/treatment/medication advice, and avoid storing location or symptom history without clear user intent (`context/foundation/prd.md:43`).
- The home route is currently only starter metadata plus `Welcome` (`app/routes/home.tsx:1`).
- F-01 exports selected symptoms, low/high intensity, pollen activity input, ranked result output, and `rankCurrentSymptomAllergens` through `app/domain/allergen-ranking/index.ts`.
- The F-01 ranking input already accepts `selectedSymptomIds`, `intensity`, and `pollenActivity` by allergen ID (`app/domain/allergen-ranking/types.ts:54`).
- `rankCurrentSymptomAllergens` already produces sorted results with Polish labels and fallback `unknown` pollen activity (`app/domain/allergen-ranking/ranking.ts:42`).
- React Router framework mode supports route module loaders and resource routes that return non-HTML responses, which fits small server endpoints for autocomplete and pollen lookup.
- Google Places Autocomplete (New) returns place suggestions from `POST https://places.googleapis.com/v1/places:autocomplete`, supports city filtering/biasing fields, and requires Google attribution/logo when predictions are shown without a map.
- Google Pollen `forecast:lookup` accepts latitude/longitude and returns daily pollen data; route code must use only normalized index values, not Google health recommendation text.

## What We're NOT Doing

- No account creation, login gate, saved symptom history, or saved location history.
- No device geolocation sharing; FR-002 remains parked and manual selection is the S-01 path.
- No destination/travel flow.
- No database, migrations, user profile, or persistence.
- No map UI.
- No direct browser calls to Google APIs and no client-exposed Google API key.
- No medication recommendations, treatment recommendations, diagnosis, chatbot behavior, or Google-provided health recommendation copy.
- No broad allergen catalog expansion beyond the existing F-01 MVP pollen-focused contract.
- No full test runner setup unless the implementer determines a lightweight smoke check cannot cover the new provider normalization boundary.

## Implementation Approach

Keep the index route as the product entry point. Add a server-side provider layer under `app/domain/` that owns Google request construction, response pruning, provider error mapping, and pollen normalization into F-01 `PollenActivityByAllergen`. Add React Router resource routes for city autocomplete and pollen lookup so the UI can use `useFetcher` or ordinary client fetches against app-local endpoints instead of talking to Google directly. The UI computes ranked results client-side from selected symptoms/intensity plus the latest normalized pollen activity, and it falls back to `unknown` activity when provider data is missing or unavailable.

## Critical Implementation Details

### Google API Security

`GOOGLE_MAPS_API_KEY` must be read only in server-side code. Resource routes may return selected city metadata and normalized pollen activity, but must never return the raw API key, raw Google response bodies, Google health recommendation copy, or unnecessary provider fields.

### Public Provider Endpoint Guardrails

The app-local resource routes are public guest endpoints that can trigger billable Google API calls. They must validate query and `placeId` inputs, reject or short-circuit malformed/too-short requests before provider calls, use provider request timeouts, avoid duplicate client requests where practical, and set cache headers so safe successful responses can be reused while missing-key or provider-failure fallbacks are not cached as valid pollen data. README setup notes must instruct operators to restrict the server-side Google key to the required APIs, use server/IP restrictions where the deployment platform allows it, and configure Google-side quota/billing alerts before exposing the endpoints publicly.

### Google Attribution

The city suggestion UI must include Google attribution/logo treatment when displaying Google Places predictions without a map. This is a product and compliance requirement, not visual decoration.

### Provider Normalization

The app's public route/UI contract remains F-01's normalized pollen activity scale. Google Pollen type and plant response data must be translated into `PollenActivityByAllergen`; the UI must not branch on provider-native `GRASS`, `TREE`, `WEED`, plant codes, UPI categories, or health recommendations.

### Fallback Semantics

Provider failures, missing pollen data, unsupported locations, or absent index information should not block the allergen ranking. They should produce all `unknown` pollen activity with clear Polish copy that current pollen data is unavailable and the result is based on symptoms/intensity only.

## Phase 1: Provider Contract & Google Adapter

### Overview

Add server-only provider contracts and Google integration helpers for city suggestions, place coordinate lookup, pollen forecast lookup, and normalization into the F-01 ranking input.

### Changes Required:

#### 1. Google provider config

**File**: `app/domain/google-maps/config.server.ts`

**Intent**: Centralize server-only access to the Google Maps Platform API key and related endpoint constants.

**Contract**: Export a function that returns the required API key or a typed provider configuration error. The function reads `process.env.GOOGLE_MAPS_API_KEY`; no client route component imports this file.

#### 2. Provider types

**File**: `app/domain/current-location/types.ts`

**Intent**: Define app-owned city suggestion, selected city, provider status, and pollen lookup result shapes so routes do not expose Google-native response types.

**Contract**: Include a city suggestion shape with stable `placeId`, display label, optional country/admin fields, and a Poland-priority flag. Include a pollen lookup result shape that either contains normalized `PollenActivityByAllergen` or a fallback status/message.

#### 3. Google city autocomplete adapter

**File**: `app/domain/current-location/google-city-search.server.ts`

**Intent**: Query Google Places Autocomplete (New) for city predictions and prune the response to app-owned suggestion fields.

**Contract**: Use `includedPrimaryTypes: ["(cities)"]`, `languageCode: "pl"`, and fields limited to the place ID and display text needed by the UI. Implement Poland-first behavior by prioritizing suggestions identifiable as Poland while allowing global matches when Polish matches are absent or insufficient. Return an empty list for short input, provider errors, or missing API key rather than throwing into the UI.

#### 4. Google place geocoding adapter

**File**: `app/domain/current-location/google-place-geocoding.server.ts`

**Intent**: Resolve a selected Google `placeId` into coordinates and display metadata needed for pollen lookup.

**Contract**: Accept only a selected `placeId` from the app's suggestion shape. Return latitude, longitude, and display label/admin/country fields; map Google errors to a provider failure result instead of leaking provider status text.

#### 5. Google pollen adapter

**File**: `app/domain/current-location/google-pollen.server.ts`

**Intent**: Call Google Pollen `forecast:lookup` for the selected city coordinates and normalize today's forecast into F-01 pollen activity.

**Contract**: Request one day of pollen data. Normalize Google index values into F-01 `unknown`, `low`, `moderate`, `high`, and `very-high` levels. Map Google `GRASS` to `grass-pollen`, `TREE` to `tree-pollen`, `WEED` to `weed-pollen`, and plant-level ragweed data to `ragweed-pollen` when available; missing fields become `unknown`. Ignore Google `healthRecommendations`, descriptions, and cross-reaction copy.

#### 6. Environment documentation

**File**: `README.md`

**Intent**: Document the server-only environment variable and required Google Cloud APIs where project setup is introduced.

**Contract**: Add a concise section listing `GOOGLE_MAPS_API_KEY` and required enabled APIs: Places API, Geocoding API, and Pollen API. State that the key must stay server-side, should be restricted to only those APIs, should use server/IP restrictions where the deployment platform makes that practical, and should have Google-side quota or billing alerts configured before public exposure.

### Success Criteria:

#### Automated Verification:

- Provider contracts compile through `npm run typecheck`.
- Existing allergen contract smoke checks pass with `npm run verify:allergen-ranking`.
- Google provider code has no client imports from `*.server.ts` files.
- Missing `GOOGLE_MAPS_API_KEY` maps to a typed fallback/error result rather than crashing the route.

#### Manual Verification:

- Review the provider adapter and confirm raw Google health recommendation copy is not exposed to the UI.
- Review the README environment section and confirm it is sufficient to configure a local GCP project.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; checkbox state lives only in `## Progress`.

---

## Phase 2: Resource Routes & Route Registration

### Overview

Expose narrow app-local server endpoints for city autocomplete and pollen lookup while keeping Google-specific details server-side.

### Changes Required:

#### 1. City autocomplete resource route

**File**: `app/routes/api.city-search.ts`

**Intent**: Give the home UI a small endpoint for autocomplete suggestions.

**Contract**: Export a `loader` that reads a search query parameter, trims and validates length, caps accepted input length, calls the city autocomplete adapter only for valid search text, and returns JSON containing only app-owned suggestion fields plus a provider status. Short or empty queries return an empty suggestion list with 200 status without calling Google.

#### 2. Pollen lookup resource route

**File**: `app/routes/api.current-pollen.ts`

**Intent**: Give the home UI a small endpoint for selected-city pollen activity.

**Contract**: Export a `loader` that accepts a selected Google `placeId`, validates it as an expected opaque Places ID string with a maximum length before provider calls, resolves coordinates server-side, calls Google Pollen, and returns normalized `PollenActivityByAllergen` plus fallback metadata. Missing or malformed `placeId` returns fallback/unknown activity without calling Google. Provider failures return 200 with fallback status and all `unknown` activity so the UI can still rank results.

#### 3. Route registration

**File**: `app/routes.ts`

**Intent**: Register resource routes alongside the existing index route.

**Contract**: Keep the index route mapped to `routes/home.tsx`. Add explicit route entries for `/api/city-search` and `/api/current-pollen` pointing to their resource route modules.

#### 4. API response guards

**File**: `app/domain/current-location/http.ts`

**Intent**: Keep JSON response construction and fallback payload shape consistent between resource routes.

**Contract**: Provide small helpers or constants for successful, empty, and fallback payloads. Responses should be cache-conscious for autocomplete/pollen where appropriate, but must not cache missing-key configuration failures as valid pollen data. Include shared request-guard constants for minimum search length, maximum query length, maximum `placeId` length, and provider timeout duration so both resource routes enforce the same public-endpoint abuse guardrails.

### Success Criteria:

#### Automated Verification:

- Resource routes compile through `npm run typecheck`.
- `/api/city-search` returns an empty suggestion list for short input.
- `/api/current-pollen` returns normalized `unknown` activity when the API key is missing or the provider fails.
- Route registration preserves the index route and adds both resource endpoints.
- Resource routes enforce input bounds, provider timeouts, and non-cacheable missing-key fallbacks.

#### Manual Verification:

- With `npm run dev`, verify `/api/city-search?q=War` returns app-owned suggestion JSON and no raw Google payload fields.
- With `npm run dev`, verify `/api/current-pollen?placeId=<selected-place-id>` returns normalized pollen activity or graceful fallback JSON.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; checkbox state lives only in `## Progress`.

---

## Phase 3: Guest Check UI

### Overview

Replace the starter index route with the Polish guest current-symptoms check that consumes resource routes and the F-01 ranking contract.

### Changes Required:

#### 1. Home route metadata and imports

**File**: `app/routes/home.tsx`

**Intent**: Make the index route the Allergen Finder current-symptoms screen.

**Contract**: Update `meta` to Polish product metadata. Import F-01 catalog, intensity labels, ranking helper, and types from `~/domain/allergen-ranking`; do not deep-import implementation files.

#### 2. City autocomplete control

**File**: `app/routes/home.tsx`

**Intent**: Let users search for and select their current city before results are computed.

**Contract**: Provide a Polish-labeled combobox/autocomplete experience backed by `/api/city-search`. It should show loading, empty, and provider-unavailable states; display country/admin labels for disambiguation; prioritize Polish suggestions; and include required Google attribution/logo treatment when suggestions are visible.

#### 3. Symptom and intensity controls

**File**: `app/routes/home.tsx`

**Intent**: Collect the minimum required symptom inputs for the current check.

**Contract**: Render all predefined F-01 symptoms as multi-select controls and intensity as a two-option low/high segmented control or radio group. Results are considered ready only when a city is selected, at least one symptom is selected, and intensity is selected.

#### 4. Automatic pollen lookup state

**File**: `app/routes/home.tsx`

**Intent**: Fetch normalized pollen activity after city selection and keep result updates automatic.

**Contract**: When the selected city changes, request `/api/current-pollen` for that place ID. While pollen is loading, keep the form usable and show a concise Polish loading state. If pollen fails, retain the selected city and set activity to `unknown` via the fallback payload.

#### 5. Ranked results section

**File**: `app/routes/home.tsx`

**Intent**: Show compact likely-allergen results once all required inputs are present.

**Contract**: Call `rankCurrentSymptomAllergens` with selected symptoms, selected intensity, and latest normalized pollen activity. Render all four F-01 MVP allergens in ranked order with likelihood label, pollen activity label, matched symptoms, and the F-01 explanation. Do not show provider-native Google text.

#### 6. Not-ready and fallback states

**File**: `app/routes/home.tsx`

**Intent**: Keep the automatic-update flow understandable before and during required input selection.

**Contract**: Show a polished empty state until city, symptoms, and intensity are ready. Show a clear fallback notice when current pollen data is unavailable and results are based on symptoms/intensity plus unknown pollen activity. Copy must be Polish and non-diagnostic.

#### 7. Starter UI cleanup

**File**: `app/welcome/welcome.tsx`

**Intent**: Remove or stop using the React Router starter screen after the product first screen replaces it.

**Contract**: Either delete the unused starter component/assets in a scoped cleanup or leave them unused if deletion adds noise. `app/routes/home.tsx` must no longer render `Welcome`.

### Success Criteria:

#### Automated Verification:

- Home route compiles through `npm run typecheck`.
- Existing allergen smoke checks still pass with `npm run verify:allergen-ranking`.
- Ranking is not computed until city, at least one symptom, and intensity are selected.
- The UI imports the F-01 domain through the public barrel rather than deep implementation files.

#### Manual Verification:

- In `npm run dev`, a guest can search and select a city, select symptoms, choose intensity, and see all four ranked allergen results without logging in.
- Results update automatically when symptoms or intensity change.
- Provider-unavailable fallback keeps the selected city and shows `Brak danych`/unknown pollen activity without blocking results.
- The page is usable on a narrow mobile viewport and a desktop viewport.
- All visible product copy is Polish and avoids diagnosis, treatment, and medication advice.
- Google attribution/logo treatment is visible when city predictions are displayed.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; checkbox state lives only in `## Progress`.

---

## Phase 4: Verification & Handoff

### Overview

Add focused verification around provider normalization and document the manual checks needed for a network-backed first product flow.

### Changes Required:

#### 1. Current-location smoke check

**File**: `app/domain/current-location/smoke-check.ts`

**Intent**: Verify current-location provider normalization and resource-route fallback behavior without requiring live network calls.

**Contract**: Use representative local fixture objects for Google Pollen response fragments and assert mapping to F-01 `grass-pollen`, `tree-pollen`, `weed-pollen`, and `ragweed-pollen`, including missing-index fallback to `unknown`. Also assert short city-search input, malformed/missing `placeId`, and missing-key pollen fallback behavior by calling local helpers or route loaders directly with mocked provider boundaries. The smoke check should not call Google.

#### 2. npm verification command

**File**: `package.json`

**Intent**: Give implementers a repeatable command for current-location provider and route fallback checks.

**Contract**: Add `verify:current-location` that runs the current-location smoke check. Keep `npm run typecheck` as the mandatory handoff command.

#### 3. Manual verification notes

**File**: `context/changes/guest-current-symptoms-check/plan.md`

**Intent**: Keep manual live-provider verification explicit in the plan progress contract.

**Contract**: Manual verification must cover configured-key happy path, missing-key fallback, city search ambiguity, automatic result updates, mobile layout, and copy guardrails.

### Success Criteria:

#### Automated Verification:

- Current-location smoke checks pass with `npm run verify:current-location`.
- Existing domain smoke checks pass with `npm run verify:allergen-ranking`.
- Type checking passes with `npm run typecheck`.
- `npm audit --json` runs and advisories are fixed or documented for release handoff.

#### Manual Verification:

- With a configured Google Maps API key and required APIs enabled, city autocomplete and pollen lookup work for a Polish city.
- With `GOOGLE_MAPS_API_KEY` unset or invalid, the UI falls back gracefully without exposing provider details.
- Ambiguous city searches show enough country/admin context for selection.
- The complete flow can be completed in under 30 seconds in normal network conditions.
- No location or symptom history is stored after completing the guest check.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets; checkbox state lives only in `## Progress`.

---

## Testing Strategy

### Unit Tests:

- No full test runner is configured yet.
- Add a lightweight current-location smoke check for provider normalization, route short-input behavior, malformed/missing `placeId`, and missing-key fallback.
- Continue running the existing F-01 smoke check to protect ranking, fallback, Polish labels, and medical wording guardrails.

### Integration Tests:

- Resource route live-provider behavior should be manually verified through `npm run dev` because no integration test runner exists.
- If a test runner is introduced later, cover city search empty input, provider fallback payloads, missing API key behavior, and home route result readiness.

### Manual Testing Steps:

1. Start the app with `npm run dev`.
2. Configure `GOOGLE_MAPS_API_KEY` locally with Places API, Geocoding API, and Pollen API enabled.
3. Search for a Polish city and confirm suggestions show disambiguating labels and Google attribution.
4. Select a city, choose one or more symptoms, select low/high intensity, and confirm all four results appear.
5. Change symptom selection and intensity and confirm results update automatically without a submit button.
6. Unset or invalidate the API key and confirm the UI still shows symptom-based results with unknown pollen activity and Polish fallback copy.
7. Verify mobile and desktop layouts for no overlapping text or controls.
8. Review visible copy for Polish language and absence of diagnosis, medication, or treatment advice.

## Performance Considerations

Autocomplete should avoid calling the resource route for very short input and should avoid firing unnecessary duplicate requests as the user types. Resource routes should short-circuit invalid requests before Google calls, use provider timeouts, and rely on Google-side quota/billing controls as part of public-endpoint cost protection. Provider calls are network-bound and should fail gracefully rather than blocking the under-30-second core flow. The in-browser ranking work remains tiny because F-01 uses a four-allergen in-memory catalog.

## Migration Notes

No database or persisted data exists. This change introduces a required local/server environment variable for live provider behavior: `GOOGLE_MAPS_API_KEY`. Deployments need that variable plus enabled Google Places API, Geocoding API, and Pollen API. Before public exposure, restrict the key to those APIs, use server/IP restrictions where practical for the deployment target, and configure Google-side quota or billing alerts. Later provider replacement should preserve the app-owned city suggestion and normalized pollen contracts rather than changing the UI to provider-native shapes.

## References

- Roadmap S-01: `context/foundation/roadmap.md:66`
- Roadmap parked device location/history/auth scope: `context/foundation/roadmap.md:105`
- PRD current-symptom success criteria: `context/foundation/prd.md:36`
- PRD guardrails: `context/foundation/prd.md:43`
- PRD S-01 acceptance criteria: `context/foundation/prd.md:52`
- PRD functional requirements: `context/foundation/prd.md:66`
- F-01 plan and progress: `context/changes/allergen-ranking-contract/plan.md`
- Home route starter state: `app/routes/home.tsx:1`
- F-01 public barrel: `app/domain/allergen-ranking/index.ts`
- F-01 ranking input: `app/domain/allergen-ranking/types.ts:54`
- F-01 ranking helper: `app/domain/allergen-ranking/ranking.ts:42`
- React Router resource routes documentation: `https://reactrouter.com/how-to/resource-routes`
- React Router fetchers documentation: `https://reactrouter.com/how-to/fetchers`
- Google Places Autocomplete documentation: `https://developers.google.com/maps/documentation/places/web-service/place-autocomplete`
- Google Geocoding place ID documentation: `https://developers.google.com/maps/documentation/geocoding/requests-places-geocoding`
- Google Pollen forecast lookup documentation: `https://developers.google.com/maps/documentation/pollen/reference/rest/v1/forecast/lookup`
- Google Maps API security guidance: `https://developers.google.com/maps/api-security-best-practices`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Provider Contract & Google Adapter

#### Automated

- [x] 1.1 Provider contracts compile through `npm run typecheck` — 8259c7e
- [x] 1.2 Existing allergen contract smoke checks pass with `npm run verify:allergen-ranking` — 8259c7e
- [x] 1.3 Google provider code has no client imports from `*.server.ts` files — 8259c7e
- [x] 1.4 Missing `GOOGLE_MAPS_API_KEY` maps to a typed fallback/error result rather than crashing the route — 8259c7e

#### Manual

- [x] 1.5 Provider adapter does not expose raw Google health recommendation copy to the UI — 8259c7e
- [x] 1.6 README environment section is sufficient to configure a local GCP project — 8259c7e

### Phase 2: Resource Routes & Route Registration

#### Automated

- [x] 2.1 Resource routes compile through `npm run typecheck` — 244d82a
- [x] 2.2 `/api/city-search` returns an empty suggestion list for short input — 244d82a
- [x] 2.3 `/api/current-pollen` returns normalized `unknown` activity when the API key is missing or the provider fails — 244d82a
- [x] 2.4 Route registration preserves the index route and adds both resource endpoints — 244d82a
- [x] 2.5 Resource routes enforce input bounds, provider timeouts, and non-cacheable missing-key fallbacks — 244d82a

#### Manual

- [x] 2.6 `/api/city-search?q=War` returns app-owned suggestion JSON and no raw Google payload fields — 244d82a
- [x] 2.7 `/api/current-pollen?placeId=<selected-place-id>` returns normalized pollen activity or graceful fallback JSON — 244d82a

### Phase 3: Guest Check UI

#### Automated

- [x] 3.1 Home route compiles through `npm run typecheck` — 58797e3
- [x] 3.2 Existing allergen smoke checks still pass with `npm run verify:allergen-ranking` — 58797e3
- [x] 3.3 Ranking is not computed until city, at least one symptom, and intensity are selected — 58797e3
- [x] 3.4 UI imports the F-01 domain through the public barrel rather than deep implementation files — 58797e3

#### Manual

- [x] 3.5 Guest can search and select a city, select symptoms, choose intensity, and see all four ranked allergen results without logging in — 58797e3
- [x] 3.6 Results update automatically when symptoms or intensity change — 58797e3
- [x] 3.7 Provider-unavailable fallback keeps the selected city and shows unknown pollen activity without blocking results — 58797e3
- [x] 3.8 Page is usable on narrow mobile and desktop viewports — 58797e3
- [x] 3.9 Visible product copy is Polish and avoids diagnosis, treatment, and medication advice — 58797e3
- [x] 3.10 Google attribution/logo treatment is visible when city predictions are displayed — 58797e3

### Phase 4: Verification & Handoff

#### Automated

- [ ] 4.1 Current-location smoke checks pass with `npm run verify:current-location`
- [ ] 4.2 Existing domain smoke checks pass with `npm run verify:allergen-ranking`
- [ ] 4.3 Type checking passes with `npm run typecheck`
- [ ] 4.4 `npm audit --json` runs and advisories are fixed or documented

#### Manual

- [ ] 4.5 Configured Google Maps API key and required APIs enable city autocomplete and pollen lookup for a Polish city
- [ ] 4.6 Missing or invalid `GOOGLE_MAPS_API_KEY` falls back gracefully without exposing provider details
- [ ] 4.7 Ambiguous city searches show enough country/admin context for selection
- [ ] 4.8 Complete flow can be completed in under 30 seconds in normal network conditions
- [ ] 4.9 No location or symptom history is stored after completing the guest check
