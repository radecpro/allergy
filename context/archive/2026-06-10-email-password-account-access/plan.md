# Email And Password Account Access Implementation Plan

## Overview

Add email-and-password registration, sign-in, and sign-out without placing either existing allergen check behind authentication. Google Cloud Identity Platform owns credentials, Firebase Admin session cookies provide seven-day server-side sessions, and PostgreSQL stores a minimal local user record that later saved-check slices can reference for ownership.

## Current State Analysis

The application is a server-rendered React Router 7 app with two public product routes and two public resource routes. It has no authentication provider integration, database driver, schema, migrations, user repository, session cookie, validation boundary, or account UI. Guest check state is route-local React state, so authentication can be added around the application without changing the existing ranking and pollen request contracts.

The risk-based test foundation is complete and supports deterministic Vitest tests in a Node environment. The account slice must establish testable provider and repository boundaries while preserving the current rule that automated tests never call live providers.

## Desired End State

A guest can register with a valid email and a 10-128 character password, sign in, and sign out through Polish account routes. Successful registration or sign-in creates a seven-day HTTP-only Identity Platform session cookie and ensures a minimal local user exists in PostgreSQL. Both existing checks and their resource routes remain available while signed out, and both product routes display a compact shared account control.

The server exposes one optional-user helper for public pages and one revocation-aware required-user helper for authentication and future private history operations. Safe internal GET page return paths are supported for the future save handoff, while invalid, external, authentication, API, and mutation-only destinations fall back to `/`. Provider errors do not reveal whether an email belongs to an account.

### Key Discoveries:

- All routes are explicitly registered in `app/routes.ts`; no implicit filesystem route registration exists (`app/routes.ts:3`).
- The current product pages are public client-state flows with no loaders or actions and must remain unguarded (`app/routes/home.tsx:51`, `app/routes/destination-search.tsx:67`).
- The root route currently has no loader and is the natural shared boundary for optional viewer state (`app/root.tsx:44`).
- The test strategy names guest-route regression as a high-impact risk and prefers server integration plus focused route tests (`context/foundation/test-plan.md:35`, `context/foundation/test-plan.md:46`).
- The infrastructure decision already selects PostgreSQL, server-only authentication modules, explicit migrations, Secret Manager, and bounded Cloud Run database pooling (`context/foundation/infrastructure.md`).
- Identity Platform REST registration and sign-in return an ID token that Firebase Admin can exchange for a session cookie; session-cookie lifetime may be between five minutes and two weeks.
- Normal Firebase session-cookie verification uses cached public keys, while revocation checking adds a provider request. This supports cheap optional viewer reads and stronger checks on protected operations.
- Identity Platform password policy supports a 10-character minimum and 128-character maximum without composition requirements.
- Identity Platform email-enumeration protection normalizes invalid sign-in errors, but duplicate registration can still return an account-specific provider error. Application error mapping must therefore remain generic.

## What We're NOT Doing

- No saved symptom-check table, history route, explicit-save action, or ownership query.
- No preservation of current-check form state across authentication; S-02 owns that handoff.
- No password reset, email-change, account deletion, profile page, or multi-device session management.
- No email-verification gate or verification-email workflow.
- No social login, passwordless login, multi-factor authentication, roles, or administration UI.
- No application-owned password hashes or refresh-token storage.
- No database-backed application session table; Identity Platform session cookies remain stateless.
- No application-level distributed rate limiter, App Check, or reCAPTCHA integration.
- No Playwright, browser automation, or live Identity Platform/Cloud SQL calls from `npm test`.
- No global route guard around `/`, `/destination`, `/api/city-search`, or `/api/current-pollen`.
- No automatic migration execution during application startup.

## Implementation Approach

Keep authentication server-rendered and route-action based. Registration and sign-in actions validate form input, validate the request origin, normalize a safe internal GET page `returnTo`, call a server-only Identity Platform REST adapter, upsert the local user, and exchange the returned ID token for a seven-day Firebase Admin session cookie. The browser never needs to retain an Identity Platform refresh token or maintain a parallel client-side auth state.

Use Drizzle with `pg` for the first PostgreSQL boundary. Commit generated SQL migrations and run them as an explicit release step. The local `users` table provides an application-owned primary key plus unique provider UID and normalized email fields; later saved checks will reference the application user ID rather than accepting any owner identifier from the browser.

Expose viewer identity through the root loader. Public routes consume that state only for account navigation and are never redirected when the cookie is absent. Authentication routes and future protected routes call a separate helper that verifies revocation and resolves the local user. Protected routes redirect safely to `/login?returnTo=...` when authentication is missing or invalid, and any invalid session cookie is cleared on that response.

