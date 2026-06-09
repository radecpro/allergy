---
project: "Allergen Finder"
version: 3
status: draft
created: 2026-06-09
context_type: brownfield
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

# Allergen Finder PRD: Authenticated Symptom History Expansion

## Current System Overview

Allergen Finder is a full-stack TypeScript web application that connects a user's symptoms and location with likely allergen and pollen context. It uses React Router with a Node server runtime and currently has no database or authentication layer.

The app serves a handful of initial users through two completed guest flows. The current-symptoms flow accepts a manually selected city, selected symptoms, one overall low/high intensity, and current pollen activity, then automatically ranks likely allergens. The destination flow presents current environmental pollen context without requiring symptoms. Both flows use Polish, non-diagnostic wording.

## Problem Statement & Motivation

The current product demonstrates its ranking value but does not provide authenticated ownership or persistent user records. Users cannot deliberately save a completed symptom check, review it later, correct its symptoms, or delete it.

The expanded MVP must also satisfy four technical foundations by July 5, 2026: user-owned CRUD records, existing non-trivial business logic, automated tests tied to a documented risk, and authentication that limits each user to their own resources. The existing guest experience must remain intact while these capabilities are added.

## User & Persona

The primary persona remains an adult seasonal-allergy sufferer who wants to understand likely causes of current symptoms or environmental risks before travel.

This change additionally serves returning users who want a private record of checks they explicitly chose to save. They use history to review or correct a prior symptom record, not to personalize future rankings automatically.

## Success Criteria

### Primary

- A guest can still complete both existing allergen checks without authentication.
- A user can register or sign in with email and password, explicitly save a completed current-symptoms check, list and inspect only their saved checks, update saved symptoms and their individual intensities, and delete a saved check.
- Automated tests tied to a documented risk demonstrate that one user cannot access another user's saved checks.

### Secondary

- A user can use current device location in the current-symptoms flow and fall back to manual city selection when permission is denied or location is unavailable.
- Current-symptoms result cards make missing provider pollen data immediately visible through a warning label.

### Guardrails

- Existing guest current-symptoms and destination flows remain usable without login.
- A signed-in user cannot view or change another user's saved checks.
- Saving remains explicit; location and symptom history are not stored merely because a guest completed a check.
- Results remain Polish, non-diagnostic, and free of medication or treatment recommendations.
- The expanded MVP remains deliverable by July 5, 2026 as after-hours work.

## User Stories

### US-01: User explicitly saves a completed symptom check

- **Given** a guest or signed-in user has completed a current-symptoms check
- **When** they choose to save it and complete authentication if required
- **Then** the completed check is stored under their account and appears in their history

#### Acceptance Criteria

- Saving requires an explicit user action.
- Existing guest input is preserved through authentication.
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

## Scope of Change

### Preserved Guest Flows

- [preserved] FR-001: Guest can complete the current-symptoms allergen check without logging in. Priority: must-have.
  > Socrates: Requiring login would satisfy identity requirements but would regress the existing fast first-use flow. Resolution: preserve guest access and gate only saving/history.
- [preserved] FR-002: Guest can complete the destination pollen-risk check without logging in. Priority: must-have.
  > Socrates: Authentication could simplify one access model but adds no value to environmental destination context. Resolution: preserve the guest destination flow.
- [preserved] FR-003: User sees Polish, non-diagnostic allergen results without medication or treatment advice. Priority: must-have.
  > Socrates: More assertive wording may appear more useful but would violate the product's safety boundary. Resolution: preserve the existing framing.

### Authentication

- [new] FR-004: User can register and sign in with email and password, then sign out. Priority: must-have.
  > Socrates: Authentication adds delivery and security cost. Resolution: keep it because user-linked access is an explicit MVP foundation.
- [new] FR-005: Authenticated user can access only symptom-check records assigned to their account. Priority: must-have.
  > Socrates: Interface-only filtering would be faster to build but would not provide real ownership isolation. Resolution: ownership must be enforced for every history operation.

### Saved Symptom Checks

- [new] FR-006: Authenticated user can explicitly save a completed current-symptoms check. Priority: must-have.
  > Socrates: Automatic saving would create history faster but violates the explicit-intent privacy guardrail. Resolution: saving remains explicit.
- [new] FR-007: Authenticated user can list and open their saved symptom checks. Priority: must-have.
  > Socrates: A list without details could technically satisfy read access but would not make records useful. Resolution: include list and individual record viewing.
- [new] FR-008: Authenticated user can update symptoms and low/high intensity for each symptom in a saved check. Priority: must-have.
  > Socrates: Editing historical input can blur what originally happened. Resolution: allow only symptom changes and recalculate while preserving the record's original location and pollen context.
- [new] FR-009: Authenticated user can delete one of their saved symptom checks. Priority: must-have.
  > Socrates: Retaining records may simplify implementation but denies the user control over personal symptom data. Resolution: deletion is required.
- [preserved] FR-010: New allergen rankings remain independent of saved history. Priority: must-have.
  > Socrates: History personalization might increase relevance but adds unvalidated medical and ranking complexity. Resolution: history is display-only for this MVP.

### Current-Symptoms Experience

- [new] FR-011: User can use current device location for the current-symptoms check. Priority: must-have.
  > Socrates: Browser location introduces permission and failure paths. Resolution: include it because manual city selection remains a complete fallback.
- [preserved] FR-012: User can manually select a current city when device location is skipped, denied, unavailable, or fails. Priority: must-have.
  > Socrates: Removing manual selection would simplify the interface but make the flow dependent on permission and device support. Resolution: preserve the fallback.
- [modified] FR-013: User can set low/high intensity separately for every selected symptom. Priority: must-have.
  > Socrates: Per-symptom intensity increases interaction cost and ranking complexity. Resolution: accept the cost because one overall intensity cannot represent mixed symptoms accurately.
- [modified] FR-014: User can identify at first glance when a result card lacks provider pollen data. Priority: must-have.
  > Socrates: Existing fallback copy already communicates uncertainty, but it is easy to miss. Resolution: add a prominent warning label without hiding the result.

## Constraints & Compatibility

- Existing URLs and guest current-symptoms and destination flows remain available.
- Existing city search, pollen lookup, result framing, and provider attribution continue working.
- Manual city selection remains the fallback for device-location failures.
- Existing saved records remain readable if their representation evolves after initial release.
- No user can access saved checks assigned to another account.
- No location or symptom record is persisted without an explicit save action.
- Deployment remains compatible with the existing containerized production target.
- The accepted public pollen-endpoint cost-abuse risk remains unchanged for this deadline; provider-side API restrictions, quotas, and billing alerts remain required.

## Business Logic Changes

Allergen Finder ranks likely allergens by combining the selected location, each reported symptom with its own low/high intensity, and pollen or environmental activity available for that place.

The current rule changes from one overall symptom intensity to an intensity attached to each selected symptom. Missing pollen data remains unknown rather than being treated as low activity, and the result must visibly communicate that distinction.

Saving history does not alter future rankings. Updating a saved record's symptoms recalculates that record using its saved location and pollen context so it remains tied to the original check conditions.

## Access Control Changes

The current system has no identity or access separation. The change adds email-and-password registration, sign-in, and sign-out with one flat authenticated-user role.

Guest users retain access to both existing checks. Authentication is required only to save or manage symptom-check history. Each saved check belongs to one user, and every read, update, and delete operation is limited to that owner.

When a guest chooses to save a completed check, authentication must not discard the completed check that prompted the action.

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

## Open Questions

No open product questions. Exact persistence fields, authentication implementation, session handling, and test tooling are downstream planning decisions constrained by this PRD.
