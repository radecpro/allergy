---
project: "Allergen Finder"
context_type: brownfield
created: 2026-06-09
updated: 2026-06-09
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "change category"
      decision: "Significant brownfield MVP expansion covering authentication, user-owned symptom-check history, device location, and targeted result UX changes."
    - topic: "preserved behavior"
      decision: "Guest current-symptoms and destination checks remain fully usable without login, in Polish, with non-diagnostic result framing."
    - topic: "auth strategy"
      decision: "Email and password authentication with one flat authenticated-user role; guest access remains available for existing checks."
    - topic: "CRUD resource"
      decision: "Saved symptom checks are the user-owned CRUD resource."
    - topic: "save behavior"
      decision: "Saving a completed symptom check is always an explicit user action."
    - topic: "history access"
      decision: "Authenticated users can view only their own saved symptom checks."
    - topic: "history update scope"
      decision: "Users can update symptoms and each symptom's intensity in a saved check; other saved context is preserved."
    - topic: "history business effect"
      decision: "History is display-only and does not influence future allergen rankings."
    - topic: "saved-check recalculation"
      decision: "Editing a saved check recalculates its result against that check's saved location and pollen context."
    - topic: "device location"
      decision: "The current-symptoms flow can use browser-provided current location, with manual city selection preserved as fallback."
    - topic: "symptom intensity"
      decision: "Low/high intensity is selected separately for each chosen symptom instead of once for the whole check."
    - topic: "missing provider data"
      decision: "Result cards without provider pollen data display a warning label visible at first glance."
    - topic: "test foundation"
      decision: "The MVP includes a test-plan document and automated tests tied to the risk that one user could access another user's saved checks."
    - topic: "timeline"
      decision: "Expanded MVP remains due by 2026-07-05 and is after-hours work; user accepted the larger brownfield scope."
  frs_drafted: 14
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 4
  hard_deadline: 2026-07-05
  after_hours_only: true
---

# Shape Notes: Authenticated Symptom History Expansion

## Current System

Allergen Finder is an existing full-stack TypeScript web application. It currently provides two completed guest flows: a current-symptoms allergen check and a destination pollen-risk check.

The current-symptoms flow accepts a manually selected city, selected symptoms, one overall low/high intensity, and current pollen activity. It automatically ranks likely allergens and shows compact Polish, non-diagnostic results. The destination flow shows environmental pollen context without requiring symptoms.

The app currently has no authentication, user-owned persistence, CRUD history, configured test runner, or test-plan document. Existing smoke checks cover ranking and current-location provider contracts.

## Vision & Problem Statement

The current product demonstrates its allergen-ranking value but does not satisfy the expanded MVP foundations: users cannot authenticate, own persistent records, or create, read, update, and delete saved symptom checks.

The change adds the smallest user-owned workflow that satisfies those foundations while improving the existing current-symptoms experience. Users keep immediate guest access, while signing in enables explicit saving and management of personal symptom-check history.

## User & Persona

The primary persona remains an adult seasonal-allergy sufferer who wants to understand likely causes of current symptoms or environmental risks before travel.

This expansion also serves returning users who want a private record of checks they deliberately saved. The user reaches for history to review or correct a prior symptom record, not to personalize future ranking automatically.

## Access Control

Today all product flows are public and no user identity exists.

The expansion adds email-and-password registration, sign-in, and sign-out with one flat authenticated-user role. Guest users retain full access to both existing allergen checks, but saving and managing symptom-check history requires authentication.

Each saved symptom check belongs to exactly one authenticated user. A user can create, read, update, and delete only their own records. An unauthenticated attempt to use history or save a check must lead to authentication without losing the completed guest check that prompted the save action.

## Success Criteria

### Primary

- A guest can still complete both existing checks without authentication.
- A user can register or sign in, explicitly save a completed current-symptoms check, list and open only their saved checks, update saved symptoms and their individual intensities, and delete a saved check.
- The MVP has automated tests tied to a documented test-plan risk, including prevention of cross-user access to saved checks.

### Secondary

- A user can use current device location in the current-symptoms flow and fall back to manual city selection when permission is denied or location is unavailable.
- Current-symptoms result cards make missing provider pollen data immediately visible through a warning label.

### Guardrails