## Critical Implementation Details

### State Sequencing

Registration and sign-in must not issue the session cookie until the local user upsert succeeds. If Identity Platform registration succeeds but PostgreSQL fails, leave the provider account intact, return a generic failure, and allow a later sign-in to repair the missing local mapping. Do not attempt a compensating provider-user deletion, and never store the provider refresh token.

### User Experience Spec

Authentication routes and errors remain in Polish. Field-level email/password validation may be specific, but provider failures use generic wording. Signed-out navigation shows `Zaloguj się`; signed-in navigation shows the account email and a POST sign-out control on both product routes. Invalid or expired cookies are cleared without blocking guest content.

### Timing & Lifecycle

The seven-day cookie is created only from a freshly authenticated ID token. Optional public-page identity checks verify signature and expiry without revocation lookup. Login and registration loaders use the revocation-aware helper before redirecting an already-authenticated user, and future private loaders and actions use the same stronger check. Revoked, disabled, expired, malformed, or locally unresolved sessions are cleared when the application asks the user to authenticate again. Sign-out clears the current browser cookie but deliberately does not revoke all of the user's sessions.

## Phase 1: PostgreSQL Identity Foundation

### Overview

Introduce the smallest typed persistence boundary required to give authenticated users a stable application-owned identity for later saved-check ownership.

### Changes Required:

#### 1. Database and migration dependencies

**Files**: `package.json`, `package-lock.json`, `drizzle.config.ts`, `vite.config.ts`, `vitest.db.config.ts`

**Intent**: Add a conventional PostgreSQL schema and migration workflow without tying migrations to application startup.

**Contract**: Add `drizzle-orm` and `pg` runtime dependencies plus `drizzle-kit` and PostgreSQL types as development dependencies. Add repository-owned commands for generating committed migrations, applying pending migrations, and running the opt-in PostgreSQL repository integration suite. Configure Drizzle for PostgreSQL with the schema under `app/db/` and generated SQL under `drizzle/`; production migration commands read `DATABASE_URL`, while the integration suite requires a separate `TEST_DATABASE_URL`. Exclude `*.integration.test.ts` from default Vitest discovery and use `vitest.db.config.ts` to include only database integration tests for `npm run test:db`.

#### 2. User schema and initial migration

**Files**: `app/db/schema.server.ts`, `drizzle/**`

**Intent**: Create the application identity record that future saved checks can reference independently of provider implementation details.

**Contract**: Define a `users` table with an application-generated UUID primary key, unique non-null Identity Platform UID, canonical email, unique normalized email, and created/updated timestamps. The migration is additive and safe for an empty database. It must not create saved-check, role, password, refresh-token, or session tables.

#### 3. Bounded database client

**Files**: `app/db/client.server.ts`

**Intent**: Provide one server-only Drizzle client while preventing Cloud Run instance scaling from multiplying large default pools.

**Contract**: Initialize `pg.Pool` lazily from `DATABASE_URL`, use a small explicit per-instance maximum, finite connection timeout, idle cleanup, and an idle-client error handler that does not expose credentials. Export the typed Drizzle client for repositories. Tests must be able to avoid constructing the production pool.

#### 4. Local user repository

**Files**: `app/domain/auth/user-repository.server.ts`, `app/domain/auth/types.ts`

**Intent**: Keep identity persistence behind a typed boundary so route actions and future ownership checks do not issue SQL directly.

**Contract**: Define the authenticated local-user shape and repository operations to upsert a provider user by provider UID, keep canonical/normalized email synchronized, and resolve a local user by provider UID. The upsert returns the stable application user ID and is idempotent across registration and repeated sign-in.

#### 5. PostgreSQL repository integration verification

**Files**: `app/domain/auth/user-repository.integration.test.ts`, `vitest.db.config.ts`

**Intent**: Prove the real Drizzle schema, migration, constraints, and upsert behavior without allowing the default deterministic suite to contact PostgreSQL.

**Contract**: Add `npm run test:db` as an explicit opt-in command requiring `TEST_DATABASE_URL` for a dedicated disposable PostgreSQL database. The command must fail clearly when the variable is absent and must not fall back to `DATABASE_URL`. Its setup applies the committed migrations before exercising the real repository. Tests create unique provider identities, prove repeated upserts return one stable application user ID, prove canonical and normalized email fields update together, prove lookup by provider UID resolves the same record, and clean up test-owned rows. The suite must not call Identity Platform, Firebase, Google Maps, or a production database.

#### 6. Environment contract

