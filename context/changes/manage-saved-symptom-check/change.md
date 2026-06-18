---
change_id: manage-saved-symptom-check
title: Let users update or delete saved symptom checks
status: impl_reviewed
created: 2026-06-15
updated: 2026-06-18
archived_at: null
---

## Notes

Planned from roadmap slice S-03 and the completed codebase research.

Implementation review note: later `app/routes/home.tsx` copy-only commits
appeared in the post-plan git range, but they are unrelated to saved-check
management behavior and were treated as out-of-scope cleanup.

Follow-up implementation note: `/history` now also exposes inline delete
confirmation for each saved check. The list submits `intent=delete` to the
existing protected `/history/:checkId` action, so ownership checks and redirect
feedback remain centralized in the S-03 mutation boundary.
