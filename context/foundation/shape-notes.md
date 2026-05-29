---
project: "Allergen Finder"
context_type: greenfield
created: 2026-05-29
updated: 2026-05-29
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "context type"
      decision: "Greenfield — starting Allergen Finder from scratch."
    - topic: "pain category"
      decision: "Both decision paralysis from scattered data and missing capability because existing tools do not clearly connect pollen/environmental data to symptoms."
    - topic: "insight"
      decision: "Existing pollen apps show data but do not connect it clearly to symptoms, and there is no single place to get all the relevant data."
    - topic: "primary persona scope"
      decision: "Allergy sufferers who already get symptoms and want to know the cause, including people traveling into different places who want to prepare for symptoms."
    - topic: "auth strategy"
      decision: "Guest-first MVP; login is not required for the first check because it would slow the 30-second success metric."
    - topic: "role model"
      decision: "One flat user type; no role separation in MVP."
    - topic: "mvp proof flow"
      decision: "Two MVP proof flows: current symptoms at current location, and travel preparation for a selected destination."
    - topic: "timeline"
      decision: "User believes the MVP can ship in 3 weeks of after-hours work."
    - topic: "functional requirement priorities"
      decision: "FR-001, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-011, and FR-012 are must-have. FR-002 and FR-010 are nice-to-have."
    - topic: "symptom intensity scale"
      decision: "Use a low/high symptom intensity choice instead of a 1-5 scale to avoid false precision."
    - topic: "result trigger"
      decision: "Results should update automatically after required inputs are available rather than requiring a separate submit action."
    - topic: "history-based probability"
      decision: "History-based symptom probability should be available for both current symptoms and travel preparation flows when symptom history exists."
    - topic: "business logic"
      decision: "Allergen Finder ranks likely allergens by comparing the user's location, reported symptoms, symptom intensity, and current pollen/environmental activity."
    - topic: "product framing"
      decision: "Website or web app for a handful of initial users; same ranking rule regardless of user count; hard deadline 2026-07-05; after-hours work."
    - topic: "non-goals"
      decision: "No medical diagnosis, medication/treatment recommendations, medical chatbot, image analysis, health-device integrations, family accounts, long-term health forecasts, required symptom-history personalization for first-time users, required user accounts for MVP, or predictive AI model training."
  frs_drafted: 12
  quality_check_status: accepted
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-07-05
  after_hours_only: true
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
---

# Shape Notes

Seed source: `context/idea-notes.md`

## Vision & Problem Statement

People with seasonal inhalant allergies often do not know which allergens are responsible for their current symptoms. The pain appears when symptoms occur, or when the person travels into a different place and wants to prepare for likely symptoms.

The current workaround is to check pollen or environmental information across multiple services and interpret it manually. Allergen Finder exists because existing tools may show pollen levels, but they do not clearly connect scattered environmental data to the symptoms a person is actually experiencing.

## User & Persona

Primary persona: an adult allergy sufferer, age 18-55, who already experiences seasonal allergy symptoms from pollen or mold spores and wants to understand the likely cause of current or expected symptoms.

This persona reaches for the product when symptoms appear, or before traveling to a different place where allergen exposure may differ.

## Access Control

Users can use the MVP as a guest for the first allergen check.

The MVP has one flat user type. Login may exist to support saved history later, but it must not block the first current-symptoms or travel-preparation check. No admin, member, family, or other role separation is planned for the first version.

## Success Criteria

### Primary

- Current symptoms flow works end-to-end: a user shares current device location or manually enters the current city, selects current symptoms, sets intensity as low or high, and sees an automatically updated ranked list of likely current allergens with probability level, current pollen activity, and a short explanation.
- Travel preparation flow works end-to-end: a user searches for and selects a destination city, checks likely allergens for that place, and sees allergen/pollen risks and current pollen activity for the destination without needing to report symptoms.

### Secondary

- If the user has symptom history from previous app usage, the app can show a symptom probability level in both the current-symptoms flow and the travel-preparation flow; if there is no history, the travel-preparation flow only shows pollen activity for that destination.

### Guardrails

- The app must not present results as medical diagnosis.
- The app must not recommend medication or treatment.
- The app must not store location or symptom history without clear user intent.

## User Stories

### US-01: Current symptoms allergen check

- **Given** an allergy sufferer with a selected current city and selected symptoms
- **When** they set symptom intensity as low or high
- **Then** they see a ranked list of likely current allergens with probability level, current pollen activity, and a short explanation for each allergen.

#### Acceptance Criteria

- The user can complete the check with either device location or a manually selected current city.
- The result includes probability level, current pollen activity, and a short explanation for each listed allergen.
- The result is not presented as medical diagnosis.