**Files**: `.env.example`, `README.md`

**Intent**: Make database and authentication prerequisites discoverable without committing secrets.

**Contract**: Document `DATABASE_URL`, opt-in `TEST_DATABASE_URL`, `GOOGLE_CLOUD_PROJECT`, `IDENTITY_PLATFORM_API_KEY`, the canonical public `APP_ORIGIN`, and local-only `FIREBASE_AUTH_EMULATOR_HOST` alongside the existing Maps key. `TEST_DATABASE_URL` must point to a dedicated disposable database and is never used by the application runtime. `APP_ORIGIN` is an absolute origin with scheme, host, and optional port but no path; it is the trusted target used for authentication request-origin checks rather than an origin reconstructed from proxy-facing request headers. The supported default local auth path is the Firebase Authentication emulator at a host value such as `127.0.0.1:9099`, with no protocol and the same explicit project ID used by the Firebase CLI and Admin SDK. The provider adapter must support the emulator endpoint only when this local-only setting is present. Production must reject `FIREBASE_AUTH_EMULATOR_HOST`. The final MVP project is verified before account traffic through a no-traffic Cloud Run revision and one-off job under the runtime service account rather than ordinary `gcloud auth application-default login` end-user credentials. Document Cloud SQL local proxy usage and that deployed values belong in Secret Manager.

### Success Criteria:

#### Automated Verification:

- Drizzle configuration loads and can generate the initial committed migration through the documented package command.
- `npm run typecheck` passes with the schema, database client, and user repository.
- Focused fake repository/service tests prove orchestration behavior without opening any database connection.
- `npm run test:db` applies committed migrations to the disposable database and proves the real repository returns one stable local user across repeated upserts while synchronizing canonical and normalized email.
- A repository search confirms password hashes, provider refresh tokens, and session records are absent from the schema.

#### Manual Verification:

- Review confirms the migration creates only the minimal user identity table and its required unique constraints.
- The initial migration and `npm run test:db` complete successfully against a dedicated disposable PostgreSQL database, whose expected columns and indexes can be queried afterward.
- Review confirms the pool maximum is intentionally small relative to the Cloud Run `max-instances` setting.

**Implementation Note**: After completing this phase, run both the deterministic fake tests and `npm run test:db` against a dedicated disposable database. Pause for manual confirmation that the migration, real upsert behavior, and pooling contract are acceptable before proceeding.

---

## Phase 2: Identity Platform And Session Boundary

### Overview

Implement provider-facing credential operations, input and request validation, session-cookie management, and reusable optional/required authentication helpers.

### Changes Required:

#### 1. Authentication input and redirect validation

**Files**: `app/domain/auth/validation.ts`, `app/domain/auth/return-to.ts`

**Intent**: Reject malformed input early and ensure authentication redirects cannot leave the application.

**Contract**: Normalize email consistently, validate email shape, enforce password length 10-128 without composition rules, and return field-specific Polish validation errors. Accept `returnTo` only when it is a local absolute path beginning with `/`, is not protocol-relative, resolves to the current application origin, and targets an application page that can be reached through GET. Reject `/login`, `/register`, `/logout`, their nested/self-referential variants, current `/api/*` resource routes, and any known mutation-only destination; otherwise use `/`.

#### 2. Request-origin protection

**Files**: `app/domain/auth/request-security.server.ts`

**Intent**: Prevent cross-site registration, sign-in, and sign-out submissions while keeping standard React Router forms simple.

**Contract**: Require every POST auth mutation to prove that its source origin matches the trusted configured `APP_ORIGIN`. Parse and compare exact URL origins rather than using prefixes or raw host substrings. When `Origin` is present, require it to be a valid non-`null` origin equal to `APP_ORIGIN`. Only when `Origin` is absent, parse `Referer` and require its full origin to equal `APP_ORIGIN`. Reject requests when both headers are absent, either supplied value is malformed, `Origin` is `null`, or the source origin differs. Do not derive the trusted target from `Host`, `X-Forwarded-Host`, or the proxy-facing request URL. Reject failures before provider, repository, or session work. Tests may replace the validator only through explicit dependency injection; production behavior must not contain environment-based bypasses. The session cookie also uses `SameSite=Lax`, but cookie policy is defense in depth rather than the sole CSRF control.

#### 3. Identity Platform credential adapter

**Files**: `app/domain/auth/identity-platform.server.ts`

**Intent**: Isolate external credential registration and verification behind an application-owned result contract.

