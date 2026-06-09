---
project: Allergen Finder
researched_at: 2026-06-09T23:51:55+02:00
recommended_platform: Google Cloud Run
runner_up: Railway
context_type: mvp
tech_stack:
  language: TypeScript 5.9
  framework: React Router 7.16.0
  runtime: Node.js 24 LTS container
  database: PostgreSQL
---

## Recommendation

**Continue deploying on Google Cloud Run, backed by Cloud SQL for PostgreSQL.**

The updated product shape can keep the existing TypeScript, React Router, Vite, Node container, and Cloud Run architecture. React Router officially supports Node.js Docker deployments, including a Node/Postgres reference template, and Cloud Run has a first-party Cloud SQL connection path. The revised MVP does not require an edge-runtime migration or a different application framework.

The stack must be extended rather than replaced: add PostgreSQL persistence, server-side authentication and sessions, a typed database layer, migrations, and a standard automated test runner. The current `node:20-alpine` Docker base must be upgraded because Node.js 20 reached end of life on 2026-04-30; use Node.js 24 LTS and verify the complete build and smoke-check suite before redeploying.

Primary references checked on 2026-06-09:

- React Router deployment: https://reactrouter.com/start/framework/deploying
- React Router sessions and cookies: https://reactrouter.com/explanation/sessions-and-cookies
- Cloud Run container contract: https://cloud.google.com/run/docs/container-contract
- Cloud Run to Cloud SQL for PostgreSQL: https://cloud.google.com/sql/docs/postgres/connect-run
- Cloud Run pricing: https://cloud.google.com/run/pricing
- Cloud SQL pricing: https://cloud.google.com/sql/pricing
- Node.js release lifecycle: https://nodejs.org/en/about/previous-releases
- Identity Platform email/password sign-in: https://cloud.google.com/identity-platform/docs/sign-in-user-email

## Required Stack Changes

| Area | Decision |
|---|---|
| Application framework | Keep React Router 7 framework mode and the current server-rendered route-module architecture. |
| Runtime | Keep Node.js containers, but upgrade the Docker base from Node 20 to Node 24 LTS. |
| Hosting | Keep the existing public Cloud Run service in `europe-central2`. |
| Database | Add PostgreSQL. Prefer Cloud SQL in the same region as Cloud Run. |
| Data access | Add a typed repository and migration layer. Drizzle is a low-friction option and appears in React Router's official Node/Postgres template, but the exact library remains an implementation-plan decision. |
| Authentication | Add email/password authentication and secure server-side session handling. GCP Identity Platform is compatible and inexpensive at MVP scale; locally managed credentials are also viable if password hashing, enumeration resistance, and session invalidation are implemented correctly. |
| Sessions | Store only a signed session identifier or minimal user identity in the cookie. Use database-backed session records when server-side revocation or multiple-session management is required. |
| Tests | Add Vitest or an equivalent Vite-compatible test runner, an `npm test` script, and authorization tests that create two users and prove cross-user read, update, and delete attempts fail. |
| Secrets | Store database credentials, cookie secrets, and provider keys in Secret Manager and expose them only to the Cloud Run runtime service account. |

## Platform Comparison

| Platform | Runtime fit | Managed services | CLI / deploy API | Agent-readable docs | MVP fit | Total |
|---|---|---|---|---|---|---|
| Google Cloud Run + Cloud SQL | Pass | Pass | Pass | Partial | Pass | 4.5 / 5 |
| Railway | Pass | Partial | Partial | Pass | Pass | 4.0 / 5 |
| Cloudflare Workers + D1 | Partial | Pass | Pass | Pass | Partial | 4.0 / 5 |
| Vercel | Pass | Partial | Pass | Pass | Partial | 4.0 / 5 |
| Netlify | Pass | Partial | Partial | Pass | Partial | 3.5 / 5 |
| Fly.io | Pass | Partial | Pass | Pass | Partial | 3.5 / 5 |
| Render | Pass | Partial | Partial | Pass | Partial | 3.5 / 5 |

Google Cloud Run remains the strongest choice because it already runs the deployed application, preserves the Node Docker artifact, matches existing GCP familiarity, and supports co-located Cloud SQL, Secret Manager, Cloud Logging, IAM, and Artifact Registry. Its main weakness is that Cloud SQL introduces a fixed baseline cost and a larger operational surface than the Cloud Run service itself.