## Functional Requirements

- FR-001: User can complete the first allergen check without logging in. Priority: must-have
  > Socrates: Counter-argument considered: login slows down the 30-second success metric. Resolution: revised to guest-first access; login must not block the first check.
- FR-002: User can share current device location. Priority: nice-to-have
  > Socrates: Counter-argument considered: no counter-argument; it stands as written. Resolution: kept as optional nice-to-have because manual city entry is the fallback.
- FR-003: User can search for and select a destination city. Priority: must-have
  > Socrates: Counter-argument considered: the travel flow cannot work without destination selection. Resolution: kept as must-have.
- FR-004: User can select current symptoms from a predefined list. Priority: must-have
  > Socrates: Counter-argument considered: symptom selection is necessary for current-cause matching. Resolution: kept as must-have.
- FR-005: User can set symptom intensity as low or high. Priority: must-have
  > Socrates: Counter-argument considered: a 1-5 scale may create false precision. Resolution: revised to low/high intensity.
- FR-006: User can receive an automatically updated current-symptoms allergen check after required inputs are selected. Priority: must-have
  > Socrates: Counter-argument considered: a separate submit action adds friction. Resolution: revised to automatic result updates.
- FR-007: User can view a ranked list of likely current allergens. Priority: must-have
  > Socrates: Counter-argument considered: ranking may overstate certainty. Resolution: kept, but results must be framed as likelihood rather than certainty.
- FR-008: User can view a compact probability level, current pollen activity, and short explanation for each allergen. Priority: must-have
  > Socrates: Counter-argument considered: too much detail may slow the 30-second goal. Resolution: kept with compact presentation as part of the requirement.
- FR-009: User can check allergen and pollen risks for a destination without reporting symptoms. Priority: must-have
  > Socrates: Counter-argument considered: without user symptoms, "risk" may be too personalized. Resolution: revised to allergen and pollen risk rather than personal symptom risk.
- FR-010: User can use symptom history for symptom probability in both current-symptoms and travel-preparation flows when history exists. Priority: nice-to-have
  > Socrates: Counter-argument considered: history-based probability should be accessible for both user flows. Resolution: revised from travel-only to both flows, while remaining nice-to-have.
- FR-011: User can see destination pollen activity with a brief explanation, without symptom probability, when no history exists. Priority: must-have
  > Socrates: Counter-argument considered: destination pollen activity may duplicate existing pollen apps unless explanation adds value. Resolution: kept as first-use fallback with brief explanation.
- FR-012: User can manually enter their current city when device location is unavailable or skipped. Priority: must-have
  > Socrates: Counter-argument considered: manual location entry is essential because device location is optional. Resolution: kept as must-have.

## Non-Functional Requirements

- A user can get from opening the app to a likely-allergen result in under 30 seconds.
- Results are not framed as diagnosis, treatment, or medication advice.
- Location and symptom history are stored only when the user clearly chooses to save them.
- The app remains usable on current mainstream mobile and desktop browsers.

## Business Logic

Allergen Finder ranks likely allergens by comparing the user's location, reported symptoms, symptom intensity, and current pollen/environmental activity.

The rule consumes user-facing inputs: current or destination location, selected symptoms, low/high symptom intensity where symptoms are provided, and current pollen or environmental activity for that place.

The output is a ranked set of likely allergens with probability level, current pollen activity, and a short explanation. The user encounters the output after entering symptoms for their current location, or after selecting a destination for travel preparation.

## Product Framing

- Product surface: website or web app.
- Initial audience size: handful of people.
- Scale note: allergen-ranking should stay the same regardless of user count.
- Hard deadline: 2026-07-05.
- Work mode: after-hours work.

## Non-Goals

- No medical diagnosis — results describe likely allergens, not clinical conclusions.
- No medication or treatment recommendations — the MVP does not advise what the user should take or do medically.
- No medical chatbot — the MVP does not provide conversational medical guidance.
- No image analysis — the MVP does not infer allergens or symptoms from photos.
- No health-device integrations — the MVP does not connect to wearables, sensors, or health devices.
- No family accounts — the MVP serves one person's allergy context at a time.
- No long-term health forecasts — the MVP focuses on current or destination allergen context, not long-term health prediction.
- No required symptom-history personalization for first-time users — first-time users can still get pollen and allergen context without prior history.
- No user accounts required for MVP — the first version must allow useful checks without account creation.
- No predictive AI model training — the MVP does not train a predictive model from user data.

## Quality cross-check

- Access Control: present.
- Business Logic: present.
- Project artifacts: present.
- Timeline-cost acknowledgment: present — 3-week MVP.
- Non-Goals: present.
- Preserved behavior: n/a for greenfield.
