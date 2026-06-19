<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Email And Password Account Access

Reviewed: 2026-06-10
Plan: `context/changes/email-password-account-access/plan.md`
Verdict: ready for implementation after accepted revisions

## Findings

### PR-01 — Authentication redirects can loop or block re-authentication

- **Severity:** High
- **Status:** resolved
- **Plan references:** lines 51, 65, 148, 172-177, 220, 228, 236, 244
- **Provider reference:** `https://firebase.google.com/docs/auth/admin/manage-cookies`

The plan defines the optional viewer check as signature/expiry-only, while the
login and registration routes redirect an "already-authenticated" user away
from the form. Firebase documents that detecting revoked, deleted, or disabled
users requires `verifySessionCookie(..., true)`. A revoked or disabled cookie
can therefore still satisfy the cheap viewer check.

This creates a redirect cycle once protected routes exist: the required-user
helper redirects to `/login`, the login loader treats the cookie as an active
session and redirects back to the protected route, and the protected route
rejects it again. The plan also accepts every same-origin `returnTo`, so values
such as `/login?returnTo=/login`, `/register?returnTo=/register`, or `/logout`
can create self-redirects or redirect a successful authentication to a
POST-only resource route.

**Required revision:** define the authentication redirect state machine:

1. Login/register loaders may redirect only after a revocation-aware check, or
   they must render the form instead of redirecting based on the optional
   viewer helper.
2. Revoked, disabled, expired, malformed, or locally unresolved sessions must
   be cleared on the redirect or response that asks the user to sign in.
3. `returnTo` validation must reject authentication endpoints and other paths
   that cannot be valid GET redirect targets, in addition to rejecting
   external origins.
4. Add route tests for revoked/disabled cookies and self-referential
   `returnTo` values.

**Resolution:** Accepted. The plan now requires revocation-aware checks before
login/register redirect authenticated users, clears invalid or locally
unresolved sessions when re-authentication is required, restricts `returnTo`
to internal GET page destinations, rejects auth/API/mutation-only targets, and
adds revoked-session loop and self-redirect regression tests.

- **Decision:** FIXED

### PR-02 — The CSRF fallback is not an enforceable security contract

- **Severity:** High
- **Status:** resolved
- **Plan references:** lines 150-156, 228, 236, 244, 350
- **Security reference:** `https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html`

The plan requires a matching `Origin` but leaves a "narrowly documented
same-origin fallback" undefined. Accepting a request merely because `Origin`
is missing defeats the check. This matters for sign-in as well as sign-out:
login CSRF can place a victim into an attacker's account before any existing
session cookie is present.

The target origin is also described as the request origin without defining how
it is trusted behind Cloud Run's proxy. OWASP recommends checking `Origin`,
falling back to a full-origin `Referer` check, and blocking when neither is
present; it also calls out proxy-aware target-origin configuration.

**Required revision:** specify one exact production rule. Recommended:

- compare `Origin` to a trusted configured application origin;
- when `Origin` is absent, compare the full `Referer` origin;
- reject when both are absent or either is `null`;
- permit any test-only bypass only through injected test dependencies, never a
  runtime environment branch;
- test missing, null, malformed, cross-origin, and proxy-facing cases.

**Resolution:** Accepted. The plan now compares exact parsed source origins to
a configured `APP_ORIGIN`, uses a full-origin `Referer` check only when
`Origin` is absent, rejects missing/`null`/malformed/untrusted evidence, avoids
trusting proxy-facing request headers, permits test substitution only through
dependency injection, and adds edge-case and pre-side-effect tests.

- **Decision:** FIXED

### PR-03 — Repository fakes cannot prove the planned PostgreSQL upsert

- **Severity:** Medium
- **Status:** resolved
- **Plan references:** lines 89, 97, 105, 119-127, 185, 191, 296, 326, 358

The stable local user ID is a prerequisite for all later ownership checks, but
the automated suite is prohibited from making PostgreSQL requests. A fake
repository can prove orchestration order; it cannot prove the Drizzle
`INSERT ... ON CONFLICT` target, returned ID, email synchronization, unique
constraints, or concurrent/repeated sign-in behavior. The manual migration
check only verifies columns and indexes.

This makes the Phase 1 criterion that repository tests "prove stable
idempotent mapping" stronger than the planned test layer can demonstrate.

**Required revision:** separate service-contract tests from persistence
verification. Add an opt-in repository integration command against a
disposable PostgreSQL database, kept outside the default deterministic
`npm test`, and require it before Phase 1 approval. It should apply the
migration and prove repeated upserts return one stable application user while
updating canonical/normalized email correctly.

**Resolution:** Accepted. The plan now adds an opt-in `npm run test:db`
command and isolated Vitest configuration using a mandatory
`TEST_DATABASE_URL`. The suite applies committed migrations to a disposable
database and verifies stable IDs, provider-UID lookup, and synchronized email
updates through the real Drizzle repository. Default `npm test` continues to
exclude PostgreSQL integration tests.

- **Decision:** FIXED

### PR-04 — Firebase runtime and local credential setup is underspecified

- **Severity:** Medium
- **Status:** resolved
- **Plan references:** lines 109-113, 172, 304, 312, 334-337
- **Provider references:** `https://firebase.google.com/docs/admin/setup`,
  `https://cloud.google.com/identity-platform/docs/access-control`

The rollout says to grant "required Identity Platform access" but does not name
the permissions used by the selected design. Identity Platform documents
`firebaseauth.users.createSession` for session-cookie creation; revocation and
disabled-user checks also require user lookup access. Without an explicit
runtime role or custom-role contract, the application can register and sign
in through the API-key REST calls yet fail only when creating or validating
the server session.

The local setup is similarly ambiguous. Firebase documents that standard
`gcloud auth application-default login` end-user credentials are not accepted
by Firebase Authentication unless a custom OAuth client is used. "Local ADC"
is therefore not an executable instruction by itself.

**Required revision:** name the enabled APIs and least-privilege runtime
permissions/role used for session creation and revocation checks. Choose and
document one supported local path, such as the Auth emulator, service-account
impersonation if verified for this SDK flow, or ADC created with the required
custom OAuth client. Add a startup/preflight check or smoke-test step that
fails before traffic movement when the runtime identity cannot create and
verify a session cookie.

**Resolution:** Accepted. The plan now enables the Identity Toolkit API,
assigns the runtime service account a custom Firebase role containing only
`firebaseauth.users.createSession` and `firebaseauth.users.get` plus Service
Usage Consumer, and explicitly rejects broad Firebase admin roles. Local
development uses the Firebase Authentication emulator with a matching project
ID and no service-account key or ordinary gcloud end-user ADC. A separate
live-auth preflight proves sign-in, session creation, and both verification
modes under the no-traffic Cloud Run runtime identity before traffic moves.

- **Decision:** FIXED

## Verified Strengths

- The plan preserves all four existing public route paths and explicitly
  avoids a global authentication guard.
- Provider, repository, session, and route boundaries are separated well
  enough for deterministic service and route tests.
- Session issuance is correctly sequenced after local-user persistence, and
  the repair-on-sign-in path handles partial registration failure without
  retaining refresh tokens.
- The additive migration and bounded Cloud Run pool preserve rollback
  compatibility with the current guest-only revision.
- The password and provider-error policies align with the documented MVP scope,
  including generic handling of `EMAIL_EXISTS` and invalid-login responses.

## Triage

All four findings were accepted and resolved in the plan on 2026-06-10.
