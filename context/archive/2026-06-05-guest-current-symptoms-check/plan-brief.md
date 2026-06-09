# Guest Current-Symptoms Allergen Check — Plan Brief

> Full plan: `context/changes/guest-current-symptoms-check/plan.md`

## What & Why

Build the first usable Allergen Finder flow: a guest user searches for their current city, selects symptoms, chooses low/high intensity, and sees likely allergen results. This proves the core promise from the roadmap: connecting current symptoms and current pollen context without login, diagnosis language, or saved history.

## Starting Point

The app currently has one starter index route and no product UI. F-01 is implemented as `app/domain/allergen-ranking/`, giving S-01 a ready ranking contract, Polish labels, and `unknown` pollen fallback, but there is no city search or live pollen provider yet.

## Desired End State

The home page is a Polish guest current-symptoms check. City autocomplete and pollen lookup run through server-side resource routes backed by Google Maps Platform APIs, while the UI receives only app-owned city suggestion fields and normalized F-01 pollen activity. If Google lookup fails or data is missing, the flow still ranks all allergens using symptoms/intensity and `unknown` pollen activity.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Provider | Google Places, Geocoding, and Pollen | User has a GCP project and wants live pollen in S-01 rather than a later slice. | Plan |
| API boundary | Server resource endpoints | Keeps API keys and Google response shapes out of client UI. | Plan |
| City search | Autocomplete/search | User chose autocomplete over free text or dropdown. | Plan |
| Search scope | Poland-first with global fallback | Fits a Polish MVP while allowing users outside Poland to complete the flow. | Plan |
| Result timing | Results after city, symptoms, and intensity are ready | Matches automatic updates without showing weak rankings before required inputs exist. | Plan |
| Result volume | Show all F-01 MVP allergens | Preserves the domain contract and makes low/unknown explanations visible. | Plan |
| Provider failure | Graceful `unknown` fallback | Keeps the under-30-second guest flow usable even when live pollen is unavailable. | Plan |
| Medical copy | Use F-01 explanations, omit Google health recommendations | Preserves non-diagnostic and no-treatment guardrails. | Research / Plan |

## Scope

**In scope:**

- Google server-side provider adapter.
- Server resource routes for city search and current pollen lookup.
- `GOOGLE_MAPS_API_KEY` documentation.
- Polish home route UI with autocomplete, symptom selection, low/high intensity, and all ranked results.
- Google attribution when predictions are shown.
- Graceful provider fallback to unknown pollen activity.
- Typecheck, existing allergen smoke checks, and optional provider normalization smoke checks.

**Out of scope:**

- Login, saved history, database, or persistence.
- Device location sharing.
- Destination/travel flow.
- Map UI.
- Direct browser calls to Google APIs.
- Diagnosis, treatment, medication advice, Google health recommendation copy, or broad allergen expansion.

## Architecture / Approach

`app/routes/home.tsx` becomes the product screen. It calls app-local resource routes (`/api/city-search`, `/api/current-pollen`) for autocomplete and pollen lookup. Those resource routes call server-only Google adapters, normalize provider data into F-01 `PollenActivityByAllergen`, and return fallback payloads on failure; the UI then calls `rankCurrentSymptomAllergens` from the F-01 barrel.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Provider Contract & Google Adapter | Server-only Google config, city/pollen provider types, autocomplete, geocoding, pollen normalization | API key or raw Google content leaks into client-visible code. |
| 2. Resource Routes & Route Registration | `/api/city-search` and `/api/current-pollen` resource endpoints | First API pattern becomes too provider-specific or brittle. |
| 3. Guest Check UI | Polish first-screen flow with autocomplete, controls, automatic results, fallback states, attribution | UI becomes too dense or copy drifts into diagnostic certainty. |
| 4. Verification & Handoff | Smoke/typecheck/manual verification for live-provider and fallback paths | Live API behavior is hard to verify consistently without clear local setup. |

**Prerequisites:** F-01 implemented; Google Cloud project with Places API, Geocoding API, and Pollen API enabled for live verification.
**Estimated effort:** About 3-4 focused sessions across 4 phases.

## Open Risks & Assumptions

- Google Pollen availability and returned plant/type detail may vary by location and season; missing fields must normalize to `unknown`.
- Google Places prediction display has attribution requirements that must be respected in the UI.
- The exact UPI-to-F-01 activity mapping needs implementation judgment, but it must stay transparent and fixture-tested.
- Billing, quota, and API restrictions are external to the codebase and must be configured in GCP before live manual verification.

## Success Criteria (Summary)

- A guest can complete the current-symptoms check from the home page without login or saved history.
- City autocomplete and live pollen lookup work through server-side Google integration, with graceful fallback when unavailable.
- Results are Polish, compact, automatically updated, non-diagnostic, and show all four F-01 allergens in ranked order.
