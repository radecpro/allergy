# Destination Allergen Risk Check — Plan Brief

> Full plan: `context/changes/destination-allergen-risk-check/plan.md`
> Research: `context/changes/destination-allergen-risk-check/research.md`

## What & Why

Build the travel-preparation flow: a guest user chooses a destination city and sees current destination pollen activity without reporting symptoms. This satisfies the S-02 roadmap slice while preserving the PRD guardrail that first-use destination output should not imply personal symptom probability.

## Starting Point

The current app already has city autocomplete, selected-place pollen lookup, and current-symptom results in `home.tsx`, plus a destination-specific domain helper. What is missing is a destination route, a visible product mode switch, shared city-search UI, and destination-only activity cards.

## Desired End State

Users see a top switch between "Aktualne objawy" and "Podróż". The destination page lets them search a city, fetches normalized pollen activity through existing app endpoints, and renders every MVP allergen as environmental activity with Polish fallback copy when data is unavailable.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Product mode | Route-backed top switch | User wanted a visible switch, while separate routes keep modules smaller. | Plan |
| Route shape | `/` for current symptoms, `/destination` for travel | Preserves current flow and adds destination as a sibling experience. | Plan |
| Shared UI | Extract `CityCombobox` and `GoogleAttribution` | Both flows need identical autocomplete behavior and attribution. | Plan |
| Pollen API | Reuse `/api/current-pollen` | Existing endpoint already accepts selected place IDs and has smoke-covered fallback behavior. | Plan |
| Destination output | Activity-only cards for all MVP allergens | Matches F-01 destination contract and avoids personal likelihood without symptoms/history. | Research / Plan |
| Unknown data | Render all cards with amber notice | Keeps the flow useful and honest when provider data is partial or unavailable. | Plan |
| Abuse controls | Release blocker outside S-02 scope | Keeps this slice focused but prevents ignoring the public billable-call risk. | Research / Plan |

## Scope

**In scope:**

- Shared city combobox and Google attribution components.
- Route-backed mode switch.
- New `/destination` route.
- Destination city search and selected-place pollen lookup using existing endpoints.
- Destination environmental activity cards using `summarizeDestinationPollenActivity`.
- Polish loading, empty, unavailable, and fallback copy.
- Verification of both current and destination flows.

**Out of scope:**

- Symptom input or likelihood labels in destination mode.
- Saved history, accounts, database, persistence, or personalization.
- Renaming `/api/current-pollen`.
- Implementing abuse controls in this slice.
- Diagnosis, medication, treatment, or Google health recommendation copy.

## Architecture / Approach

Extract the shared autocomplete UI into `app/components/`, add a route-aware `ModeSwitch`, then add `app/routes/destination-search.tsx` and register it at `/destination`. Destination state stays route-local: selected city triggers `/api/current-pollen`, the returned `pollenActivity` feeds `summarizeDestinationPollenActivity`, and the route renders unranked activity cards.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared Mode Navigation & City Combobox | Shared autocomplete/attribution plus top switch, with current flow preserved | Extraction regresses the working current-symptoms flow. |
| 2. Destination Route & Activity Results | `/destination` route with city search, pollen lookup, and activity cards | Copy or imports accidentally imply personal likelihood. |
| 3. Guardrails, Release Blocker & Handoff Verification | Final verification and explicit release-blocker handling | Public exposure happens before pollen endpoint abuse controls exist. |

**Prerequisites:** Existing S-01 provider/resource routes and F-01 allergen-ranking contract.
**Estimated effort:** About 2 focused sessions across 3 phases.

## Open Risks & Assumptions

- `/api/current-pollen` remains a direct billable-call surface until a separate abuse-control change lands.
- Google Pollen may return partial or unavailable data for some cities; destination UI must treat `unknown` as expected.
- Adding `app/components/` is a small new convention, justified by real cross-route reuse.

## Success Criteria (Summary)

- A guest can switch to destination mode, choose a city, and see all MVP allergen activity cards without symptoms.
- Current-symptoms behavior still works after shared combobox extraction.
- Destination output stays Polish, environmental, non-diagnostic, and free of personal probability wording.
