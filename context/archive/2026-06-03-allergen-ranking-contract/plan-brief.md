# Allergen Ranking Contract — Plan Brief

> Full plan: `context/changes/allergen-ranking-contract/plan.md`

## What & Why

We are building the foundational TypeScript contract for Allergen Finder's allergen ranking and result framing. It exists so the current-symptom and destination flows can share the same pollen-focused catalog, labels, activity scale, fallback behavior, and non-diagnostic Polish wording instead of inventing separate contracts.

## Starting Point

The app is still a minimal React Router scaffold with one index route, no product data layer, no API behavior, no persistence, and no test runner. The roadmap marks F-01 as ready and warns that the contract should stay minimal rather than grow into data completeness work.

## Desired End State

The app has `app/domain/allergen-ranking/` as a small importable domain module. Current-symptom flows can receive ranked `high`/`medium`/`low` likelihood results with Polish display labels, while destination flows without symptoms/history receive an unranked pollen activity list. Missing pollen data is represented with `unknown` and explanatory copy instead of blocking the flow.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Scope | Contract plus small MVP catalog | Gives S-01 and S-02 real values to consume without overbuilding. |
| Ranking basis | Simple rule-based score | Keeps behavior transparent and easy to verify without implying medical precision. |
| Likelihood labels | Internal `high` / `medium` / `low`, Polish display labels | Preserves simple ranking labels while meeting the Polish-language app requirement. |
| Pollen activity | `unknown`, `low`, `moderate`, `high`, `very-high` | Handles missing data cleanly and leaves room for provider scale normalization. |
| Destination mode | Unranked activity list | Avoids implying personal symptom likelihood when no symptoms or history exist. |
| Missing pollen data | Keep result with `unknown` activity | Keeps flows usable while clearly lowering confidence. |
| MVP catalog | Pollen-only set | Matches the first launch scope and avoids broad medical/allergy sprawl. |
| Verification | Typecheck plus domain smoke checks | Catches scoring, fallback, wording, and language regressions without adding a full test runner yet. |
| Language | Polish user-facing output | The whole app should be available in Polish; this contract establishes that for allergen results. |

## Scope

**In scope:**

- Shared TypeScript domain contract.
- Pollen-only allergen catalog and compact symptom list.
- Polish display labels and explanation strings.
- Current-symptom rule-based ranking helper.
- Destination unranked pollen activity helper.
- Unknown pollen fallback behavior.
- Smoke verification command.

**Out of scope:**

- UI routes and user-facing forms.
- Destination search implementation.
- External pollen API integration.
- Database, auth, saved history, or personalization.
- Device location.
- Medication advice, treatment advice, diagnosis, predictive AI, or broad allergen categories.

## Architecture / Approach

Create an app-local `app/domain/allergen-ranking/` module imported through the existing `~/*` alias. Keep stable internal IDs in English for TypeScript maintainability, but emit Polish user-facing labels and explanations. Normalize future provider data into this contract rather than exposing provider-native scales to routes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Domain Contract & Polish Catalog | Types, IDs, Polish labels, and pollen-focused catalog | Catalog grows beyond MVP or labels mix English and Polish. |
| 2. Ranking & Polish Result Framing | Current-symptom ranking, destination activity output, unknown fallback | Copy implies diagnosis or destination output looks personalized. |
| 3. Verification Contract | Smoke checks, npm command, final typecheck/audit verification | Verification becomes too heavy or misses language regressions. |

**Prerequisites:** Existing React Router scaffold and F-01 change folder.
**Estimated effort:** About 1-2 focused sessions across 3 small phases.

## Open Risks & Assumptions

- The external pollen data source is still undecided, so this contract assumes later provider data will be normalized into the app's activity scale.
- Polish app-wide language is captured here because it affects F-01 directly, but the PRD should be updated later to make it a global product requirement.
- The initial pollen-only catalog may need adjustment once S-01 and S-02 meet real provider data.

## Success Criteria (Summary)

- Both launch flows can import one shared domain contract for pollen activity and result framing.
- Current-symptom outputs are ranked and Polish; destination outputs are activity-only and Polish.
- Smoke checks and `npm run typecheck` verify fallback behavior, labels, and non-diagnostic wording.