Railway moves to second place because the revised MVP now requires a database. It can use the repository Dockerfile and provision PostgreSQL with a directly consumable `DATABASE_URL`, reducing setup time. Its PostgreSQL template is described as unmanaged, however, so database maintenance and backup choices need deliberate ownership. Moving platforms would also discard the value of the existing Cloud Run deployment.

Cloudflare remains technically attractive and has excellent CLI, documentation, MCP, and integrated D1 capabilities. Current tooling can detect and deploy React Router projects with `nodejs_compat`, but adopting the Cloudflare Vite plugin and Workers runtime changes the production execution model and local fidelity contract. That migration is unnecessary for a four-week brownfield expansion.

Vercel and Netlify support React Router but would introduce platform adapters while still requiring an external or marketplace database. Fly.io and Render can run the current container, but neither gives this project enough benefit over the already operational GCP deployment to justify migration work.

## Shortlisted Platforms

### 1. Google Cloud Run + Cloud SQL (Recommended)

Cloud Run wins on migration cost, runtime compatibility, GCP familiarity, and co-location. The deployed service already proves the core container path. Adding Cloud SQL changes the operational contract, but not the application architecture.

### 2. Railway

Railway is the best fallback when deployment speed and a single project containing both app and PostgreSQL matter more than retaining GCP. It is simpler to provision but gives up the existing deployment and uses a less fully managed PostgreSQL service.

### 3. Cloudflare Workers + D1

Cloudflare is the strongest cost- and agent-tooling-oriented alternative. It should be selected only as an intentional runtime migration, with the authentication, password hashing, database, and Node compatibility dependencies validated against Workers before implementation.

## Anti-Bias Cross-Check: Google Cloud Run + Cloud SQL

### Devil's Advocate - Weaknesses

1. Cloud SQL is always-on infrastructure. At this traffic level its fixed database cost can materially exceed the request-based Cloud Run bill.
2. Cloud Run can create multiple instances quickly. An unbounded connection pool in every instance can exhaust PostgreSQL connections even when request volume is modest.
3. A Cloud Run revision rollback restores application code and configuration, not database schema or stored data. A backward-incompatible migration can make rollback ineffective.
4. Authentication expands the security surface beyond hosting: password storage, session rotation, cookie configuration, account enumeration, brute-force resistance, and ownership checks all remain application responsibilities unless delegated to Identity Platform.
5. The existing image uses end-of-life Node 20. Adding auth and persistence before upgrading the runtime would build security-sensitive behavior on an unsupported base.

### Pre-Mortem - How This Could Fail

Six months after launch, the architecture failed operationally even though the application worked locally. The team added Cloud SQL quickly, left the Cloud Run service at its existing maximum instance count, and accepted the database library's default connection pool. A small traffic burst multiplied pools across instances and exhausted PostgreSQL connections, causing authentication and history requests to fail together. The first schema migration renamed a column in the same release that changed the application. When errors appeared, traffic was rolled back to the previous Cloud Run revision, but the old code could no longer read the migrated schema. Session secrets had been configured as plain environment values rather than Secret Manager references, and rotation invalidated every active user without a documented procedure. Cloud SQL backups and billing alerts were assumed rather than verified. Meanwhile, the container still used Node 20 after end of life. The platform choice was not the root cause; the failure came from treating the new database, authentication boundary, and migration process as ordinary feature code instead of a shared operational contract.

### Unknown Unknowns

- Cloud Run injects `PORT`, and the ingress container must listen on `0.0.0.0`; the current React Router app server supports this contract.
- Cloud SQL should be placed in the same region as Cloud Run to reduce latency, networking cost, and cross-region failure exposure.
- Cloud Run scaling and PostgreSQL connection limits must be designed together. Configure a small explicit pool and retain a bounded `max-instances` value until measured traffic justifies changes.
- React Router supports database-backed custom session storage. Cookie-only sessions are portable across Cloud Run instances, but they limit server-side revocation and must remain small.
- Cloud Run revision rollback never reverses a migration. Database changes must be backward-compatible across at least the current and previous application revisions.
- Node 24 is the current LTS line as of this review. Node 26 is Current, not LTS, and should not be the production default yet.
- Cloud SQL's 30-day free trial is for evaluation and lacks production backups and an SLA; it is not a durable MVP hosting plan.

## Operational Story

