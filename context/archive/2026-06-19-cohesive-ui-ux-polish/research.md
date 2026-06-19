---
date: 2026-06-19T07:48:48+02:00
researcher: Codex
git_commit: b94e58b96ff107bae0c21275d40cf95598242152
branch: develop
repository: allergy
topic: "Cohesive UI/UX polish from roadmap S-06"
tags: [research, codebase, ui, ux, react-router, design-system]
status: complete
last_updated: 2026-06-19
last_updated_by: Codex
---

# Research: Cohesive UI/UX polish from roadmap S-06

**Date**: 2026-06-19T07:48:48+02:00
**Researcher**: Codex
**Git Commit**: b94e58b96ff107bae0c21275d40cf95598242152
**Branch**: develop
**Repository**: allergy

## Research Question

Research the roadmap S-06 change `cohesive-ui-ux-polish`: "Use a consistent, polished interface across pages with clearer spacing, aligned controls, smooth feedback animations, and reduced duplicated UI logic."

## Summary

S-06 is ready for planning as a focused polish/refactor slice. The live app has stable route behavior and a mostly consistent visual language, but the implementation spreads common layout, alerts, buttons, cards, badges, and ranking/result presentation across route modules. The biggest plan opportunities are:

- Extract a small shared app shell/header pattern for the product, history, and account page families.
- Standardize button, text-link, notice, empty-state, card, and badge primitives without changing route behavior.
- Consolidate duplicated current-pollen fetch state between current and destination checks while preserving stale-response protection.
- Reuse symptom selection and ranking/result card presentation between current checks and saved-history detail/edit.
- Keep product contracts intact: guest routes stay public, saving stays explicit, history remains private, missing pollen data remains visible, manual city selection remains a complete fallback, and incomplete saved-edit drafts keep the last valid ranking visible.

Testing should remain mostly Vitest/unit or in-process integration. Add deterministic tests only where S-06 extracts behavior-bearing UI logic such as notices/roles, city combobox behavior, button disabled/loading states, result-card missing-data display, or saved-edit preview stability.

## Detailed Findings

### Route and screen boundaries