- Existing guest current-symptoms and destination flows remain usable without login.
- A signed-in user cannot view or change another user's saved checks.
- Saving remains explicit; location and symptom history are not stored merely because a guest completed a check.
- Results remain Polish, non-diagnostic, and free of medication or treatment recommendations.
- The expanded MVP is deliverable by 2026-07-05 as after-hours work.

## User Stories

### US-01: User explicitly saves a completed symptom check

- **Given** a guest or signed-in user has completed a current-symptoms check
- **When** they choose to save it and complete authentication if required
- **Then** the completed check is stored under their account and appears in their history

#### Acceptance Criteria

- Saving requires an explicit user action.
- Existing guest input is preserved through the authentication step.
- The saved record belongs only to the authenticated user.

### US-02: User manages private symptom-check history

- **Given** a signed-in user has one or more saved symptom checks
- **When** they open history
- **Then** they can list, inspect, update symptoms and per-symptom intensities, or delete only their own records

#### Acceptance Criteria

- Updating symptoms recalculates the saved result against that record's saved location and pollen context.
- Other saved context is not directly editable.
- History does not influence new current-symptoms or destination rankings.
- Another authenticated user cannot read, update, or delete the record.

### US-03: User uses device location with a manual fallback

- **Given** a user is starting a current-symptoms check
- **When** they grant device-location permission
- **Then** the app resolves a current city for the check while retaining manual city selection as a fallback

#### Acceptance Criteria

- Denied, unavailable, or failed location lookup does not block the check.
- Device location is not stored unless the user explicitly saves the completed check.

### US-04: User sets symptom-specific intensity and sees missing-data warnings

- **Given** a user is completing a current-symptoms check
- **When** they select symptoms
- **Then** each selected symptom has its own low/high intensity and any result lacking provider pollen data has a warning visible at first glance

#### Acceptance Criteria

- The previous single overall intensity control is replaced.
- Ranking consumes the intensity assigned to each selected symptom.
- Missing provider pollen data remains distinguishable from low pollen activity.

## Functional Requirements

### Preserved Guest Flows

- FR-001: Guest can complete the current-symptoms allergen check without logging in. Priority: must-have. Change: preserved
  > Socrates: Requiring login would satisfy identity requirements but would regress the existing fast first-use flow. Resolution: preserve guest access and gate only saving/history.
- FR-002: Guest can complete the destination pollen-risk check without logging in. Priority: must-have. Change: preserved
  > Socrates: Authentication could simplify one access model but adds no value to environmental destination context. Resolution: preserve the guest destination flow.
- FR-003: User sees Polish, non-diagnostic allergen results without medication or treatment advice. Priority: must-have. Change: preserved
  > Socrates: More assertive wording may appear more useful but would violate the product's safety boundary. Resolution: preserve the existing framing.

### Authentication

- FR-004: User can register and sign in with email and password, then sign out. Priority: must-have. Change: new
  > Socrates: Authentication adds delivery and security cost. Resolution: keep it because user-linked access is an explicit MVP foundation.
- FR-005: Authenticated user can access only symptom-check records assigned to their account. Priority: must-have. Change: new
  > Socrates: Client-only filtering would be faster to build but would not provide real ownership isolation. Resolution: ownership must be enforced for every history operation.

### Saved Symptom Checks

- FR-006: Authenticated user can explicitly save a completed current-symptoms check. Priority: must-have. Change: new
  > Socrates: Automatic saving would create history faster but violates the explicit-intent privacy guardrail. Resolution: saving remains explicit.
- FR-007: Authenticated user can list and open their saved symptom checks. Priority: must-have. Change: new
  > Socrates: A list without details could technically satisfy read access but would not make records useful. Resolution: include list and individual record viewing.
- FR-008: Authenticated user can update symptoms and low/high intensity for each symptom in a saved check. Priority: must-have. Change: new
  > Socrates: Editing historical input can blur what originally happened. Resolution: allow only symptom changes and recalculate while preserving the record's original location and pollen context.
- FR-009: Authenticated user can delete one of their saved symptom checks. Priority: must-have. Change: new
  > Socrates: Retaining records may simplify implementation but denies the user control over personal symptom data. Resolution: deletion is required.
- FR-010: New allergen rankings remain independent of saved history. Priority: must-have. Change: preserved
  > Socrates: History personalization might increase relevance but adds unvalidated medical and ranking complexity. Resolution: history is display-only for this MVP.