**Contract**: Call the Identity Platform `accounts:signUp` and `accounts:signInWithPassword` REST endpoints with the configured API key. Return provider UID, canonical email, and ID token on success. Map invalid credentials, duplicate registration, disabled users, throttling, unavailable provider, and invalid configuration into a small internal error taxonomy; never return provider error codes or raw response bodies to route components.

#### 4. Firebase Admin session-cookie adapter

**Files**: `app/domain/auth/firebase-admin.server.ts`, `app/domain/auth/session.server.ts`

**Intent**: Turn freshly authenticated ID tokens into secure seven-day server sessions and provide one consistent identity-reading contract.

**Contract**: Initialize Firebase Admin once from the explicit `GOOGLE_CLOUD_PROJECT`. In Cloud Run, use Application Default Credentials from the attached runtime service account. In local development, connect to the Firebase Authentication emulator through `FIREBASE_AUTH_EMULATOR_HOST`; do not require downloaded service-account keys or ordinary gcloud end-user ADC. Refuse to start in a deployed/production environment when the emulator variable is set. Verify that the ID token represents a recent authentication before creating the session cookie. Serialize the cookie as HTTP-only, `SameSite=Lax`, path `/`, seven-day maximum age, and `Secure` outside local development. Provide:

- a cookie creation path used only after provider authentication and local-user upsert;
- an optional viewer lookup that verifies signature/expiry without revocation network checks and clears invalid cookies;
- a revocation-aware local-user lookup used by authentication and protected routes that checks revoked/disabled status and local-user resolution;
- a required-user path that emits a safe login redirect with `returnTo` and clears revoked, disabled, expired, malformed, or locally unresolved cookies;
- a cookie-destruction path for POST sign-out.

#### 5. Authentication orchestration service

**Files**: `app/domain/auth/auth-service.server.ts`

**Intent**: Keep route actions thin and make the provider, repository, and session sequence deterministic under test.

**Contract**: Registration and sign-in orchestration accepts validated credentials, calls the provider adapter, upserts the local user, then creates the session cookie. No cookie is returned when the local mapping fails. Provider duplicate-account and credential failures become generic user-facing errors, while validation errors remain specific. Sign-in must repair a provider account that lacks its local user row.

### Success Criteria:

#### Automated Verification:

- `npm test -- app/domain/auth/auth.test.ts` passes deterministic tests for validation, email normalization, safe `returnTo`, rejection of authentication/API/mutation-only destinations, strict `Origin`/`Referer` checks against `APP_ORIGIN`, provider-error mapping, orchestration order, repair-on-sign-in, and cookie attributes.
- Tests prove no session cookie is issued when local user persistence fails.
- Tests prove optional viewer checks avoid revocation mode while required-user checks request revocation verification.
- Tests prove revoked, disabled, expired, malformed, and locally unresolved sessions are cleared when re-authentication is required.
- Tests prove production initialization rejects `FIREBASE_AUTH_EMULATOR_HOST`, while local emulator initialization uses the explicit matching project ID.
- `npm run typecheck` passes with all auth modules kept server-only where required.

#### Manual Verification:

- Review confirms no password, ID token, refresh token, or session cookie is logged or persisted locally.
- Review confirms generic Polish provider errors do not reveal whether an email is registered.
- Review confirms invalid/expired cookies degrade to guest state, protected access redirects to a validated login return path, and auth mutations fail closed when source-origin evidence is missing or untrusted.

**Implementation Note**: After automated verification passes, pause for security review of the cookie, origin, error-mapping, and provider/local-user sequencing contracts.

---

## Phase 3: Account Routes And Shared Navigation

### Overview

Expose registration, sign-in, sign-out, and viewer state through React Router while keeping every current guest route public.

### Changes Required:

#### 1. Root optional-viewer loader

**File**: `app/root.tsx`

**Intent**: Make authenticated viewer state available across routes without adding a global authentication gate.

**Contract**: Add a root loader that resolves an optional local user from the session cookie and returns only display-safe viewer data. Invalid cookies produce signed-out loader data plus an expired cookie header. The root component continues rendering `<Outlet />` for guests and authenticated users alike.

#### 2. Registration route

**File**: `app/routes/register.tsx`

**Intent**: Let a guest create an Identity Platform account and enter an authenticated session.

**Contract**: Add a Polish registration form with email, password, password requirements, generic provider failure state, link to sign-in, and preserved validated `returnTo`. Its action accepts POST only, enforces the `APP_ORIGIN` source-origin contract before input validation or external work, calls the auth service, sets the session cookie, and redirects to the safe return path. Its loader redirects an already-authenticated user only after a revocation-aware local-user check. A revoked, disabled, expired, malformed, or locally unresolved cookie is cleared and the registration form remains available.

