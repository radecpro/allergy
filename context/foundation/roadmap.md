---
project: Allergen Finder
version: 1
status: draft
created: 2026-06-02
updated: 2026-06-02
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Allergen Finder

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

People with seasonal inhalant allergies often do not know which allergens are responsible for symptoms they are having now, or what they should expect before traveling. Allergen Finder exists because current workarounds require checking scattered pollen or environmental services and interpreting the connection to symptoms manually.

## North star

In this roadmap, the north star means the first end-to-end product slice that proves the main user promise works. It is placed as early as its prerequisites allow because later work only matters if this flow is useful.

**S-01: Guest current-symptoms allergen check** — The first proof point is a guest user entering current symptoms and a current city, then seeing compact likely-allergen results with pollen activity and a non-diagnostic explanation.

## At a glance

| ID | Change ID | Outcome (user can ...) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | allergen-ranking-contract | (foundation) Minimal allergen, symptom, pollen-activity, and result-framing contract is in place for both launch flows | — | FR-004, FR-005, FR-007, FR-008, FR-009, FR-011, NFRs | done |
| S-01 | guest-current-symptoms-check | Complete a guest current-symptoms allergen check with manual city entry and compact likelihood results | F-01 | US-01, FR-001, FR-004, FR-005, FR-006, FR-007, FR-008, FR-012 | proposed |
| S-02 | destination-allergen-risk-check | Search for a destination city and see destination allergen and pollen risk without reporting symptoms | F-01 | FR-003, FR-009, FR-011 | proposed |

## Baseline

What's already in place in the codebase as of `2026-06-02` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — full-stack TypeScript web scaffold, routing, styling pipeline, and starter home route exist (`package.json:6-17`, `app/routes.ts:1-3`, `app/root.tsx:44-45`).
- **Backend / API:** partial — server and route scaffold exist, but no product loaders, actions, request handlers, or API behavior are wired (`package.json:6-13`, `app/routes/home.tsx:4-12`).
- **Data:** absent — no database driver, query layer, schema, migrations, or seed data are present (`package.json:11-28`).
- **Auth:** absent — no auth provider, session/token code, or route guards are present; only a public index route exists (`app/routes.ts:3`).
- **Deploy / infra:** partial — container artifact and manual production deployment record exist, but CI/CD and infrastructure-as-code are absent (`Dockerfile:1-22`, `context/deployment/deploy-plan.md:5-19`).
- **Observability:** partial — a local route error boundary exists, but structured logging, metrics, and external error tracking are absent (`app/root.tsx:48`, `react-router.config.ts:7`).

## Foundations

### F-01: Allergen Ranking Contract

- **Outcome:** (foundation) Minimal allergen, symptom, pollen-activity, probability-label, and non-diagnostic explanation contract is in place for the current and destination checks.
- **Change ID:** allergen-ranking-contract
- **PRD refs:** FR-004, FR-005, FR-007, FR-008, FR-009, FR-011, NFRs
- **Unlocks:** S-01, S-02; verifies that result language avoids diagnosis, treatment, and medication advice before either user-facing flow ships.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Which pollen or environmental data source is acceptable for MVP implementation? — Owner: team. Block: no.
- **Risk:** If this contract grows beyond the minimum needed for the two launch flows, the roadmap spends effort on data completeness before users can try the product.
- **Status:** done

## Slices

### S-01: Guest Current-Symptoms Allergen Check

- **Outcome:** User can complete a guest current-symptoms allergen check with manual city entry, symptom selection, low/high intensity, automatic result updates, and compact likelihood results.
- **Change ID:** guest-current-symptoms-check
- **PRD refs:** US-01, FR-001, FR-004, FR-005, FR-006, FR-007, FR-008, FR-012
- **Prerequisites:** F-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:**
  - Which exact symptom options belong in the MVP predefined list? — Owner: team. Block: no.
  - What fallback should appear when current pollen activity is unavailable for the entered city? — Owner: team. Block: no.
- **Risk:** This is first because it proves the symptom-to-allergen value directly; if result language sounds too certain, the product violates its non-diagnosis guardrail.
- **Status:** proposed

### S-02: Destination Allergen Risk Check

- **Outcome:** User can search for a destination city and see current destination allergen and pollen risk with a brief explanation, without reporting symptoms or needing saved history.
- **Change ID:** destination-allergen-risk-check
- **PRD refs:** FR-003, FR-009, FR-011
- **Prerequisites:** F-01
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:**
  - What destination search scope is acceptable for the MVP: city-only, city plus country, or another minimal disambiguation? — Owner: team. Block: no.
- **Risk:** This follows the same contract as S-01 so travel preparation can ship without accounts or symptom history; over-personalizing the wording would conflict with first-use fallback requirements.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | allergen-ranking-contract | Define minimal allergen ranking and result framing contract | yes | Run `/10x-plan allergen-ranking-contract` |
| S-01 | guest-current-symptoms-check | Build guest current-symptoms allergen check | no | Depends on F-01 |
| S-02 | destination-allergen-risk-check | Build destination allergen risk check | no | Depends on F-01 |

## Open Roadmap Questions

No open roadmap questions.

## Parked

- **Device location sharing** — Why parked: FR-002 is nice-to-have, and FR-012 keeps manual current-city entry as the launch fallback.
- **Saved symptom history and history-based probability** — Why parked: FR-010 is nice-to-have, and FR-011 keeps destination pollen activity useful without history.
- **Login and user accounts** — Why parked: PRD Access Control says guest use must not be blocked, and the MVP has no required account flow.
- **Medical diagnosis** — Why parked: PRD Non-Goals exclude clinical conclusions; results describe likely allergens only.
- **Medication or treatment recommendations** — Why parked: PRD Non-Goals exclude advice about what a user should take or do medically.
- **Medical chatbot** — Why parked: PRD Non-Goals exclude conversational medical guidance.
- **Image analysis** — Why parked: PRD Non-Goals exclude inferring allergens or symptoms from photos.
- **Health-device integrations** — Why parked: PRD Non-Goals exclude wearables, sensors, and health-device connections.
- **Family accounts** — Why parked: PRD Non-Goals scope the MVP to one person's allergy context at a time.
- **Long-term health forecasts** — Why parked: PRD Non-Goals keep the product focused on current or destination allergen context.
- **Required symptom-history personalization for first-time users** — Why parked: PRD Non-Goals preserve usefulness without prior history.
- **Predictive AI model training** — Why parked: PRD Non-Goals exclude training a predictive model from user data.

## Done

- **F-01: (foundation) Minimal allergen, symptom, pollen-activity, probability-label, and non-diagnostic explanation contract is in place for the current and destination checks.** — Archived 2026-06-09 → `context/archive/2026-06-03-allergen-ranking-contract/`. Lesson: —.
