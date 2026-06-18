# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Keep Ranking Stable Until Complete

- **Context**: Saved symptom edit flows and ranking preview logic in `manage-saved-symptom-check`, especially where per-symptom intensity is edited or newly selected symptoms are added.
- **Problem**: When a user adds a symptom but has not chosen its intensity yet, the ranking disappears or flickers away. That makes the preview look broken and hides the last valid ranking even though the draft is merely incomplete.
- **Rule**: Never recompute or replace the displayed ranking until every selected symptom has an assigned intensity. While any selected symptom is missing intensity, keep the last valid ranking visible and treat the preview as incomplete instead of empty.
- **Applies to**: all
