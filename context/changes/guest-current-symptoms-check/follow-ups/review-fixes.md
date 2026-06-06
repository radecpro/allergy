# Review Fix Follow-ups

## F2 — Pollen endpoint abuse controls

- **Source**: context/changes/guest-current-symptoms-check/reviews/impl-review.md
- **Status**: pending
- **Risk**: `/api/current-pollen` accepts any syntactically valid `placeId` and can trigger geocoding plus pollen lookup, which makes it a public billable-call surface.
- **Recommended fix**: Add server-side abuse controls: cache by `placeId`, then add rate limiting or signed city-search tokens before public exposure.
- **Notes**: This likely depends on the final hosting/runtime platform, so it was not patched during the local implementation review triage.
