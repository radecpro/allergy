# Cohesive UI and UX Polish Implementation Plan

## Overview

This change makes the app feel like one product family without changing route behavior. The goal is to reduce duplicated UI logic, standardize spacing and feedback patterns, and keep the current product contracts intact: guest checks stay public, explicit saving stays explicit, history stays private, and missing pollen data stays visible.

## Current State Analysis

The app already has a stable feature set across current checks, destination checks, auth, saved history, and saved-detail editing. The problem is visual and structural drift: each route owns its own shell, repeated button/link/notice/card markup, and slightly different interaction-state treatment.

The research and codebase read show the biggest duplication points:

- `home.tsx` and `destination-search.tsx` share the same app header and wide content shell but duplicate async pollen fetch state and loading/error handling.
- `home.tsx`, `history.tsx`, and `history.$checkId.tsx` all hand-roll similar result cards, badges, notices, and empty states.
- `auth-form.tsx` is intentionally different, but it repeats card, button, field, and message styling that can be pushed into primitives without changing its separate layout family.
- `city-combobox.tsx` is behavior-heavy and already correct enough that polish work should avoid rewiring its accessibility contract unless the test surface grows with it.

## Desired End State

The app should present a consistent visual language across product and history flows: same header rhythm, aligned controls, consistent notices and empty states, and shared result-card treatment. Auth pages should still feel focused and separate, but they should use the same underlying primitives.

The implementation is successful when the following are true:

- Current and destination pages share shell and async behavior without stale-response regressions.
- Current, saved, and preview result presentations use the same card structure and badge treatment.
- Save, delete, and status messages feel consistent across screens, with only lightweight transitions for feedback.

### Key Discoveries:

- `home.tsx` has the safer request-identity guard for selected-city pollen fetches, while `destination-search.tsx` still relies on abort-only cleanup.
- `history.$checkId.tsx` already depends on the “keep last valid preview visible” lesson, so polish must not introduce flicker in incomplete edit states.
- The roadmap explicitly frames S-06 as polish plus duplicated-logic reduction, not as a product-scope change.

## What We’re NOT Doing

- No schema, persistence, auth, or route-contract changes.
- No new design system dependency or broad styling framework rewrite.
- No explicit page-level animation system beyond restrained transition polish.
- No changes to ranking math, explicit-save semantics, private-history ownership, or missing-data product behavior.

## Implementation Approach

Start by extracting the common shell and small presentational primitives used by product and history screens. Then consolidate the repeated result-card, badge, and selection-card logic so current, destination, saved, and preview views render through the same UI language.

After the shared rendering layer is in place, adjust the screen-specific flows that still need local treatment: keep auth as a centered card family, move the save action closer to the current-check results, and consolidate destructive actions to one confirmation pattern per screen. Finish by adding subtle transition-only motion and focused tests around the extracted behavior.

## Critical Implementation Details

Keep the current-pollen fetch behavior request-safe when it is shared. The home route’s selected-city guard is the model to preserve for destination as well, so newer selections must win and older responses must not repaint the UI.

The save action must remain explicit even if it moves closer to results. The UI can feel more connected, but it should still read as “review, then save,” not “automatic persistence.”

Destructive actions should remain obvious but not duplicated. History and detail pages each need one clear delete flow, with the existing inline-confirmation behavior preserved where the current product contract depends on it.

## Phase 1: Shared Shell And Primitives

### Overview

Extract the repeated product/history shell and the small reusable UI primitives that already exist implicitly in the route modules. This phase should remove duplication without changing what users can do on any page.

### Changes Required:

#### 1. Shared app shell

**File**: `app/components/app-shell.tsx`

**Intent**: Introduce one shared shell for the product and history route families so the brand row, content width, header rhythm, and optional notice/action slots read the same across screens.

**Contract**: The shell must support current-check, destination, history, and detail layouts without forcing auth pages into the same frame. It should accept route-specific header content and page body content, but not own route behavior.

#### 2. Shared UI primitives

**File**: `app/components/button.tsx`, `app/components/text-link.tsx`, `app/components/notice.tsx`, `app/components/empty-state.tsx`, `app/components/panel.tsx`, `app/components/pill.tsx`

**Intent**: Factor out the repeated visual treatments for primary and secondary actions, notices, empty states, framed panels, and compact badges.

**Contract**: Each primitive must preserve the current semantic role and tone conventions. Alerts still need alert semantics, status messages still need status semantics, and warning copy must remain visibly distinct from success and passive text.

#### 3. Route adoption

**File**: `app/routes/home.tsx`, `app/routes/destination-search.tsx`, `app/routes/history.tsx`, `app/routes/history.$checkId.tsx`

