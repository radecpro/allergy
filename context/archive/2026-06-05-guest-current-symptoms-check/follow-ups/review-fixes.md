# Review Fix Follow-ups

## F2 — Pollen endpoint abuse controls

- **Source**: context/changes/guest-current-symptoms-check/reviews/impl-review.md
- **Status**: accepted
- **Accepted on**: 2026-06-09
- **Accepted by**: project owner
- **Risk**: `/api/current-pollen` accepts any syntactically valid `placeId` and can trigger geocoding plus pollen lookup, which makes it a public billable-call surface.
- **Recommended fix**: Add server-side abuse controls: cache by `placeId`, then add rate limiting or signed city-search tokens before public exposure.
- **Acceptance rationale**: The project owner accepts this release risk to complete the MVP within the specified deadline.
- **Required mitigations**: Restrict the Google API key to the required APIs and deployment environment, and configure provider-side quotas and billing alerts before public exposure.
- **Deferred hardening**: Server-side caching, rate limiting, or signed city-search tokens remain post-MVP work.
