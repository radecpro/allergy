# Frame Brief: F-01 Data Source Readiness

> Framing step before /10x-implement. This document captures what is
> actually at issue, separated from what was initially assumed.

## Reported Observation

F-01 needs an allergen/pollen ranking contract, but the user does not know where real location-specific allergen data will come from. They are unsure whether F-01 is ready for `/10x-implement`.

## Initial Framing (preserved)

- **User's stated cause or approach**: An external data source/API may be required before F-01 can be implemented.
- **User's proposed direction**: Pause before `/10x-implement` because the existing plan does not explain the external API.
- **Pre-dispatch narrowing**: F-01 readiness is the leading concern.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Roadmap scope boundary** - F-01 might be marked ready while actually needing live provider selection first.
2. **Existing F-01 plan boundary** - The implementation plan might omit a necessary external API/provider integration step.
3. **PRD/business logic dependency** - Product requirements might make location-specific pollen data mandatory before any useful contract can be implemented.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Roadmap requires provider selection before F-01 | F-01 is marked ready, has no prerequisites, and has no blockers. The provider question is listed as an unknown but `Block: no`. | NONE for blocking F-01 |
| Existing plan silently depends on external API work | The plan explicitly says F-01 creates a domain module without external pollen API integration, excludes external pollen/environmental API integration, and requires synchronous deterministic logic with no network dependency. | NONE for blocking F-01 |
| PRD requires real location-specific activity for MVP | The PRD requires current and destination pollen/environmental activity for end-to-end flows, and business logic consumes activity for a selected place. | PARTIAL: real product dependency, not F-01 blocker |
| Contract can proceed by defining normalized activity and fallback behavior | The plan defines `PollenActivityLevel`, ranking input as pollen activity by allergen ID, `unknown` fallback behavior, and later provider-scale normalization into this contract. | STRONG |

## Narrowing Signals

- The user selected **F-01 readiness** as the leading concern, not provider selection for the whole MVP.
- The roadmap records the data-source question as known but non-blocking for F-01.
- The plan requires `unknown` pollen activity to keep results usable instead of blocking.
- The plan says later data-source integration should normalize provider scales into this contract rather than changing route code to provider-native values.

## Cross-System Convention

For data-dependent product slices, the usual clean boundary is to define the domain contract before choosing or integrating a provider: stable internal IDs, normalized provider-independent activity levels, fallback behavior for missing data, and wording constraints. The leading hypothesis matches that convention. Provider selection belongs to the later integration slice that fetches current/destination activity, not to the foundational ranking contract.

## Reframed Problem Statement

> **The actual problem to plan around is**: F-01 must define a provider-independent allergen ranking and activity contract, including `unknown` fallback semantics, while explicitly leaving real location-specific data acquisition to a later slice.

The initial concern was valid as a product risk, but it was attached to the wrong slice. Real current/destination pollen data is needed for S-01 and S-02 to work end to end; F-01 only needs to define how such data will be represented, consumed, ranked, displayed, and handled when unavailable.

## Confidence

- **HIGH** - strong evidence from the roadmap, F-01 plan, plan brief, and PRD all point to the same boundary: F-01 is ready without choosing the provider.

## What Changes for /10x-implement

Proceed with `/10x-implement allergen-ranking-contract` under the existing plan. During implementation, do not add a live API, mock provider client, geocoding, or location lookup; implement the normalized activity scale, `unknown` fallback, ranking contract, destination activity output, Polish labels, and smoke checks.

## References

- Source files: `context/foundation/roadmap.md:50`, `context/foundation/roadmap.md:59`, `context/foundation/roadmap.md:62`
- Source files: `context/changes/allergen-ranking-contract/plan.md:5`, `context/changes/allergen-ranking-contract/plan.md:31`, `context/changes/allergen-ranking-contract/plan.md:122`, `context/changes/allergen-ranking-contract/plan.md:246`, `context/changes/allergen-ranking-contract/plan.md:250`
- Source files: `context/changes/allergen-ranking-contract/plan-brief.md:69`
- Source files: `context/foundation/prd.md:36`, `context/foundation/prd.md:37`, `context/foundation/prd.md:102`, `context/foundation/prd.md:104`
- Investigation tasks: `019e91df-6acb-7ec0-9c9a-843f44ddc456`, `019e91df-6b44-7041-9e3f-d4b28598c8f9`, `019e91df-6ba0-7262-8157-05fdf79e88bb`