**Intent**: Replace duplicated shell and repeated styling with the shared shell and primitives while leaving route behavior, loaders, and actions unchanged.

**Contract**: The public route contracts remain identical; only presentation and local composition change.

### Success Criteria:

#### Automated Verification:

- Shared shell and primitive components typecheck cleanly.
- Route modules still compile after switching to the shared shell and primitives.

#### Manual Verification:

- Current, destination, history, and detail pages share the same visual rhythm.
- Auth pages still feel intentionally separate rather than folded into the product shell.

**Implementation Note**: After the automated checks pass, pause for manual review before moving to the next phase.

## Phase 2: Shared Result And Async Logic

### Overview

Consolidate the repeated ranking/result presentation and the current-pollen fetch workflow. This is where the biggest logic duplication disappears, and where the stale-response guard needs to survive the refactor.

### Changes Required:

#### 1. Shared ranking/result cards

**File**: `app/components/ranking-result-card.tsx`

**Intent**: Render current, saved, and preview allergen results through one shared card structure so labels, badges, matched-symptom chips, and top-result emphasis stay consistent.

**Contract**: The component must accept already-computed result data only. It must not recalculate ranking or infer domain behavior internally.

#### 2. Shared symptom selection shell

**File**: `app/components/symptom-selection-card.tsx`

**Intent**: Standardize the selected and unselected symptom card treatment used by the current-check and saved-edit flows.

**Contract**: The shared card should preserve the existing selection affordance and keep `SymptomIntensitySelector` as the nested control surface.

#### 3. Shared current-pollen fetch behavior

**File**: `app/domain/current-location/current-pollen` helper or hook consumed by `app/routes/home.tsx` and `app/routes/destination-search.tsx`

**Intent**: Centralize the selected-city pollen lookup so both routes share loading, unavailable, and abort behavior.

**Contract**: The shared logic must preserve the home route’s request-identity protection so older responses cannot overwrite newer city selections.

#### 4. Route cleanup

**File**: `app/routes/home.tsx`, `app/routes/destination-search.tsx`

**Intent**: Use the shared cards and async helper in the live routes and remove the one-off badge and state duplication that remains.

**Contract**: The current-check ranking still shows missing-pollen warnings, and the destination page still renders activity-only cards with the same fallback behavior.

### Success Criteria:

#### Automated Verification:

- Shared result-card and selection-card tests pass.
- Shared current-pollen behavior tests prove stale responses cannot repaint newer selections.

#### Manual Verification:

- Rapid city changes do not flash stale pollen data.
- Unknown or unavailable pollen still shows the visible warning copy.

**Implementation Note**: After the automated checks pass, pause for manual review before moving to the next phase.

## Phase 3: Screen-Specific Polish

### Overview

Adjust the screens that need local treatment after the shared layer exists. The goal is better task flow and cleaner destructive-action placement without reintroducing duplication.

### Changes Required:

#### 1. Save action placement

**File**: `app/components/symptom-check-save.tsx`, `app/routes/home.tsx`

**Intent**: Move the save action closer to the current-check results so the flow reads as “complete the check, review the output, then save.”

**Contract**: Saving must remain explicit, guest handoff must still work, and the control must still respect the loading/disabled state of the current pollen lookup.

#### 2. Auth page polish

**File**: `app/components/auth-form.tsx`

**Intent**: Keep auth as a centered card family, but route its shared styling through the new primitives so it matches the rest of the app more closely.

**Contract**: The auth pages stay visually distinct from product/history screens and keep the same form behavior and return-to handling.

#### 3. Destructive action simplification

**File**: `app/routes/history.tsx`, `app/routes/history.$checkId.tsx`

**Intent**: Consolidate delete affordances so each screen has one clear destructive-action pattern instead of repeated controls.

**Contract**: Preserve the existing inline-confirmation behavior where required, and do not remove the explicit confirmation step from the delete flow.

### Success Criteria:

#### Automated Verification:

- Save, history, and detail route tests still pass after the layout changes.
- Type checking confirms the updated component composition is valid.

#### Manual Verification:

- Save feels attached to the completed current-check workflow.
- Delete is visible and unambiguous, but not duplicated on the same screen.

**Implementation Note**: After the automated checks pass, pause for manual review before moving to the next phase.

## Phase 4: Motion And Verification

### Overview

Add restrained transition polish and lock down the extracted behavior with focused tests. This phase should improve feel without becoming a motion system rewrite.

### Changes Required:

#### 1. Lightweight motion polish