### Current-Symptoms Experience

- FR-011: User can use current device location for the current-symptoms check. Priority: must-have. Change: new
  > Socrates: Browser location introduces permission and failure paths. Resolution: include it because manual city selection remains a complete fallback.
- FR-012: User can manually select a current city when device location is skipped, denied, unavailable, or fails. Priority: must-have. Change: preserved
  > Socrates: Removing manual selection would simplify the UI but make the flow dependent on permission and device support. Resolution: preserve the fallback.
- FR-013: User can set low/high intensity separately for every selected symptom. Priority: must-have. Change: modified
  > Socrates: Per-symptom intensity increases interaction cost and ranking complexity. Resolution: accept the cost because one overall intensity cannot represent mixed symptoms accurately.
- FR-014: User can identify at first glance when a result card lacks provider pollen data. Priority: must-have. Change: modified
  > Socrates: Existing fallback copy already communicates uncertainty, but it is easy to miss. Resolution: add a prominent warning label without hiding the result.

## Business Logic

Allergen Finder ranks likely allergens by combining the selected location, each reported symptom with its own low/high intensity, and pollen or environmental activity available for that place.

The existing rule changes from one overall symptom intensity to an intensity attached to each selected symptom. Missing pollen data remains unknown rather than being treated as low activity, and the result must visibly communicate that distinction.

Saving history does not alter future rankings. Updating a saved record's symptoms recalculates that record using its saved location and pollen context so the record remains tied to the original check conditions.

## Constraints & Preserved Behavior

- Existing URLs and guest current-symptoms and destination flows remain available.
- Existing city search, pollen lookup, result framing, and provider attribution continue working.
- Manual city selection remains the fallback for device-location failures.
- Existing saved records must remain readable if the saved-check representation evolves after initial release.
- Authentication and persistence additions must not expose one user's records to another user.
- No location or symptom record is persisted without an explicit save action.
- Deployment remains compatible with the existing containerized production target.
- The accepted public pollen-endpoint cost-abuse risk remains unchanged for this deadline; provider-side API restrictions, quotas, and billing alerts remain required.

## Non-Functional Requirements

- Existing guest current-symptoms flow remains completable in under 30 seconds in normal network conditions.
- A user receives a clear success or failure response for authentication and history mutations without ambiguous intermediate state.
- No authenticated user can read, update, or delete another user's saved symptom checks.
- Passwords are never displayed or recoverable in plaintext.
- Device location and symptom data are retained only after explicit saving.
- Result and history interfaces remain usable on current mainstream mobile and desktop browsers.
- All user-facing product copy remains available in Polish.
- At least one automated test set traces to a named risk in `test-plan.md`; cross-user history access is the primary required risk.

## Product Framing

- Product type: no change; existing web app.
- User scale: no change; a handful of initial users.
- Delivery window: four weeks, after-hours.
- Hard deadline: 2026-07-05.

## Timeline acknowledgment

Acknowledged on 2026-06-09: the four-week brownfield expansion requires sustained after-hours work; the user accepted the cost and fixed deadline.

## Non-Goals

- No history-driven personalization of future allergen rankings; history is display-only.
- No automatic saving of completed checks.
- No guest-owned or anonymous history.
- No social login, passwordless login, role hierarchy, or administration interface.
- No password recovery flow in this MVP.
- No editing of saved location, timestamp, or environmental context; only symptoms and their intensities are editable.
- No medical diagnosis, medication recommendations, treatment recommendations, or medical chatbot.
- No family accounts, shared records, exports, or collaborative history.
- No offline-first behavior or multi-region availability target.

## Forward: technical-roadmap

- Add the minimum authentication and user-owned persistence foundation needed by the vertical history slices.
- Add `test-plan.md` before implementing authenticated history tests. The first named risk is cross-user access to saved symptom checks.
- Add a configured test runner and an `npm test` script; colocate focused tests near the code under test.
- Treat password storage, session handling, authorization checks, and ownership filters as implementation-plan concerns, not PRD-level choices.
- Decide the exact saved-check snapshot fields during `/10x-plan` for the create/read history slice, constrained by the product rules above.

## Quality cross-check

- Access Control: present.
- Business Logic: present.
- Project artifacts: present.
- Timeline-cost acknowledgment: present.
- Non-Goals: present.
- Preserved behavior: present.
