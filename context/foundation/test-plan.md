# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-10

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** Use the cheapest layer that proves the user-visible or
   security behavior. Prefer deterministic unit or in-process integration
   tests over browser automation when both catch the same failure.
2. **User concerns are first-class evidence.** Guest access, explicit saving,
   private ownership, and non-diagnostic missing-data behavior are product
   contracts, not optional implementation details.
3. **Risks are scenarios, not code locations.** This plan records what can
   fail and why it matters. Each rollout's `/10x-research` must locate the
   actual entry points, persisted state, and provider boundaries before tests
   are planned. Research overrides guesses made here about implementation.

Hot-spot scope used for likelihood weighting: `app/domain/` (10 commits/30d),
`app/routes/` (7 commits/30d), and `app/components/` (2 commits/30d), measured
on 2026-06-10.

## 2. Risk Map

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | One authenticated user can read, update, or delete another user's saved check | High | Medium | PRD Success Criteria, US-02, FR-005; roadmap S-02 and S-03 |
| 2 | Authentication makes either existing guest check require login | High | Medium | PRD Guardrails, FR-001 and FR-002; roadmap S-01 |
| 3 | Location or symptom history is persisted without an explicit save action | High | Medium | PRD Guardrails, US-01 and US-03; roadmap S-02 and Parked scope |
| 4 | Per-symptom intensity is calculated inconsistently because part of the system still assumes one overall intensity | Medium | High | PRD US-04 and FR-013; roadmap S-04; hot-spot dir `app/domain/` (10 commits/30d) |
| 5 | Missing pollen data is presented as low activity or loses its visible warning | Medium | High | PRD US-04 and FR-014; roadmap S-06; archived guest-current-symptoms plan; hot-spot dir `app/domain/` (10 commits/30d) |
| 6 | Device-location denial or failure blocks the complete manual-city path | Medium | Medium | PRD US-03 and FR-012; roadmap S-05; hot-spot dir `app/routes/` (7 commits/30d) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | User B receives no record or mutation capability for User A's identifier across read, update, and delete | A hidden or filtered UI proves authorization | Session identity, owner-scoped persistence operations, response semantics, and fixtures for two users | integration | Interface-only filtering or repository mocks that bypass ownership predicates |
| #2 | Signed-out users can complete both current-symptoms and destination flows after auth lands | Public route rendering implies every dependent request remains public | Route guards, loader/action boundaries, session middleware, and guest request chain | integration plus focused route tests | Testing only authenticated happy paths |
| #3 | Completing checks and device-location lookup creates no record; only explicit save does | No visible history means nothing was persisted | Every write entry point, save action boundary, temporary auth handoff state, and stored fields | integration | Asserting button copy without inspecting persistence side effects |
| #4 | Mixed low/high symptom inputs produce the documented ranking through every consuming path | Updating the domain helper alone removes all single-intensity assumptions | Input contract, ranking boundary, route/component state, saved-record representation, and fixtures | unit plus focused integration | Copying the production calculation into expected values |
| #5 | Unknown remains distinct from low and renders a first-glance warning without suppressing results | Fallback explanation text alone is sufficiently visible | Provider normalization, result contract, warning rendering, and unknown-data fixtures | unit plus component or route integration | Snapshot-only checks or treating unknown as zero/low |
| #6 | Denied, unavailable, and failed geolocation all leave manual city selection fully usable | A fallback error message means the manual path still completes | Browser permission boundary, state transitions, city-search path, and denial/failure fixtures | focused component integration; e2e only if browser permission behavior is essential | Testing only successful geolocation or over-mocking the fallback state |

## 3. Phased Rollout

Each row is one discrete rollout phase with one change folder. Product slices
may add useful focused tests as they ship; dedicated rollout phases audit the
combined scenario and fill only material gaps.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Executable baseline | Standardize deterministic tests and document the risk contract | #4, #5 | unit + route-loader integration | complete | `context/changes/risk-based-test-foundation/` |
| 2 | Ownership and explicit-consent isolation | After S-01–S-03, prove guest access, explicit saving, and cross-user read/update/delete isolation together | #1, #2, #3 | integration | not started | — |
| 3 | Expansion-slice regressions | After S-04–S-06, audit mixed intensity, location fallback, and missing-data warning behavior | #4, #5, #6 | unit + focused integration | not started | — |

