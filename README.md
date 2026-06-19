# Allergen Finder

Allergen Finder is a React Router full-stack TypeScript application for guest
allergen checks and optional email/password accounts.

## Local Setup

For the complete local stack, including PostgreSQL, database migrations,
Firebase Authentication emulator, environment configuration, and browser
verification, follow
[`context/development/local-setup.md`](context/development/local-setup.md).

After the prerequisites and local services are configured, the normal startup
command is:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Database

The application uses Drizzle and PostgreSQL. Migrations are explicit release
actions and never run during application startup.

```bash
npm run db:generate
DATABASE_URL=postgresql://... npm run db:migrate
```

For local Cloud SQL access, run the Cloud SQL Auth Proxy and point
`DATABASE_URL` at its local listener. Production values belong in Secret
Manager.

The real repository integration suite requires a separate disposable database.
It fails rather than falling back to `DATABASE_URL`:

```bash
TEST_DATABASE_URL=postgresql://... npm run test:db
```

## Identity Platform

Enable `identitytoolkit.googleapis.com`, then configure Identity Platform:

- enable email/password sign-in;
- enforce passwords from 10 through 128 characters with no composition rules;
- enable email-enumeration protection;
- do not require email verification for this MVP;
- monitor registration, failed sign-in, throttling, and quota usage.

Application sessions are HTTP-only Firebase Admin session cookies lasting
seven days. Provider errors shown by the application are intentionally generic.

### Live Auth Preflight

`npm run test:auth-live` is outside the deterministic suite. It refuses to run
without explicit opt-in. It accepts `emulator`, `non-production`, or the more
strict `final-pre-traffic` target.

For the local emulator, create the dedicated smoke account in the emulator,
then run:

```bash
AUTH_LIVE_OPT_IN=1 \
AUTH_LIVE_TARGET=emulator \
AUTH_LIVE_EMAIL=smoke@example.test \
AUTH_LIVE_PASSWORD='local-smoke-password' \
GOOGLE_CLOUD_PROJECT=allergen-finder-local \
IDENTITY_PLATFORM_API_KEY=fake-api-key \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
npm run test:auth-live
```

For this MVP, release verification runs in the final GCP project before the
account-enabled revision receives traffic. Build `Dockerfile.auth-live` and run
it as a Cloud Run Job using the exact runtime service account; test tooling
stays out of the application image. Set
`AUTH_LIVE_TARGET=final-pre-traffic`,
`AUTH_LIVE_FINAL_PROJECT_ID` to the exact `GOOGLE_CLOUD_PROJECT`, and
`AUTH_LIVE_ALLOW_FINAL_TARGET=1`, with no emulator variable. Supply smoke
credentials through approved runtime secrets. This verifies REST sign-in,
short-lived session creation, normal verification, and revocation-aware
verification before traffic moves.

The concrete build and Cloud Run Job commands are in
`context/deployment/deploy-plan.md`.

`Dockerfile.migrate` is the one-off migration artifact. It includes Drizzle
Kit and committed SQL migrations but not the application server. Run it as an
explicit approved Cloud Run Job before moving traffic; migrations never run
from application startup.

## GitHub Actions Deployment

The repository includes a manual Cloud Run deployment workflow at
`.github/workflows/deploy-gcp.yml`. It is configured for the final GCP project
and deploys only when triggered from `workflow_dispatch`.

Set these GitHub environment variables in the `production` environment:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `GCP_RUNTIME_SERVICE_ACCOUNT`
- `GCP_CLOUD_SQL_INSTANCE_CONNECTION_NAME`
- `CLOUD_RUN_SERVICE_ORIGIN`

Use the exact values from the target GCP project:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: the full Workload Identity Provider
  resource name
- `GCP_DEPLOY_SERVICE_ACCOUNT`: the GitHub deployer service account email
- `GCP_RUNTIME_SERVICE_ACCOUNT`: the Cloud Run runtime service account email
- `GCP_CLOUD_SQL_INSTANCE_CONNECTION_NAME`: the Cloud SQL connection name in
  `project:region:instance` form
- `CLOUD_RUN_SERVICE_ORIGIN`: the exact public Cloud Run origin, without a
  path

The workflow expects the following Secret Manager secret names to exist in the
GCP project:

- `allergen-database-url`
- `allergen-identity-api-key`
- `allergen-google-maps-api-key`
- `allergen-smoke-email`
- `allergen-smoke-password`

If your organization policy blocks IAM, Secret Manager, Cloud SQL, or Workload
Identity changes in the project, those values must be provisioned by an
organization administrator before the workflow can be used.

## Google Maps Platform

Live city search and pollen lookup require `GOOGLE_MAPS_API_KEY`. Enable:

- Places API
- Geocoding API
- Pollen API

Keep the key out of client code and do not commit it. Restrict it to these APIs
and configure quota or billing alerts before exposing public endpoints.

## Verification

Default tests never call live Identity Platform, Firebase, PostgreSQL, or
Google Maps:

```bash
npm test
npm run typecheck
npm run build
npm audit --json
```

Release verification additionally requires:

```bash
npm run test:db
npm run test:auth-live
```

### Accepted Audit Advisories

On June 18, 2026, `npm audit --json` reported 12 advisories: 2 high,
10 moderate, and 0 critical. The remaining paths are:

- Vite development-server advisories in the direct `vite` dependency;
- `form-data` through transitive Google/Firebase request tooling;
- a development-only legacy `esbuild` chain under current `drizzle-kit`;
- `uuid`, `gaxios`, `teeny-request`, `retry-request`, and
  `@google-cloud/storage` through Firebase Admin's Google Cloud dependencies.

The direct Vite fix and transitive request-tooling fixes require dependency
updates that should be tested as a separate change. `npm audit` also suggests
downgrading `drizzle-kit` and `firebase-admin` across major versions, so those
are not accepted remediations in this product change. Keep development servers
private, run migration tooling only in trusted local or build-job environments,
and re-run the audit before traffic movement.

Review `context/deployment/deploy-plan.md` before applying migrations or moving
Cloud Run traffic.

## Saved Symptom History

Saved checks contain private symptom and city-label context. The history
migration remains an explicit release action and must run before traffic moves
to the history-enabled revision. Before treating this data as durable:

- verify Cloud SQL automated-backup retention;
- restore the latest backup into a non-production database and record the
  successful restore evidence;
- run `npm run test:db` against a disposable database;
- run the deterministic tests, typecheck, build, and approved auth preflight;
- confirm application logs contain no symptom snapshot, city label, record
  content, session cookie, token, or owner identifier.

The previous account-enabled revision ignores the additive
`symptom_checks` table and remains compatible for application rollback.
