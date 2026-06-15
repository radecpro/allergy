<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Email And Password Account Access

- **Plan**: `context/changes/email-password-account-access/plan.md`
- **Scope**: Full implementation and final MVP release across phases 1-4
- **Date**: 2026-06-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

No findings. The implementation matches the approved plan and all automated,
manual, managed-infrastructure, and release checks are complete.

## Verification Evidence

- `npm test`: PASS, 4 files and 87 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm run db:generate`: PASS, no schema changes.
- `npm run test:db`: PASS against a disposable PostgreSQL container.
- `npm run test:auth-live`: PASS against a disposable Firebase Auth emulator.
- Dedicated `Dockerfile.auth-live` build and containerized emulator preflight: PASS.
- `git diff --check`: PASS.
- `npm audit --json`: completed with 10 moderate, 0 high, and 0 critical advisories; accepted paths and rationale are documented in `README.md`.
- Read-only GCP audit: active project and region confirmed; enabled APIs, Cloud Run service/revision, project IAM, service accounts, Cloud SQL, Secret Manager availability, Cloud Run Jobs, billing metadata, and recent logs inspected.
- Focused 30-day log query found no password, ID-token, refresh-token, or session-cookie fields/text in the currently deployed guest-only revision.
- Full local-stack account smoke test: PASS against the real React Router server, a disposable PostgreSQL 17 database, and the Firebase Auth emulator. Registration redirected to the validated destination, issued a seven-day HTTP-only SameSite=Lax cookie, exposed the signed-in email on both product pages, signed out through POST, returned to guest state, and signed back in with the same stable local user.
- Local security smoke checks: duplicate registration and invalid credentials returned the same generic Polish message; malicious `returnTo` fell back to `/`; missing and cross-origin source evidence was rejected; a malformed serialized session cookie was cleared while public and login pages remained usable.
- Disposable database inspection: exactly one user row remained after registration and repeated sign-in; the row used a stable application UUID and provider UID, and the migration exposed only the six planned columns plus primary-key and two unique indexes.
- Headless rendered-browser verification: PASS at 390x844 and 1280x900. A signed-out user completed the current-symptoms and destination flows with the real local Maps-backed routes. Registration, persisted viewer email, POST sign-out, and subsequent sign-in worked with Polish copy at both widths, and all checked pages had no horizontal overflow.
- Identity Platform final-project policy audit: PASS. Email/password is enabled,
  passwords require 10-128 characters without composition rules, and improved
  email privacy is enabled.
- Runtime IAM audit: PASS. The dedicated service account has only Cloud SQL
  Client, Service Usage Consumer, and a custom Firebase role containing
  `firebaseauth.users.createSession` and `firebaseauth.users.get`; secret access
  is granted per secret.
- Cloud SQL release audit: PASS. PostgreSQL 17 is runnable in
  `europe-central2`, backups and point-in-time recovery are enabled, deletion
  protection is enabled, and migration execution
  `allergen-finder-migrate-4hwkd` completed successfully.
- Managed live-auth preflight: PASS. Execution
  `allergen-finder-auth-preflight-f6nkl` completed under the exact runtime
  service account using final-project pre-traffic double opt-in.
- No-traffic and final browser smoke tests: PASS against the tagged preview and
  canonical service URL. Both covered signed-out product flows, registration,
  secure session persistence, sign-out, and sign-in at mobile and desktop
  widths.
- Final Cloud Run release: PASS. Revision `allergen-finder-00005-cpg` is
  latest-ready and receives 100% traffic; the temporary preview tag was removed.
- Final log audit: PASS. No application errors and no password, ID-token,
  refresh-token, or session-cookie matches were found for the live revision or
  managed job executions.

## Review Notes

The implementation follows the planned boundaries: public allergen routes remain unguarded, auth mutations are POST-only and origin-checked, return paths are allowlisted, session issuance follows local-user persistence, optional and required session reads use different revocation modes, the schema contains only the minimal users table, and migrations remain explicit.

The first review's code findings were resolved before this report: deployed emulator rejection now precedes provider initialization, Origin parsing rejects path-bearing values, transient session dependencies no longer clear valid cookies, required-user redirects normalize `returnTo`, provider and infrastructure failures have safe status categories and structured non-PII logs, auth request bodies are bounded, database queries have timeouts, and the live preflight has a dedicated executable image and Cloud Run Job workflow.

The local full-stack smoke test found one additional serialization-level defect:
React Router returned `null` when a malformed encoded cookie was present, so the
session manager treated it like an absent cookie and did not expire it. The
manager now distinguishes cookie absence from malformed presence, clears the
malformed cookie before provider verification, and has a deterministic
regression test. The real-stack public-page and login-page checks both pass
after the fix.

The final review found no remaining plan drift, scope expansion, dangerous
decision, architecture violation, or substantive pattern mismatch. The
delegated review runners were unavailable because of the session's subagent
quota, so the final sweep was completed locally against the full plan, changed
source, release artifacts, deterministic tests, and managed-GCP evidence.