#### 3. Sign-in route

**File**: `app/routes/login.tsx`

**Intent**: Let an existing user authenticate without revealing account existence.

**Contract**: Add a Polish sign-in form with email, password, generic invalid-credential state, link to registration, and preserved validated `returnTo`. Its action follows the same strict `APP_ORIGIN`, validation, session, and redirect contracts as registration. Its loader redirects an already-authenticated user only after a revocation-aware local-user check. A revoked, disabled, expired, malformed, or locally unresolved cookie is cleared and the sign-in form remains available, preventing a protected-route-to-login redirect loop.

#### 4. Sign-out resource route

**File**: `app/routes/logout.ts`

**Intent**: End the current browser session through an explicit mutation.

**Contract**: Accept POST only, enforce the same strict `APP_ORIGIN` source-origin validation before clearing state, expire the session cookie, and redirect to a validated internal GET page `returnTo` or `/`. Do not expose a GET logout, permit `/logout` as a redirect destination, or revoke all provider sessions.

#### 5. Route registration

**File**: `app/routes.ts`

**Intent**: Register account routes alongside the existing explicit route table.

**Contract**: Add `/register`, `/login`, and `/logout` without changing the paths or registration of `/`, `/destination`, `/api/city-search`, or `/api/current-pollen`.

#### 6. Shared account navigation

**Files**: `app/components/account-nav.tsx`, `app/routes/home.tsx`, `app/routes/destination-search.tsx`

**Intent**: Make account state and sign-out discoverable in both existing product flows without redesigning the mode switch.

**Contract**: Render a compact shared control near the existing Allergen Finder header. Signed-out state links to sign-in and carries the current route as `returnTo`; signed-in state shows the user's email and a POST sign-out form. Preserve existing Polish non-diagnostic copy, mode navigation, responsive layout, current-check state, and destination behavior. Split route-local header markup if needed to keep route components maintainable.

### Success Criteria:

#### Automated Verification:

- `npm test -- app/domain/auth/auth-routes.test.ts` passes direct loader/action tests for successful and failed registration, sign-in, sign-out, revocation-aware already-authenticated redirects, strict source-origin rejection before side effects, safe return paths, self-referential/authentication/API/mutation-only return-path rejection, and invalid-cookie clearing.
- Tests prove signed-out root loading returns guest viewer state without redirecting `/` or `/destination`.
- Tests prove revoked or disabled cookies do not bounce between a protected route and `/login`, are cleared, and leave the login or registration form usable.
- Existing `npm test -- app/domain/current-location/current-location.test.ts` passes, proving both public resource routes retain their request behavior.
- Full `npm test` and `npm run typecheck` pass after route registration and shared account UI changes.

#### Manual Verification:

- A signed-out user can still complete the current-symptoms flow without visiting an auth route.
- A signed-out user can still complete the destination flow without visiting an auth route.
- Registration, sign-in, visible signed-in email, and POST sign-out work on mobile and desktop layouts with Polish copy.
- External, malformed, protocol-relative, authentication, API, mutation-only, and self-referential `returnTo` values return to `/`; valid internal GET page paths return to the intended route.

**Implementation Note**: After automated verification passes, pause for manual confirmation of both preserved guest flows and the account UI before production configuration.

---

## Phase 4: Verification And Production Readiness

### Overview

Complete the deterministic test coverage, production provider/database configuration, explicit migration rollout, and operational documentation required to release the account foundation.

### Changes Required:

#### 1. Auth test fakes and focused integration suite

**Files**: `app/domain/auth/auth.test.ts`, `app/domain/auth/auth-routes.test.ts`, supporting test helpers under `app/domain/auth/`

**Intent**: Protect the account slice's security and regression boundaries without live providers or a browser stack.

**Contract**: Use deterministic fake provider, repository, and session adapters or narrowly scoped module mocks for the default suite. Cover the chosen password policy, normalized emails, generic provider failures, session issuance ordering, seven-day cookie settings, invalid-cookie cleanup, revocation-mode selection, revoked/disabled authentication-route behavior, local-user repair, safe GET page redirects, authentication/API/mutation-only redirect rejection, exact `APP_ORIGIN` checks with `Origin` and `Referer`, and guest route accessibility. Keep the real PostgreSQL repository assertions in the opt-in `user-repository.integration.test.ts` suite rather than duplicating database internals in fake tests.

#### 2. Identity Platform project configuration

**Files**: `README.md`, `context/deployment/deploy-plan.md`