Status uses only `not started`, `change opened`, `researched`, `planned`,
`implementing`, and `complete`. `/10x-test-plan` opens one dedicated folder
for each later row after its named roadmap prerequisites are complete.

## 4. Stack

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + route-loader integration | Vitest | 4.1.x | Node environment; colocated TypeScript tests; no live provider calls |
| API mocking | none | n/a | Current baseline invokes loaders in process and avoids the external provider path |
| e2e / browser | none | n/a | Deferred; Phase 3 may justify a browser layer only for behavior unavailable below it |
| coverage | none | n/a | No provider or percentage threshold; named risks determine useful coverage |

**Stack grounding tools (current session):**
- Docs: official Vitest documentation — Vite 8, TypeScript, Node environment, and focused-run behavior checked during F-01 planning; checked: 2026-06-10.
- Search: npm package metadata — Vitest 4.1.x compatibility checked during F-01 planning; checked: 2026-06-10.
- Runtime/browser: none — browser tooling is outside the baseline and was not used; checked: 2026-06-10.
- Provider/platform: none — no platform quality gate is introduced by this rollout; checked: 2026-06-10.

## 5. Quality Gates

Quality gates remain local for this foundation. CI wiring is deliberately
deferred rather than implied by this plan.

| Gate | Where | Required? | Catches |
|---|---|---|---|
| unit + route-loader suite (`npm test`) | local handoff | required | ranking, safety-copy, provider-normalization, and request-guard regressions |
| TypeScript (`npm run typecheck`) | local handoff | required | type and route-contract drift |
| dependency audit (`npm audit --json`) | local release handoff | required | known dependency advisories, which must be fixed or documented |

## 6. Cookbook Patterns

### 6.1 Adding a unit test

- **Location**: colocated beside the domain module under `app/`.
- **Naming**: `<purpose>.test.ts` or `<purpose>.test.tsx`.
- **Reference test**: `app/domain/allergen-ranking/allergen-ranking.test.ts`.
- **Oracle policy**: assert explicit product values and failure outcomes; do
  not derive expected labels or scores with production helpers.
- **Run locally**: `npm test -- app/domain/allergen-ranking/allergen-ranking.test.ts`.

### 6.2 Adding a route-loader integration test

- **Location**: colocated with the owning domain or route behavior.
- **Pattern**: construct a `Request`, invoke the loader in process, and assert
  status plus serialized app-owned response fields.
- **Isolation**: bypass live providers and restore environment changes in
  `afterEach`.
- **Reference test**: `app/domain/current-location/current-location.test.ts`.
- **Run locally**: `npm test -- app/domain/current-location/current-location.test.ts`.

### 6.3 Adding an ownership or explicit-save test

TBD — see §3 Phase 2. Research must first ground the session, repository, and
persistence boundaries. The rollout must use two-user fixtures and cover
read, update, and delete, not merely filtered list output.

### 6.4 Adding an expansion-flow regression test

TBD — see §3 Phase 3. Reuse focused tests created by S-04 through S-06 and add
only gaps in the combined intensity, device-location fallback, and
missing-data-warning scenario.

### 6.5 Per-rollout-phase notes

Phase 1 replaced bespoke smoke scripts with one deterministic runner. Direct
loader invocation gives useful request/response coverage without network or
browser startup, while explicit expected values preserve independent product
oracles.

## 7. What We Deliberately Don't Test

- **Authentication or ownership behavior before S-01–S-03 exist** — fake tests
  would prove an invented boundary rather than production behavior.
- **Live Google requests** — deterministic tests stop at the provider boundary;
  provider availability and billing controls are operational concerns.
- **Broad route/component coverage** — add tests only when a named risk or
  delivered behavior justifies them.
- **Coverage percentages** — no threshold is useful enough to displace the six
  risk scenarios in this delivery window.
- **CI, browser, visual, accessibility, or AI-native tooling** — excluded from
  F-01; reconsider only when a later risk cannot be protected cheaply below
  that layer.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-10
- Stack versions last verified: 2026-06-10
- AI-native tool references last verified: 2026-06-10

Refresh (`/10x-test-plan --refresh`) when:

- a new top-three risk surfaces from the roadmap or archive,
- a recommended tool's checked date is older than three months,
- the project's tech stack changes,
- §7 negative space no longer matches the team's delivery boundary.
