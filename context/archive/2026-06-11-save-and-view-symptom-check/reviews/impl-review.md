<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Save and view private symptom checks

Date: 2026-06-12
Scope: Full plan, phases 1-4
Code findings: 0 unresolved

## Verdicts

| Dimension | Verdict | Evidence |
| --- | --- | --- |
| Plan Adherence | PASS | All planned implementation areas are present; discovered review fixes were documented in the plan contract. |
| Scope Discipline | PASS | No public sharing, editing, deletion, analytics, pagination, or unrelated product scope was added. |
| Safety & Quality | PASS | Trusted owner scoping, hardened origin checks, bounded parsing, strict idempotency, private caching, and additive migration behavior are covered. |
| Architecture | PASS | Snapshot, persistence, route-handler, and UI responsibilities remain separated behind typed contracts. |
| Pattern Consistency | PASS | Routes, tests, naming, error handling, and colocated module structure follow repository conventions. |
| Success Criteria | PASS | Automated, local browser, backup/restore, migration, no-traffic browser, and runtime-log checks pass. |

Overall code verdict: **APPROVED**

Overall change verdict: **APPROVED**

## Automated Evidence

- `npm test`: 10 files, 133 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `TEST_DATABASE_URL=... npm run test:db`: 2 files, 7 PostgreSQL integration tests passed.
- `git diff --check`: passed.
- Two independent implementation reviewers found no unresolved substantive code findings.
- Headless Chromium verification passed at 390x844 and 1280x900 against the
  real React Router server, Firebase Auth emulator, live local Maps-backed
  routes, and disposable PostgreSQL 17 database.
- Registration and sign-in pending-save handoffs preserved the exact stored
  snapshot and inserted only after final confirmation.
- Direct double-click created one row; cancellation and expiry created none.
- Two users saw only their own empty, one-record, and multi-record histories;
  foreign and random detail identifiers produced the same not-found page.
- Detail reproduced city, symptoms, intensity, unknown pollen, ranking, and
  non-diagnostic copy without horizontal overflow at either viewport.
- Successful detail navigation removed the one-time URL status and matching
  pending storage; refresh did not repeat the message.
- Cloud SQL retains seven automated backups and seven days of transaction logs
  with PITR and deletion protection enabled.
- The first restore correctly exposed that the only automated backup predated
  account-database provisioning. On-demand backup `1781209818491` then
  completed successfully and restored into a temporary PostgreSQL 17 instance.
- The restored database contained `public.users`, the
  `identity_platform_uid` column, and two user rows. The temporary instance was
  deleted after verification.
- Migration execution `allergen-finder-migrate-bxc5k` completed successfully;
  read-only verification found `symptom_checks`, both planned indexes, and zero
  pre-exposure rows.
- Managed auth execution `allergen-finder-auth-preflight-4v5sh` passed under
  the production runtime service account.
- No-traffic revision `allergen-finder-00011-dug` passed rendered-browser
  checks on the `s02` tag. Canonical traffic remained 100% on
  `allergen-finder-00005-cpg`.
- Preview and current release-job runtime logs contained no email, city,
  symptoms, snapshot content, owner identity, credential values, tokens, or
  cookies. Provider requests appeared only as clean POST paths with no city
  query, place ID, or other location value in the URL. Standard history
  request logs contained route/request UUIDs but no private record content or
  account identity.
- All dedicated smoke-account symptom-check rows were deleted after
  verification, leaving zero saved checks for that account.

## Review Fixes Verified

- Guest pending-save restoration mounts even when current results are absent.
- Protected loader headers propagate through route exports, including private no-store 404 responses.
- Direct double-clicks share one request ID and are guarded before asynchronous state updates.
- City changes clear stale pollen state and ignore out-of-order pollen responses.
- Signed-out loader/action behavior preserves redirects and session cookies.
- Explicit-consent integration coverage proves pollen lookup and check completion do not insert; only Save inserts.
- Direct retry idempotency fingerprints the validated submitted snapshot before server completion-time replacement.
- Repository calls without the trusted action fingerprint treat the full snapshot, including completion time, as canonical content.
- Browser verification found and fixed an index-route submission defect:
  `useFetcher` now targets `/?index`, so React Router invokes the home action
  rather than the actionless root layout.
- No-traffic verification found and fixed SSR/client date text drift by using
  the explicit `Europe/Warsaw` product timezone.
- Final privacy review found that Cloud Run request logs retained GET query
  strings for city search and pollen lookup. Both public non-mutating APIs now
  use bounded JSON POST bodies and no-store responses. Revision `00011-dug`
  repeated the full browser smoke with zero errors; its 71 log entries
  contained no query strings, encoded city names, place IDs, or private
  payload values.

## Pending Manual Evidence

None.