**Intent**: Record the external settings that code cannot enforce reliably at runtime.

**Contract**: Document enabling `identitytoolkit.googleapis.com` and Identity Platform email/password sign-in, password enforcement with minimum 10 and maximum 128 and no composition requirements, email-enumeration protection, seven-day application sessions, and quota/failed-sign-in monitoring. Record that email verification is intentionally not required for this MVP and that registration endpoints still warrant operational monitoring.

#### 3. Cloud SQL and Cloud Run rollout

**Files**: `README.md`, `context/deployment/deploy-plan.md`

**Intent**: Add the database and auth configuration without making application rollback depend on an incompatible schema.

**Contract**: Document provisioning or attaching PostgreSQL in `europe-central2`, enabling backups before user-owned data arrives, and enabling `sqladmin.googleapis.com` and `secretmanager.googleapis.com` alongside Identity Toolkit. Grant the Cloud Run runtime service account Cloud SQL Client, Secret Manager Secret Accessor for only this service's secrets, Service Usage Consumer, and a project-level custom Firebase session role containing only `firebaseauth.users.createSession` and `firebaseauth.users.get`. The first permission creates session cookies; the second supports revocation/disabled-user checks. Do not grant broad Firebase Authentication Admin or Identity Platform Admin to the runtime service account. Store database and API configuration in Secret Manager, attach the Cloud SQL instance, and retain bounded `max-instances`. Run the additive migration as an explicit approved release action before shifting traffic to the new revision. The previous guest-only revision must remain compatible with the additive `users` table.

#### 4. Live Firebase runtime preflight

**Files**: `package.json`, `vitest.auth-live.config.ts`, `app/domain/auth/auth-live.integration.test.ts`, `README.md`, `context/deployment/deploy-plan.md`

**Intent**: Detect missing APIs, incorrect runtime IAM, or unusable Firebase credentials before production traffic reaches the account-enabled revision.

**Contract**: Add an explicit `npm run test:auth-live` command outside default `npm test`. It requires a dedicated smoke account supplied through approved runtime secrets and explicit opt-in. Emulator mode requires the local emulator. A separate-project mode must refuse the production project. The final MVP project mode must require the exact final project ID plus a second final-target opt-in and may run only before the account-enabled revision receives traffic. The test signs in through the Identity Platform REST adapter, creates a short-lived Firebase Admin session cookie, verifies it without revocation, verifies it with revocation checking, and emits no password, ID token, session cookie, or raw provider payload. Run it locally against the Auth emulator and as a one-off Cloud Run Job using the exact final runtime service account. The live Cloud Run preflight is a release gate before traffic movement.

#### 5. Final repository verification

**Files**: `package.json`, `README.md`, `.env.example`, auth/database modules and routes

**Intent**: Confirm that code, commands, configuration guidance, and preserved guest behavior form one coherent handoff.

**Contract**: Run the default deterministic suite, the opt-in PostgreSQL integration suite against a disposable database, the approved final-project pre-traffic Firebase preflight, typecheck, production build, and dependency audit. Confirm all documented environment variables and package commands exist, no secrets are tracked, the runtime service account has only the documented auth permissions, and no auth middleware guards the existing public routes or APIs.

### Success Criteria:

#### Automated Verification:

- `npm test` passes without live Identity Platform, Firebase, PostgreSQL, or Google Maps requests.
- `npm run test:db` passes against a dedicated disposable PostgreSQL database and never falls back to the runtime `DATABASE_URL`.
- `npm run typecheck` passes.
- `npm run build` produces the production React Router bundle.
- `npm audit --json` completes with advisories fixed or explicitly documented.
- Repository checks confirm the four existing public route paths remain registered and no auth route accepts a state-changing GET request.
- Configuration checks confirm `APP_ORIGIN` is documented and the deployed value exactly matches the public service origin.
- Deterministic configuration tests confirm emulator settings are rejected in production and live-auth tests remain excluded from `npm test`.

#### Manual Verification:

- Identity Platform email/password, password-policy, and enumeration-protection settings match the plan.
- The migration is applied to the final MVP database before preview verification and before account traffic moves.
- A final-project pre-traffic Cloud Run Job under the runtime service account proves REST sign-in plus session creation and both verification modes before traffic moves.
- A no-traffic revision smoke test confirms register, sign-in, session persistence, and sign-out using the dedicated smoke account.
- Cloud Run receives database/auth configuration through Secret Manager or runtime identity, and logs contain no credentials, tokens, cookies, or full authentication payloads.
- Final review confirms S-02 can obtain a revocation-checked stable local user ID without changing this slice's session contract.

