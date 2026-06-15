# Email And Password Account Access — Plan Brief

> Full plan: `context/changes/email-password-account-access/plan.md`

## What & Why

Add email-and-password registration, sign-in, and sign-out while preserving both existing guest allergen checks. This slice also creates the minimum stable local identity that later saved-check work needs to enforce record ownership.

## Starting Point

The React Router app has two public product routes, public pollen/city resource routes, deterministic Vitest coverage, and no authentication or database layer. Guest check state is currently route-local and must remain usable without an account.

## Desired End State

Guests can register, sign in, and sign out through Polish server-rendered routes. A successful authentication creates a secure seven-day session and a minimal PostgreSQL user mapping; both existing checks remain public and display shared signed-in or signed-out account controls.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Credential authority | Google Cloud Identity Platform | Avoids application-owned password hashing and fits the existing GCP deployment. |
| Local identity | Minimal PostgreSQL `users` table | Gives S-02/S-03 a stable owner foreign key without pulling saved-check schema forward. |
| Password policy | 10-128 characters, no composition rules | Supports strong passphrases without brittle symbol/case requirements. |
| Session lifetime | Seven days | Balances returning-user convenience with private-history exposure. |
| Email verification | Not required for MVP access | Avoids email-delivery and recovery scope within the deadline. |
| Error privacy | Generic provider failures | Reduces email enumeration while retaining specific field validation. |
| Return navigation | Validated internal GET page `returnTo`, default `/` | Supports future save handoff without open redirects, auth loops, or redirects to resource/mutation routes. |
| Account UI | Shared controls on both guest routes | Makes session state visible without redesigning product navigation. |
| Revocation checks | Required on auth-route redirects and protected operations | Keeps public-page viewer reads cheap while preventing revoked-session login loops and protecting private mutations. |
| Local Firebase path | Authentication emulator | Avoids service-account keys and unsupported ordinary gcloud end-user ADC during development. |
| Runtime Firebase IAM | Custom session role | Limits Cloud Run to session creation and user lookup instead of broad authentication administration. |
| Abuse controls | Provider policy, enumeration protection, quotas/monitoring | Provides meaningful protection without distributed rate-limit infrastructure. |
| Test layer | Deterministic server tests plus opt-in integrations | Covers security boundaries and the real upsert contract while isolating live auth verification in an explicit release preflight. |

## Scope

**In scope:**

- Identity Platform registration and sign-in REST adapter.
- Firebase Admin seven-day HTTP-only session cookies.
- Drizzle/PostgreSQL user schema, migration, bounded pool, and repository.
- Trusted `APP_ORIGIN` validation for every authentication mutation.
- Opt-in `npm run test:db` verification against a disposable PostgreSQL database.
- Emulator-backed local auth plus a no-traffic Cloud Run live-session preflight.
- `/register`, `/login`, and POST `/logout`.
- Root optional-viewer loader plus a revocation-aware helper for auth-route redirects and future required-user checks.
- Shared account navigation on `/` and `/destination`.
- Deterministic auth tests, disposable-database repository verification, environment documentation, and production rollout notes.

**Out of scope:**

- Saved checks, history, explicit save, and cross-user record operations.
- Password reset, verification gating, profile/account management, and social login.
- Current-check state preservation across authentication.
- Application session tables, refresh-token storage, and multi-device logout.
- Distributed rate limiting, reCAPTCHA/App Check, browser tests, and live-provider calls from the default `npm test` suite.

## Architecture / Approach

React Router actions validate credentials, exact `APP_ORIGIN` source evidence, and a safe GET page `returnTo`, then call Identity Platform server-to-server. `Origin` is required when present; a matching full-origin `Referer` is the only fallback when `Origin` is absent, and missing or `null` evidence fails closed. On success, the app upserts the provider identity into PostgreSQL and only then exchanges the ID token for a seven-day Firebase session cookie. The root loader performs optional signature/expiry verification for shared viewer state; login/register redirects and later private routes use the revocation-aware helper. Invalid sessions are cleared before presenting login again. The default suite uses fakes, while `npm run test:db` separately applies migrations and verifies the real repository against `TEST_DATABASE_URL`. Local Firebase work uses the Auth emulator; release verification runs a live session preflight under the no-traffic Cloud Run revision's runtime service account.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. PostgreSQL Identity Foundation | User table, migration, bounded pool, repository | An oversized or premature schema complicates rollback and later ownership. |
| 2. Identity Platform And Session Boundary | Provider adapter, validation, cookies, auth helpers | Tokens leak, redirects escape the app, or sessions issue before local identity exists. |
| 3. Account Routes And Shared Navigation | Register/login/logout UX and viewer controls | Authentication accidentally gates or disrupts guest flows. |
| 4. Verification And Production Readiness | Focused tests and GCP/Cloud SQL rollout | Local behavior passes while production configuration remains unsafe or incomplete. |

**Prerequisites:** Completed risk-based test foundation; Identity Platform and PostgreSQL access for live non-production verification.

**Estimated effort:** About 4-6 focused implementation sessions across four phases.

## Open Risks & Assumptions

- Identity Platform recommends verified-email flows for stronger account assurance; the MVP consciously accepts immediate unverified access.
- Duplicate registration may remain distinguishable at the provider API, so application mapping and endpoint monitoring are still required.
- A provider account can exist without a local row if PostgreSQL fails after registration; later sign-in repairs this idempotently.
- Cloud Run scaling multiplies PostgreSQL pools, so per-instance pool size and `max-instances` must remain coordinated.
- Sign-out clears only the current browser cookie; it does not revoke every session for the account.

## Success Criteria (Summary)

- Registration, sign-in, seven-day session persistence, and sign-out work with Polish, enumeration-resistant responses.
- Signed-out users can still complete both existing allergen checks and use their public resource routes.
- Every authenticated session resolves to one stable local user ID suitable for future owner-scoped saved checks.
