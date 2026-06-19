# Cohesive UI and UX Polish — Plan Brief

> Full plan: `context/changes/cohesive-ui-ux-polish/plan.md`
> Research: `context/changes/cohesive-ui-ux-polish/research.md`

## What & Why

This slice makes the app feel like one product family instead of several separately styled screens. The goal is to tighten spacing, align controls, reduce duplicated UI logic, and add restrained feedback motion without changing the behavior of checks, auth, history, or save flows.

## Starting Point

The app already has the full MVP flow: current checks, destination checks, auth, saved history, and saved-detail management. What it lacks is a shared presentation layer, so the same kinds of notices, cards, buttons, and async states are rendered in slightly different ways across route modules.

## Desired End State

The product and history screens share one consistent shell, the repeated result and status surfaces render through shared primitives, and the app feels visually coherent across desktop and mobile. Auth stays a separate centered card family, but it uses the same underlying styling language.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Shared shell scope | Product + history routes share the shell; auth stays separate | This fixes the biggest consistency gap without turning auth into a busier app frame | Plan |
| Auth treatment | Keep the centered card family | Auth should remain focused and distinct while still reusing shared primitives | Plan |
| Save placement | Move save closer to current-check results | The flow reads better as review then save, while keeping consent explicit | Plan |
| Destructive actions | One confirmation pattern per screen | Reduces duplicated delete affordances and keeps deletion obvious | Plan |
| Motion depth | Lightweight transitions only | Gives polish without introducing layout or accessibility risk | Plan |
| Test focus | Shared primitives plus extracted behavior | Protects the code most likely to regress after the refactor | Plan |

## Scope

**In scope:**

- Shared shell and reusable primitives for product and history screens
- Shared ranking/result rendering and current-pollen fetch behavior
- Current-check save placement polish and auth page styling cleanup
- Simplified destructive-action placement on history and detail screens
- Subtle transition-only motion and focused regression tests

**Out of scope:**

- Database, auth, or route-contract changes
- New design-system dependency or major visual redesign
- Ranking logic changes or medical/product-scope changes
- Broad animation framework or page-level motion choreography

## Architecture / Approach

Build a small local presentation layer in `app/components/` and migrate the route modules onto it. Keep domain computation and route behavior where they already live, but have the UI render through shared shell, primitive, and card components so the visible experience becomes consistent.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared Shell And Primitives | One shell and common UI building blocks across product/history | Accidentally changing route behavior while removing duplication |
| 2. Shared Result And Async Logic | Shared result cards, selection shells, and current-pollen loading behavior | Losing stale-response protection during extraction |
| 3. Screen-Specific Polish | Save placement, auth cleanup, and delete-flow simplification | Breaking explicit save or destructive-action semantics |
| 4. Motion And Verification | Subtle motion and focused regression coverage | Introducing jank or brittle tests |

**Prerequisites:** The current route and component contracts already exist, and the route behavior should remain stable while the shared UI layer is introduced.
**Estimated effort:** Roughly 3-4 implementation sessions across 4 phases.

## Open Risks & Assumptions

- The shared shell should stay limited to product and history routes; auth is assumed to remain a distinct page family.
- Motion is assumed to mean lightweight transitions only, not full enter/exit choreography.
- The current-pollen fetch refactor must preserve the existing stale-response guard on the home route.

## Success Criteria (Summary)

- Current, destination, history, and detail screens look and behave like one cohesive app.
- Shared primitives and shared async behavior cover the repeated UI logic without changing route contracts.
- Save, delete, and warning flows still preserve explicit consent, private history, and visible missing-data behavior.