**Implementation Note**: The final MVP migration and traffic changes require human approval. Mark the phase complete only after the live final-project pre-traffic auth smoke test and configuration review succeed.

---

## Testing Strategy

### Unit Tests:

- Validate email normalization, email shape, password length boundaries at 9/10/128/129 characters, and Polish field errors.
- Validate safe internal GET page return paths, rejection of absolute/protocol-relative URLs, authentication/API/mutation-only destinations, self-referential auth paths, and `/` fallback.
- Validate exact `APP_ORIGIN` matching, `Referer` fallback only when `Origin` is absent, rejection of missing/`null`/malformed/cross-origin values, and rejection before provider, repository, or session calls.
- Validate provider error mapping without exposing Identity Platform codes.
- Validate orchestration order and the no-cookie-on-local-persistence-failure invariant.
- Validate cookie name, lifetime, HTTP-only, same-site, path, and environment-sensitive secure flag.

### Integration Tests:

- Invoke root loaders and auth route loaders/actions in process with constructed `Request` objects.
- Use two provider identities where useful to prove local mapping remains keyed by provider UID and normalized email.
- Run `npm run test:db` separately from `npm test` to apply migrations and exercise real Drizzle upserts against `TEST_DATABASE_URL`.
- Run `npm run test:auth-live` separately from `npm test`; use the Auth emulator locally and the no-traffic Cloud Run runtime identity for release preflight.
- Exercise optional session verification separately from revocation-aware authentication-route and required-user verification, including a revoked-cookie login-loop regression.
- Reuse the current-location resource-route suite to protect public API behavior.
- Keep real Identity Platform smoke checks and the opt-in PostgreSQL suite outside `npm test`; run the managed smoke check only through the explicitly approved final-project pre-traffic mode.

### Manual Testing Steps:

1. Run `npm run test:db` with a dedicated disposable `TEST_DATABASE_URL`; confirm migrations apply and repeated upserts preserve one local user ID while updating email fields.
2. Run `npm run test:auth-live` against the local Auth emulator; confirm session creation and both verification modes pass without local service-account keys.
3. Run the same live-auth preflight as a final-project pre-traffic Cloud Run Job under the target runtime service account; confirm it passes before traffic movement.
4. Open `/` signed out and complete a current-symptoms check.
5. Open `/destination` signed out and complete a destination check.
6. Register with a valid email and a 10-character password; confirm immediate authenticated state without an email-verification gate.
7. Sign out and confirm the current browser returns to guest state.
8. Sign in with the same credentials and confirm the email appears on both product routes.
9. Try invalid credentials and duplicate registration; confirm errors do not state whether the account exists.
10. Try password lengths of 9 and 129 characters; confirm field validation blocks provider calls.
11. Submit auth forms with matching `Origin`, matching `Referer` and no `Origin`, cross-origin values, `Origin: null`, and neither source header; confirm only trusted-origin requests proceed.
12. Try valid and malicious `returnTo` values, including `/login`, `/register`, `/logout`, and `/api/current-pollen`; confirm only internal GET page paths are honored.
13. Expire or corrupt the session cookie; confirm public pages remain usable, the cookie is cleared, and the login form remains reachable.
14. Disable or revoke the dedicated smoke user before traffic movement; confirm protected access redirects once to a usable login form, clears the cookie, and does not loop.

## Performance Considerations

Optional viewer checks occur in the root loader on public page requests. Firebase session-cookie signature verification should use the Admin SDK's cached public keys and must not request revocation status for normal guest-page rendering. Revocation checks are limited to login/register loaders and protected operations, where disabled or revoked sessions must not be treated as authenticated. Database lookup by unique provider UID must be indexed. The PostgreSQL pool must remain deliberately small per Cloud Run instance and operate within the service's bounded instance count.

No account action should perform more provider/database work than required: one provider credential call, one local user upsert, and one session-cookie exchange on successful registration or sign-in. Provider and database failures return bounded generic errors rather than retry loops.

## Migration Notes

The initial database migration is additive and creates only the `users` table. It must be generated and committed, reviewed as SQL, and applied explicitly to the final MVP database before the account-enabled revision receives traffic. Do not run migrations from application startup or every Cloud Run instance.

Application rollback remains viable because the previous guest-only revision ignores the new table. A failed migration should stop the release before traffic movement. If registration creates an Identity Platform user while local persistence fails, later sign-in performs the idempotent local-user upsert; no data migration or provider-user deletion is required.

## References