**File**: `app/components/app-shell.tsx`, `app/components/notice.tsx`, `app/components/ranking-result-card.tsx`, `app/components/symptom-selection-card.tsx`, `app/components/button.tsx`

**Intent**: Apply subtle transition-only feedback to selection, hover, focus, and status changes across the shared UI layer.

**Contract**: Motion must remain lightweight and must not change layout stability, keyboard focus behavior, or loading semantics.

#### 2. Focused regression tests

**File**: `app/components/*.test.tsx`, `app/domain/current-location/*.test.ts`

**Intent**: Cover the extracted primitives and shared current-pollen behavior at the cheapest useful layer.

**Contract**: Tests should stay provider-free and deterministic. Focus on notice roles, button/loading state, shared result rendering, and stale-response protection.

#### 3. Whole-slice verification

**File**: `package.json` scripts and local test commands only

**Intent**: Confirm the slice still passes the standard repo checks after the refactor and motion polish.

**Contract**: `npm test` and `npm run typecheck` remain the handoff gates; no new infrastructure is introduced.

### Success Criteria:

#### Automated Verification:

- Focused unit tests for shared primitives and current-pollen behavior pass.
- `npm test` passes.
- `npm run typecheck` passes.

#### Manual Verification:

- Hover, focus, selection, and status changes feel smoother without layout jank.
- The full current, destination, auth, history, and detail flow still feels cohesive on desktop and mobile.

**Implementation Note**: This is the last phase. After automated checks and manual verification pass, the slice is ready to hand off.

## Testing Strategy

### Unit Tests:

- Shared notice component semantics and tone variants.
- Shared button and link behavior, including disabled and loading states.
- Shared result-card rendering for top result, unknown pollen, and matched symptom chips.
- Shared current-pollen helper behavior for stale-response protection and unavailable fallback.

### Integration Tests:

- Route-module smoke coverage for current, destination, history, and detail screens after shell extraction.
- Save and delete route behavior after the screen-specific polish pass.

### Manual Testing Steps:

1. Open current checks and destination checks, then confirm the shared shell and spacing feel identical where they should.
2. Change cities quickly and confirm stale pollen data never repaints a newer selection.
3. Walk through save, edit, and delete on a saved check and confirm each action still behaves explicitly.
4. Verify auth still feels like a focused centered page rather than a product shell variant.

## Performance Considerations

Keep the new shared components presentational and thin. The shared ranking/result card must render already-computed data, and the shared current-pollen helper must preserve the existing abort/request-identity behavior so the refactor does not add extra network churn or stale UI writes.

## Migration Notes

No data migration is required. This is a presentation and local-state refactor only, so rollback is the same as reverting the UI extraction if a regression appears.

## References

- Related research: `context/changes/cohesive-ui-ux-polish/research.md`
- Roadmap slice: `context/foundation/roadmap.md:132`
- Test-risk guidance: `context/foundation/test-plan.md:62`
- Current route shell: `app/routes/home.tsx:182`
- Destination route shell: `app/routes/destination-search.tsx:145`
- History screen shell: `app/routes/history.tsx:74`
- Saved-detail shell: `app/routes/history.$checkId.tsx:182`
- Combobox behavior boundary: `app/components/city-combobox.tsx:187`
- Save-flow boundary: `app/components/symptom-check-save.tsx:31`
- Shared summary rendering: `app/components/symptom-check-summary.tsx:24`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Shared Shell And Primitives

#### Automated

- [ ] 1.1 Shared shell and primitive components typecheck cleanly
- [ ] 1.2 Route modules compile after switching to the shared shell and primitives

#### Manual

- [ ] 1.3 Current, destination, history, and detail pages share the same visual rhythm while auth stays separate

### Phase 2: Shared Result And Async Logic

#### Automated

- [ ] 2.1 Shared result-card and selection-card tests pass
- [ ] 2.2 Shared current-pollen behavior tests prove stale responses cannot repaint newer selections

#### Manual

- [ ] 2.3 Rapid city changes do not flash stale pollen data and missing-data warnings still appear

### Phase 3: Screen-Specific Polish

#### Automated

- [ ] 3.1 Save, history, and detail route tests still pass after the layout changes
- [ ] 3.2 Type checking confirms the updated component composition is valid

#### Manual

- [ ] 3.3 Save feels attached to the current-check workflow and delete remains unambiguous

### Phase 4: Motion And Verification

#### Automated

- [ ] 4.1 Focused unit tests for shared primitives and current-pollen behavior pass
- [ ] 4.2 `npm test` passes
- [ ] 4.3 `npm run typecheck` passes

#### Manual

- [ ] 4.4 Hover, focus, selection, and status changes feel smoother without layout jank