- **Preview deploys**: Deploy pull requests to a separate preview Cloud Run service or tagged no-traffic revision. Use a separate preview database/schema, and never expose production database credentials to fork pull requests.
- **Secrets**: Keep `DATABASE_URL` or database connection fields, session/cookie secrets, auth-provider credentials, and Google API keys in Secret Manager. Grant the runtime service account access only to the secrets required by this service.
- **Database connectivity**: Attach the Cloud SQL instance to Cloud Run with `--add-cloudsql-instances`, grant the runtime service account `roles/cloudsql.client`, and configure a deliberately small connection pool.
- **Migrations**: Run migrations as an explicit approved release action before production traffic moves. Use expand-and-contract changes so the previous application revision remains compatible during rollback.
- **Rollback**: Repoint traffic to the previous healthy Cloud Run revision. If a release includes a migration, follow its separately reviewed database recovery procedure; do not assume application rollback repairs data.
- **Approval**: An agent may run tests, build images, deploy previews, and read logs. A human must approve production migrations, production traffic changes, primary secret rotation, destructive database operations, and backup restoration.
- **Logs**: Read runtime logs with `gcloud run services logs read allergen-finder --project gcp-10xdev-bara-lab-3t60 --region europe-central2 --limit 50`. Add structured request and user-safe correlation IDs without logging passwords, session tokens, symptoms, or precise location data.
- **Backups**: Enable and verify Cloud SQL automated backups before storing user symptom history. Record retention and restore-test expectations in the implementation plan.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Cloud SQL fixed cost dominates MVP spend | Devil's advocate / Research finding | H | M | Price the smallest acceptable paid instance, set a monthly budget alert, and compare the result with Railway before provisioning. |
| Cloud Run instances exhaust database connections | Devil's advocate / Unknown unknowns | M | H | Use a small explicit per-instance pool, retain bounded Cloud Run scaling, and load-test authentication/history requests. |
| Application rollback is incompatible with migrated schema | Devil's advocate / Pre-mortem | M | H | Require backward-compatible expand-and-contract migrations and a rollback note for every schema change. |
| Cross-user records are exposed | PRD / Research finding | M | H | Derive ownership from the authenticated session, scope every repository operation by owner, and automate two-user read/update/delete denial tests. |
| Password or session implementation is weak | Devil's advocate | M | H | Prefer Identity Platform or use a reviewed password-hashing library, secure cookies, rotation, rate limits, and enumeration-safe responses. |
| Unsupported Node runtime remains in production | Research finding | H | H | Upgrade every Docker stage to Node 24 LTS before adding auth or persistence and verify the image locally. |
| Database credentials or session secrets leak | Pre-mortem | L | H | Use Secret Manager references, least-privilege IAM, log redaction, and a documented rotation procedure. |
| Backups exist but cannot be restored | Unknown unknowns | M | H | Enable automated backups and perform a restore drill before treating saved history as durable. |
| Preview environment accesses production user data | Operational story | L | H | Use separate preview storage and block secret-bearing workflows for untrusted fork pull requests. |
| Cold starts delay first authenticated request | Prior research | M | M | Measure startup and first database connection latency; add a minimum instance only if observed latency justifies the cost. |

## Getting Started

1. Upgrade all Dockerfile stages from `node:20-alpine` to a pinned Node 24 LTS Alpine image, then run `npm ci`, `npm run typecheck`, `npm run build`, and the existing smoke checks.
2. Choose the authentication implementation during the account-access plan. Prefer GCP Identity Platform if minimizing credential-handling risk outweighs the added SDK integration; otherwise document password hashing, session storage, and brute-force controls explicitly.
3. Provision paid Cloud SQL for PostgreSQL in `europe-central2`, enable automated backups, create a least-privilege application database user, and attach the instance to Cloud Run.
4. Add the typed schema, migrations, repository boundary, and server-only session/auth modules. Keep database and credential code in `.server.ts` modules.
5. Add the test runner and `npm test` before implementing account or history behavior. Make the two-user authorization test part of the first persistent record slice.

## Decision

The original architectural stack remains suitable for the expanded MVP. Do not replatform.

The stack contract is incomplete for the new scope until PostgreSQL, authentication/session handling, migrations, and automated tests are selected. The Node 20 runtime is no longer acceptable and must be upgraded independently of the feature work.

## Out of Scope

The following were not designed in this research:

- Exact database schema and migration files
- Exact authentication library or Identity Platform integration
- CI/CD workflow implementation
- Production-scale multi-region, high availability, or disaster recovery architecture