- Change identity: `context/changes/email-password-account-access/change.md`
- Roadmap slice S-01: `context/foundation/roadmap.md:69`
- PRD authentication and guest guardrails: `context/foundation/prd.md:111`
- Risk map and guest-access verification: `context/foundation/test-plan.md:30`
- Stack auth/persistence conventions: `context/foundation/stack-assessment.md:61`
- Infrastructure and Cloud SQL operational contract: `context/foundation/infrastructure.md`
- Route registration: `app/routes.ts:3`
- Shared root boundary: `app/root.tsx:44`
- Existing public current-symptoms route: `app/routes/home.tsx:51`
- Existing public destination route: `app/routes/destination-search.tsx:67`
- React Router sessions and cookies: `https://reactrouter.com/explanation/sessions-and-cookies`
- Identity Platform email/password REST API: `https://cloud.google.com/identity-platform/docs/use-rest-api`
- Identity Platform password policy: `https://cloud.google.com/identity-platform/docs/password-policy`
- Identity Platform enumeration protection: `https://cloud.google.com/identity-platform/docs/admin/email-enumeration-protection`
- Firebase Admin session cookies: `https://firebase.google.com/docs/auth/admin/manage-cookies`
- Firebase Admin initialization and local ADC caveat: `https://firebase.google.com/docs/admin/setup`
- Firebase Authentication emulator: `https://firebase.google.com/docs/emulator-suite/connect_auth`
- Identity Platform IAM permissions: `https://cloud.google.com/identity-platform/docs/access-control`
- Drizzle migrations: `https://orm.drizzle.team/docs/drizzle-kit-migrate`
- Node-postgres pooling: `https://node-postgres.com/features/pooling`
- Cloud Run to Cloud SQL: `https://cloud.google.com/sql/docs/postgres/connect-run`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: PostgreSQL Identity Foundation

#### Automated

- [x] 1.1 Drizzle generates the committed initial user migration
- [x] 1.2 Typecheck passes with schema, client, and repository
- [x] 1.3 Focused identity persistence tests prove stable idempotent mapping
- [x] 1.4 Schema excludes passwords, refresh tokens, and session records
- [x] 1.5 Disposable PostgreSQL integration tests prove the real upsert contract

#### Manual

- [x] 1.6 Migration contains only the approved user identity table and constraints
- [x] 1.7 Migration and repository integration tests pass on disposable PostgreSQL
- [x] 1.8 Database pool limit is reviewed against Cloud Run scaling

### Phase 2: Identity Platform And Session Boundary

#### Automated

- [x] 2.1 Focused auth tests pass for validation, redirects, origin checks, errors, sequencing, and cookies
- [x] 2.2 Local persistence failure cannot issue a session cookie
- [x] 2.3 Optional and required identity helpers use the correct revocation modes
- [x] 2.4 Typecheck passes with server-only auth boundaries

#### Manual

- [x] 2.5 Auth secrets and tokens are neither logged nor persisted
- [x] 2.6 Provider failures use enumeration-resistant Polish responses
- [x] 2.7 Invalid sessions degrade safely for public and protected access

### Phase 3: Account Routes And Shared Navigation

#### Automated

- [x] 3.1 Auth route loader/action integration tests pass
- [x] 3.2 Signed-out root loading preserves public route access
- [x] 3.3 Existing current-location resource-route tests pass
- [x] 3.4 Full tests and typecheck pass after UI and route registration

#### Manual

- [x] 3.5 Current-symptoms flow remains complete while signed out
- [x] 3.6 Destination flow remains complete while signed out
- [x] 3.7 Registration, sign-in, viewer state, and sign-out work responsively in Polish
- [x] 3.8 Return paths accept only valid internal application paths

### Phase 4: Verification And Production Readiness

#### Automated

- [x] 4.1 Full deterministic test suite passes without live providers
- [x] 4.2 Disposable PostgreSQL integration suite passes
- [x] 4.3 Emulator-backed Firebase session preflight passes
- [x] 4.4 Full typecheck passes
- [x] 4.5 Production build passes
- [x] 4.6 Dependency audit completes with advisories resolved or documented
- [x] 4.7 Public routes remain registered and auth mutations reject GET

#### Manual

- [x] 4.8 Identity Platform security settings match the approved policy
- [x] 4.9 Runtime IAM contains the approved Firebase session permissions
- [x] 4.10 Database migrations are applied in the approved release sequence
- [x] 4.11 No-traffic Cloud Run live-auth preflight passes
- [x] 4.12 Non-production account-flow smoke test passes
- [x] 4.13 Runtime secrets and logs satisfy the security contract
- [x] 4.14 S-02 can consume a revocation-checked stable local user ID
