---
project: Allergen Finder
researched_at: 2026-06-01T00:00:00+02:00
recommended_platform: Google Cloud Run
runner_up: Cloudflare Workers Static Assets
context_type: mvp
tech_stack:
  language: TypeScript
  framework: React Router 7.16.0
  runtime: Node.js container on Cloud Run
---

## Recommendation

**Deploy on Google Cloud Run.**

Cloud Run is the best MVP deployment target for this project because the current React Router app already builds as a normal Node server (`react-router build` plus `react-router-serve`), the tech-stack hand-off names GCP Cloud Run as the intended infrastructure shape, and the developer has GCP familiarity. It also fits the interview constraints: no persistent connections, single-region usage, balanced cost/DX, and preference for co-located managed services through Cloud SQL, Secret Manager, Cloud Storage, Cloud Logging, and IAM.

Primary references checked on 2026-06-01: React Router deployment docs (https://reactrouter.com/start/framework/deploying), Cloud Run overview (https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run), Cloud Run deploy docs (https://docs.cloud.google.com/run/docs/deploying), Cloud Run rollback docs (https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration), Cloud Run logging docs (https://docs.cloud.google.com/run/docs/logging), Cloud Run secrets docs (https://docs.cloud.google.com/run/docs/configuring/services/secrets), and Cloud Run pricing (https://cloud.google.com/run/pricing).

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| Google Cloud Run | Pass | Pass | Partial | Pass | Partial | 4.0 / 5 |
| Cloudflare Workers Static Assets | Pass | Pass | Pass | Pass | Pass | 5.0 / 5 |
| Railway | Partial | Pass | Pass | Partial | Partial | 3.5 / 5 |
| Vercel | Pass | Pass | Pass | Pass | Partial | 4.5 / 5 |
| Netlify | Partial | Pass | Pass | Partial | Pass | 4.0 / 5 |
| Fly.io | Pass | Partial | Pass | Partial | Partial | 3.5 / 5 |
| Render | Partial | Pass | Pass | Partial | Partial | 3.5 / 5 |

Cloud Run scores lower than Cloudflare and Vercel on agent-readable docs and platform-native MCP, but wins for this project because it has the least runtime mismatch with the current Node server shape and matches the developer's GCP familiarity. It supports any language that can build a container, source deploys for Node.js, revision-based rollbacks, Cloud Logging, and first-party GitHub Actions. Cloud Run's main weakness is operational breadth: IAM, billing, region, Cloud SQL, Secret Manager, and container settings need an explicit contract.

Cloudflare Workers Static Assets has the strongest agent-friendly score: Wrangler is CLI-first, docs expose markdown and `llms.txt`, Workers have rollback and tailing logs, and the platform includes D1, R2, KV, Durable Objects, Queues, and official MCP/API server capabilities. It is the runner-up because the current app uses Node-oriented React Router packages and `@react-router/serve`; moving to Workers requires adopting Cloudflare's React Router/Vite integration and auditing Node compatibility.

Railway is fast for a solo MVP and provides a cohesive app plus Postgres/Redis/storage experience. It supports Node container services and PR environments, but true rollback is dashboard-oriented, pricing is usage-based after the Hobby allowance, and the platform is less aligned with the developer's existing GCP comfort.

Vercel has excellent React Router support, CLI deploy/logs/rollback, and agent-readable docs, but it does not satisfy the co-location preference as well because Postgres is now marketplace/provider-backed rather than a first-party Vercel primitive. It also introduces Vercel-specific React Router preset assumptions.

Netlify has first-class React Router support through `@netlify/vite-plugin-react-router`, strong agent docs, and an official MCP story. It is a good serverless target, but rollback is less CLI-first and persistent Node process hosting is not its model.

Fly.io runs the Node/Docker shape well and supports persistent processes, but its managed Postgres starts at a much higher cost than the MVP likely needs. It is more infrastructure-like than Cloud Run for this specific single-region, low-QPS app.

Render can run the current Node service and offers Postgres/Redis-like services, but CLI rollback is not first-class and free services sleep. It is viable but less compelling than Cloud Run or Railway for this project.

## Shortlisted Platforms

### 1. Google Cloud Run (Recommended)

Cloud Run wins because it preserves the current React Router Node runtime instead of forcing a serverless/edge adapter, and it matches the intended infrastructure shape already recorded in `context/foundation/tech-stack.md`. It gives the solo developer a managed container target, low request-based cost at MVP traffic, GCP-native logs/secrets/IAM, and co-located managed services.

### 2. Cloudflare Workers Static Assets

Cloudflare is the strongest alternative if cost and agent-readable platform docs become the dominant constraints. It should be chosen only if the project is intentionally moved to the Workers runtime and the app's auth/database dependencies are checked against Workers Node compatibility.

### 3. Railway

Railway is the best non-GCP full-stack PaaS fallback. It is attractive when the fastest possible app plus database setup matters more than GCP alignment, but its rollback and billing model are less clean for agent-driven maintenance.

## Anti-Bias Cross-Check: Google Cloud Run

### Devil's Advocate - Weaknesses

1. Cloud Run is not zero-config: the app still needs a Dockerfile or source-build-compatible start behavior, IAM, region, service account, and billing setup.
2. Cloud SQL can dominate MVP cost compared with the nearly free Cloud Run service at low request volume.
3. Cold starts may hurt the under-30-second result goal if the service scales to zero and the app has slow startup.
4. Rollbacks only revert Cloud Run revisions, not database schema migrations or changed external APIs.
5. GCP docs and IAM are broader than Vercel, Netlify, or Railway, so agent maintenance has more surface area to reason about.

### Pre-Mortem - How This Could Fail

Six months after launch, Cloud Run turned out badly because the team treated "serverless container" as "no operations." The first deploy worked, but the service used default IAM, unreviewed billing, and no explicit region or cost limits. Auth and saved history introduced Cloud SQL, and the database became the real monthly bill. A schema migration shipped with a UI change; Cloud Run rollback restored the old container, but the database stayed migrated and broke older code paths. Cold starts were ignored during manual tests, then users on mobile saw slow first responses after idle periods. Logs existed in Cloud Logging, but there were no structured request IDs or alerts, so debugging relied on manual console searches. The failure was not Cloud Run itself; it was assuming GCP primitives would stay simple without writing a minimal operational contract.

### Unknown Unknowns

- Cloud Run sets `PORT`; the container must bind to that port, not a hard-coded development port.
- Request-based billing is cheap at low traffic, but setting `min-instances` above zero changes the cost profile.
- Secret Manager access requires IAM on the runtime service account, not only creating the secret.
- Cloud Run revision rollback does not roll back database state or external API configuration.
- Source deploys are convenient, but a pinned Dockerfile is usually more predictable for agents and CI.
- `gcloud beta run services logs tail` is still marked Preview; use `gcloud run services logs read` or Cloud Logging queries for stable read-only log inspection.

## Operational Story

- **Preview deploys**: Use GitHub Actions with `google-github-actions/deploy-cloudrun@v3` to deploy PR or branch revisions to a separate preview Cloud Run service, or deploy tagged no-traffic revisions and expose only reviewed URLs. Fork PRs should not receive deploy credentials.
- **Secrets**: Store production secrets in Secret Manager and bind them to Cloud Run with `--set-secrets`; the runtime service account needs `roles/secretmanager.secretAccessor` only for the specific secrets it reads.
- **Rollback**: Repoint traffic to the previous healthy revision with `gcloud run services update-traffic allergen-finder --to-revisions <REVISION>=100 --region <REGION>`. This restores container code/config only; database migrations need their own rollback plan.
- **Approval**: An agent may run typecheck, build, deploy preview revisions, and read logs. A human should approve production traffic changes, primary secret rotation, Cloud SQL destructive operations, and any migration that drops or rewrites data.
- **Logs**: Read recent logs with `gcloud run services logs read allergen-finder --limit=50 --project <PROJECT_ID>` or query Cloud Logging with `gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="allergen-finder"' --limit=50 --project <PROJECT_ID>`. Use `gcloud beta run services logs tail allergen-finder --project <PROJECT_ID>` only when accepting the Preview status of CLI tailing.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Cloud SQL cost exceeds the app hosting cost | Devil's advocate / Research finding | M | M | Start without a database until saved history/auth persistence requires it, or choose the smallest acceptable Cloud SQL shape and set billing alerts before launch. |
| Cold starts slow first requests | Devil's advocate / Pre-mortem | M | M | Measure startup after the Dockerfile is added; keep dependencies lean and only add `min-instances=1` if latency tests justify the cost. |
| Rollback restores code but not database schema | Devil's advocate / Unknown unknowns | M | H | Treat migrations as forward-compatible; require a manual migration rollback note before production deploys that change stored data. |
| Secret Manager bindings fail because IAM is incomplete | Unknown unknowns | M | H | Create a dedicated runtime service account and grant least-privilege secret access during setup; verify with a preview deploy. |
| Agent gets stuck in GCP IAM/billing complexity | Devil's advocate | M | M | Keep one project, one region, one service account, and one Cloud Run service for MVP; document every required variable and role in the implementation plan. |
| Source deploy differs from local build behavior | Unknown unknowns | M | M | Prefer a repo-owned Dockerfile that runs `npm ci`, `npm run build`, and `npm run start` so CI, local Docker, and Cloud Run share one artifact shape. |
| Preview deploy exposes secrets to untrusted fork PRs | Operational story | L | H | Disable preview deploys for fork PRs or require maintainer approval before workflows with GCP credentials run. |

## Getting Started

1. Add a Dockerfile for the current React Router Node server: install dependencies with `npm ci`, run `npm run build`, expose `8080`, and start with `npm run start`.
2. Confirm the production server respects Cloud Run's `PORT` variable; `@react-router/serve` supports `PORT=<port> npx react-router-serve ...`, and the app's current `start` script uses `react-router-serve ./build/server/index.js`.
3. Create a GCP project and region for MVP, preferably one single region near expected users, then deploy the first revision with `gcloud run deploy allergen-finder --source . --region <REGION> --allow-unauthenticated` or with an explicit container image after the Dockerfile is committed.
4. Add required secrets in Secret Manager and bind them with `gcloud run deploy allergen-finder --image <IMAGE_URL> --region <REGION> --set-secrets <ENV_VAR>=<SECRET_NAME>:latest`.
5. Add GitHub Actions using Workload Identity Federation and `google-github-actions/deploy-cloudrun@v3` after the manual deploy path is proven.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