User-facing route registration is centralized in [`app/routes.ts`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes.ts#L3):

- `/` renders current symptom checks in [`app/routes/home.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L59).
- `/destination` renders destination pollen checks in [`app/routes/destination-search.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/destination-search.tsx#L85).
- `/register` and `/login` are thin wrappers over `AuthForm` in [`app/routes/register.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/register.tsx#L24) and [`app/routes/login.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/login.tsx#L24).
- `/history` renders the saved-check list in [`app/routes/history.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.tsx#L38).
- `/history/:checkId` renders saved-check detail, edit, and delete flows in [`app/routes/history.$checkId.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.$checkId.tsx#L69).

The route set is small enough for S-06 to touch all user-facing screens, but the plan should avoid changing loader/action contracts unless required by UI extraction.

### Current and destination checks share a shell but duplicate logic

Current checks and destination checks already use nearly the same broad shell: `min-h-screen bg-stone-50`, `max-w-6xl`, brand/account row, `ModeSwitch`, hero copy, disclaimer panel, and a two-column body ([`home.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L182), [`destination-search.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/destination-search.tsx#L146)). This is a strong candidate for a shared `PageShell` or `AppHeader` with optional mode switch, hero copy, and notice slot.

The current and destination routes also duplicate current-pollen fetch state:

- `emptyPollenActivity`, `AsyncStatus`, and `isAbortError` are local in both routes ([`home.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L32), [`destination-search.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/destination-search.tsx#L17)).
- Both POST to `/api/current-pollen` after city selection ([`home.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L110), [`destination-search.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/destination-search.tsx#L100)).
- The home route has a request-identity guard through `activePollenPlaceIdRef`; destination currently lacks that stale-response guard ([`home.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L67), [`destination-search.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/destination-search.tsx#L116)).

A shared `useCurrentPollen` hook is viable, but it should preserve the safer home-route request identity behavior for both routes.

### Shared UI primitives are implicit, not explicit

The app has repeated class patterns but no shared UI primitive layer beyond a few domain-specific components:

- `AccountNav` repeats emerald underline link styling and authenticated/signed-out account actions ([`account-nav.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/account-nav.tsx#L5)).
- `AuthForm` has its own centered card shell, field styles, error alert, primary button, and text links ([`auth-form.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/auth-form.tsx#L19)).
- `CurrentLocationControl`, `SymptomCheckSave`, history list, and detail/edit routes each define local primary/secondary/danger button classes ([`current-location-control.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/current-location-control.tsx#L148), [`symptom-check-save.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/symptom-check-save.tsx#L168), [`history.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.tsx#L176), [`history.$checkId.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.$checkId.tsx#L223)).
- Warning, success, error, and status messages repeat across current, destination, auth, save, history, and detail screens ([`home.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L202), [`destination-search.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/destination-search.tsx#L166), [`auth-form.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/auth-form.tsx#L88), [`history.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.tsx#L97)).

Good candidates for a small local UI layer are `Button`, `TextLink`, `Notice`, `EmptyState`, `Panel`, `Pill`, `PollenActivityBadge`, and `RankingResultCard`. The project currently has no `clsx`, class-variance-authority, or equivalent class helper in [`package.json`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/package.json#L17), so either add a minimal local class join helper or keep variants plain and explicit.

### Ranking and result cards are duplicated across live, saved, and preview views

Current result cards, saved result cards, and edit preview cards repeat the same structure: top-result label, allergen title, likelihood badge, pollen activity badge, and matched symptom chips ([`home.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L321), [`history.$checkId.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.$checkId.tsx#L237), [`history.$checkId.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.$checkId.tsx#L401)). Destination has a local `DestinationCard` with similar card and activity-badge styling ([`destination-search.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/destination-search.tsx#L56)).

This is one of the best S-06 implementation targets because it reduces duplicated UI logic while preserving domain behavior. The shared component should accept already-ranked/domain-derived data; it should not recompute rankings internally.

### Symptom selection has shared behavior but divergent visual treatment

`SymptomIntensitySelector` is shared between current checks and saved-check edit ([`symptom-intensity-selector.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/symptom-intensity-selector.tsx#L15)). The outer selectable symptom cards are not shared:

- Current check selected cards are white with emerald border ([`home.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L247)).
- Saved edit selected cards are emerald-tinted ([`history.$checkId.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.$checkId.tsx#L347)).

A `SymptomSelectionCard` can standardize selected/unselected styling and smooth selection feedback while keeping state transitions in the routes or domain helpers.

### History and detail action placement is inconsistent

The history list uses text-link style actions, with delete opening an inline confirmation inside each record card ([`history.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.tsx#L138), [`history.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.tsx#L155)). The detail route uses bordered edit/delete buttons near the ranking heading and also includes a separate full danger section later on the page ([`history.$checkId.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.$checkId.tsx#L218), [`history.$checkId.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.$checkId.tsx#L450)).

S-06 should choose a single destructive-action pattern per screen. Preserve the S-03 historical rule that delete uses inline confirmation and failed delete keeps record plus confirmation context visible.

### Status roles and accessibility need harmonization

Status/message presentation is not fully consistent:

- Destination loading uses `role="status"` ([`destination-search.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/destination-search.tsx#L215)).
- Home loading has the same visual role but no explicit status role ([`home.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L290)).
- `CurrentLocationControl` switches between `role="alert"` and `role="status"` based on error state ([`current-location-control.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/current-location-control.tsx#L156)).
- Auth and saved-edit errors use `role="alert"` ([`auth-form.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/auth-form.tsx#L88), [`history.$checkId.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.$checkId.tsx#L322)).

A shared `Notice` component should encode tone and intended role separately. Do not reduce notices to style-only wrappers; warning disclaimers, unavailable data, success flash messages, status updates, and validation errors have different semantics.

### City selection is a high-risk shared component

`CityCombobox` already owns important interactive behavior: debounce, POST fetch, abort handling, combobox/listbox/option roles, keyboard navigation, active descendant, selected-city helper text, and Google attribution ([`city-combobox.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/city-combobox.tsx#L86), [`city-combobox.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/city-combobox.tsx#L193), [`city-combobox.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/city-combobox.tsx#L271)).

S-06 can polish spacing and transitions around the combobox, but a plan should avoid casual rewrites of combobox behavior unless it adds focused tests for keyboard and attribution behavior.

### Minor implementation issue: non-standard Tailwind token

`home.tsx` uses `text-slate-650` once ([`home.tsx`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L197)). The only global CSS customization is the font theme and base background in [`app/app.css`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/app.css#L1). Unless Tailwind v4 is generating this arbitrary token unexpectedly, this is likely an invalid/no-op utility and should become a standard slate token during polish.

## Code References

- [`app/routes.ts:3`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes.ts#L3) - User-facing and API route registration.
- [`app/routes/home.tsx:182`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L182) - Current-check page shell, header, mode switch, hero, disclaimer, form/results layout.
- [`app/routes/home.tsx:388`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/home.tsx#L388) - Save control is rendered below the main two-column workflow.
- [`app/routes/destination-search.tsx:146`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/destination-search.tsx#L146) - Destination page shell mirrors the current-check shell.
- [`app/components/auth-form.tsx:19`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/auth-form.tsx#L19) - Account access uses a separate centered card family.
- [`app/routes/history.tsx:74`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.tsx#L74) - History list has a narrower shell and header/back-link arrangement.
- [`app/routes/history.$checkId.tsx:183`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.$checkId.tsx#L183) - Saved detail uses a third shell width and compact header.
- [`app/routes/history.$checkId.tsx:437`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/routes/history.$checkId.tsx#L437) - Saved edit explicitly keeps last valid preview visible while draft intensity is incomplete.
- [`app/components/city-combobox.tsx:187`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/city-combobox.tsx#L187) - City combobox markup, roles, and suggestions list.
- [`app/components/current-location-control.tsx:146`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/current-location-control.tsx#L146) - Locate-me button and status/alert presentation.
- [`app/components/symptom-check-save.tsx:126`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/symptom-check-save.tsx#L126) - Pending authenticated save confirmation state.
- [`app/components/symptom-intensity-selector.tsx:24`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/symptom-intensity-selector.tsx#L24) - Shared per-symptom intensity control.
- [`app/components/symptom-check-summary.tsx:24`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/symptom-check-summary.tsx#L24) - Shared saved-check summary rendering and Polish date formatting.
- [`package.json:10`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/package.json#L10) - Test, typecheck, and opt-in integration scripts.

## Architecture Insights

The app is route-module heavy. That is fine for the MVP, but S-06 should introduce only small, local abstractions that remove real duplication:

- Prefer presentational components in `app/components/` for repeated UI structures.
- Keep domain computations in `app/domain/**`; shared result cards should render already-computed data.
- Keep route-specific loader/action and navigation semantics in route modules.
- Extract shared client hooks only when they centralize meaningful behavior, such as current-pollen fetch state.
- Avoid adding a broad design-system dependency unless planning shows it is worth the churn.

The current visual system is restrained: stone background, slate text, emerald primary action, amber warnings, rose destructive/error, rounded-md corners, bordered white cards, and compact typography. S-06 should improve consistency inside that system rather than introducing a new look.

## Historical Context (from prior changes)

- S-06 is explicitly framed as a polish/refactor slice that should improve consistency and duplicated UI logic after core flows are stable, not change product scope ([`context/foundation/roadmap.md:134`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/foundation/roadmap.md#L134), [`context/foundation/roadmap.md:142`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/foundation/roadmap.md#L142)).
- F-01 established the risk strategy: use the cheapest verification layer and protect guest access, explicit saving, private ownership, missing-data handling, and location fallback ([`context/foundation/test-plan.md:13`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/foundation/test-plan.md#L13), [`context/foundation/test-plan.md:34`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/foundation/test-plan.md#L34)).
- S-01 kept root auth optional and public checks unguarded; invalid cookies degrade to signed-out while public routes still render ([`context/archive/2026-06-10-email-password-account-access/plan.md:230`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/archive/2026-06-10-email-password-account-access/plan.md#L230)).
- S-02 made persistence explicit: a completed check creates no row until the user chooses save, and guest save uses `sessionStorage` plus post-auth confirmation ([`context/archive/2026-06-11-save-and-view-symptom-check/plan.md:26`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/archive/2026-06-11-save-and-view-symptom-check/plan.md#L26), [`context/archive/2026-06-11-save-and-view-symptom-check/plan.md:79`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/archive/2026-06-11-save-and-view-symptom-check/plan.md#L79)).
- S-03 kept management on `/history/:checkId` with `intent=update|delete`, and only symptoms/intensities are editable; location and pollen context remain immutable ([`context/archive/2026-06-15-manage-saved-symptom-check/plan.md:66`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/archive/2026-06-15-manage-saved-symptom-check/plan.md#L66), [`context/archive/2026-06-15-manage-saved-symptom-check/plan.md:107`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/archive/2026-06-15-manage-saved-symptom-check/plan.md#L107)).
- S-04 made low/high per-symptom intensity explicit and requires all selected symptoms to have intensity before ranking/saving is complete ([`context/archive/2026-06-14-per-symptom-intensity-ranking/plan.md:17`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/archive/2026-06-14-per-symptom-intensity-ranking/plan.md#L17), [`context/archive/2026-06-14-per-symptom-intensity-ranking/plan.md:19`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/archive/2026-06-14-per-symptom-intensity-ranking/plan.md#L19)).
- S-05 made device location an additive shortcut that resolves into the same `CitySuggestion` boundary as manual search, while manual selection remains the full fallback ([`context/archive/2026-06-18-device-location-current-check/plan.md:5`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/archive/2026-06-18-device-location-current-check/plan.md#L5), [`context/archive/2026-06-18-device-location-current-check/plan.md:53`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/archive/2026-06-18-device-location-current-check/plan.md#L53)).
- Standing lesson: while any selected symptom lacks intensity, keep the last valid ranking visible and mark the preview incomplete instead of blanking/flickering ([`context/foundation/lessons.md:5`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/foundation/lessons.md#L5)).
- Standing lesson: opt-in integration evidence must run against the documented disposable environment or be recorded as unverified ([`context/foundation/lessons.md:12`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/context/foundation/lessons.md#L12)).

## Test and Verification Notes

Existing relevant coverage:

- `npm test` runs Vitest; `npm run test:db` and `npm run test:auth-live` are opt-in gates ([`package.json`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/package.json#L10)).
- Missing pollen stays distinct from low pollen in ranking tests ([`app/domain/allergen-ranking/allergen-ranking.test.ts:95`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/domain/allergen-ranking/allergen-ranking.test.ts#L95)).
- Device-location failure and fallback behavior is covered in `CurrentLocationControl` and current-location domain tests ([`app/components/current-location-control.test.tsx:93`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/components/current-location-control.test.tsx#L93), [`app/domain/current-location/current-location.test.ts:174`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/domain/current-location/current-location.test.ts#L174)).
- Explicit save and ownership boundaries are covered at route-handler and DB integration layers ([`app/domain/symptom-checks/symptom-check-routes.test.ts:89`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/domain/symptom-checks/symptom-check-routes.test.ts#L89), [`app/domain/symptom-checks/symptom-check-route-handlers.integration.test.ts:146`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/domain/symptom-checks/symptom-check-route-handlers.integration.test.ts#L146)).
- Saved edit state has helper-level coverage and a standing lesson for preview stability ([`app/domain/symptom-checks/saved-check-edit-state.test.ts:34`](https://github.com/radecpro/allergy/blob/b94e58b96ff107bae0c21275d40cf95598242152/app/domain/symptom-checks/saved-check-edit-state.test.ts#L34)).

Recommended S-06 regression tests if touched:

- Shared `Notice`: role/tone tests for alert vs status vs passive warning.
- Shared result/ranking cards: unknown pollen badge and all-results-visible rendering.
- Shared pollen hook: stale response cannot overwrite newer selected city.
- City combobox: keyboard navigation, active descendant, selection, unavailable message, and Google attribution if behavior is refactored.
- Shared button/action components: disabled/loading text and disabled state for save/edit/delete/location flows.
- Saved edit preview: incomplete selected symptom keeps last valid preview visible.

Keep tests provider-free by stubbing fetch/actions. Use DB integration only if S-06 changes ownership/persistence code, which the current research suggests should not be necessary.

## Related Research

- No existing `context/changes/**/research.md` for S-06 before this artifact.
- Relevant historical artifacts are listed above under `context/archive/2026-06-10-email-password-account-access/`, `context/archive/2026-06-11-save-and-view-symptom-check/`, `context/archive/2026-06-14-per-symptom-intensity-ranking/`, `context/archive/2026-06-15-manage-saved-symptom-check/`, and `context/archive/2026-06-18-device-location-current-check/`.

## Open Questions

- Should the account pages remain a distinct centered-card page family, or should they adopt the same app header/shell as product and history routes?
- Should the save action move closer to the current-check results/form workflow, or remain below the whole page as a global action?
- Should the detail route keep both ranking-header delete and the full danger section, or consolidate destructive action into one location?
- Is the desired "smooth feedback animations" limited to Tailwind transition states, or should route planning include explicit enter/exit/selection animations?
