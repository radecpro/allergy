# First Cloud Run Deployment Plan

## Summary

Deploy the existing React Router app to Google Cloud Run using the repo's current Dockerfile and current GCP config:

- Project: `gcp-10xdev-bara-lab-3t60`
- Region: `europe-central2`
- Service: `allergen-finder`
- Access: public unauthenticated
- Build path: `gcloud run deploy --source .`, which uses the existing `Dockerfile`

Local readiness already checked: `npm run typecheck` and `npm run build` pass.

Deployment completed on 2026-06-01:

- Revision: `allergen-finder-00001-bg7`
- Canonical URL: `https://allergen-finder-hwt4hd6s4a-lm.a.run.app`
- Deploy output URL, also verified: `https://allergen-finder-1036435822734.europe-central2.run.app`

## Prerequisites

- Install and initialize the Google Cloud CLI:

  ```sh
  gcloud init
  gcloud auth login
  ```

- Configure the intended project and region:

  ```sh
  gcloud config set project gcp-10xdev-bara-lab-3t60
  gcloud config set run/region europe-central2
  gcloud config set compute/region europe-central2
  ```

- Confirm active config before deployment:

  ```sh
  gcloud config list
  gcloud auth list
  ```

- The deploying account needs permission to enable APIs and deploy Cloud Run services. Minimum practical roles for this first deploy are Service Usage Admin, Cloud Run Admin, Cloud Build Editor, Artifact Registry Admin, or equivalent narrower permissions.
- The Cloud Build service account used for source deploys needs Cloud Run Builder on the project. In this project, the first deploy used the Compute Engine default service account:

  ```sh
  gcloud projects add-iam-policy-binding gcp-10xdev-bara-lab-3t60 \
    --member serviceAccount:1036435822734-compute@developer.gserviceaccount.com \
    --role roles/run.builder
  ```

## Required GCP APIs

Enable these APIs before the first deploy:

```sh
gcloud services enable \
  serviceusage.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project gcp-10xdev-bara-lab-3t60
```

Cloud Run source deploy builds the app with Cloud Build and stores the generated image in Artifact Registry, using a regional source-deploy repository if needed.

## Deployment Steps

- Run final preflight:

  ```sh
  npm run typecheck
  npm run build
  git status --short
  ```

- Deploy first public revision:

  ```sh
  gcloud run deploy allergen-finder \
    --source . \
    --project gcp-10xdev-bara-lab-3t60 \
    --region europe-central2 \
    --allow-unauthenticated \
    --ingress all \
    --port 8080 \
    --cpu 1 \
    --memory 512Mi \
    --min-instances 0 \
    --max-instances 3 \
    --labels app=allergen-finder,env=mvp \
    --quiet
  ```

- Capture the deployed URL:

  ```sh
  gcloud run services describe allergen-finder \
    --project gcp-10xdev-bara-lab-3t60 \
    --region europe-central2 \
    --format='value(status.url)'
  ```

## Verification

- Confirm the service responds:

  ```sh
  SERVICE_URL="$(gcloud run services describe allergen-finder --project gcp-10xdev-bara-lab-3t60 --region europe-central2 --format='value(status.url)')"
  curl -fsS "$SERVICE_URL"
  ```

- Check recent logs:

  ```sh
  gcloud run services logs read allergen-finder \
    --project gcp-10xdev-bara-lab-3t60 \
    --region europe-central2 \
    --limit 50
  ```

- Manually confirm the Allergen Finder home page loads from the Cloud Run URL.

## Assumptions

- No app secrets are required for the current first deployment.
- The existing `Dockerfile` is the production artifact contract.
- `@react-router/serve` honors the `PORT` env var, so no app-code change is required for Cloud Run.
- `min-instances=0` is intentional for MVP cost control.
- Deployment commands need approval to run outside the sandbox because `gcloud` must read/write local auth/config files and call GCP APIs.

References: Google Cloud CLI initialization, Cloud Run source deploy, Cloud Build to Cloud Run, Artifact Registry with Cloud Run, and Cloud Run public access docs.

## App-Only Fast Deployment

Use this path only when the change is limited to web application behavior or
presentation and does not require a database migration, destructive data
change, secret change, runtime identity change, Cloud SQL change, or provider
configuration change. This is the normal path for UI polish, copy changes,
client-side interaction fixes, and route/component changes that keep the
existing persisted data contract.

Do not use this path if the diff includes `drizzle/`, `app/db/`,
`drizzle.config.ts`, `Dockerfile.migrate`, `cloudbuild.migrate.yaml`,
database-backed repository contract changes, session/auth provider changes,
new required environment variables, Secret Manager changes, IAM changes, or
any feature that changes the meaning, shape, retention, ownership, or
compatibility of saved user data.

### App-Only Preflight

Confirm the active GCP target and classify the diff:

```sh
gcloud config list
gcloud auth list
git status --short
git diff --name-only HEAD
```

The diff must be app-only by the criteria above. If the classification is
unclear, use the relevant full rollout section instead.

Run the local checks:

```sh
npm test
npm run typecheck
npm run build
npm audit --json
```

`npm run test:db`, migration jobs, Cloud SQL backup verification, restore
drills, and live-auth preflight jobs are not required for a pure app-only
release unless the changed code touches database persistence, auth/session
behavior, or saved-data flows.

### Build And Stage

Use an explicit release tag so the running revision can be traced back to the
reviewed commit:

```sh
RELEASE_SEQUENCE="s06" # bump from the latest deployed tag, for example s05 -> s06
REVISION="$RELEASE_SEQUENCE-$(date +%Y%m%d)-$(git rev-parse --short HEAD)"
APPLICATION_IMAGE="europe-central2-docker.pkg.dev/gcp-10xdev-bara-lab-3t60/allergen-finder/app:$REVISION"
SERVICE_ORIGIN="https://allergen-finder-hwt4hd6s4a-lm.a.run.app"
INSTANCE_CONNECTION_NAME="gcp-10xdev-bara-lab-3t60:europe-central2:allergen-finder-pg"
RUNTIME_SERVICE_ACCOUNT="allergen-finder-runtime@gcp-10xdev-bara-lab-3t60.iam.gserviceaccount.com"

gcloud builds submit \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --gcs-source-staging-dir gs://run-sources-gcp-10xdev-bara-lab-3t60-europe-central2/cloud-build/source \
  --tag "$APPLICATION_IMAGE" \
  .

gcloud run deploy allergen-finder \
  --image "$APPLICATION_IMAGE" \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --set-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --set-secrets "DATABASE_URL=allergen-database-url:latest,IDENTITY_PLATFORM_API_KEY=allergen-identity-api-key:latest,GOOGLE_MAPS_API_KEY=allergen-google-maps-api-key:latest" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=gcp-10xdev-bara-lab-3t60,APP_ORIGIN=$SERVICE_ORIGIN" \
  --port 8080 \
  --cpu 1 \
  --memory 512Mi \
  --max-instances 3 \
  --labels app=allergen-finder,env=mvp \
  --tag "$REVISION" \
  --no-traffic \
  --quiet
```

Capture the staged revision URL:

```sh
gcloud run services describe allergen-finder \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --format="table(status.traffic.revisionName,status.traffic.tag,status.traffic.percent,status.traffic.url)"
```

### App-Only Verification

Smoke the tagged no-traffic revision before moving traffic:

```sh
STAGED_REVISION="allergen-finder-000NN-xxx" # copy from the row tagged $REVISION
STAGED_URL="https://$REVISION---allergen-finder-hwt4hd6s4a-lm.a.run.app"
curl -fsS "$STAGED_URL"

gcloud run services logs read allergen-finder \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --limit 80
```

For UI changes, manually check the affected route or workflow on the staged
URL. For changes around save/history/login surfaces, also verify the relevant
signed-in and signed-out flows even if the database contract did not change.
Inspect logs for errors and confirm they do not contain passwords, ID tokens,
refresh tokens, session cookies, symptom snapshots, city labels, record
content, or owner identifiers.

### Move Traffic

Traffic movement still requires explicit human approval. After approval, route
100% traffic to the staged revision:

```sh
gcloud run services update-traffic allergen-finder \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --to-revisions "$STAGED_REVISION=100"
```

Verify production after the cutover:

```sh
curl -fsS "$SERVICE_ORIGIN"

gcloud run services describe allergen-finder \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --format='value(status.traffic)'

gcloud run services logs read allergen-finder \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --limit 60
```

Rollback for app-only releases is a Cloud Run traffic rollback to the previous
revision because no migration or data-contract change was made. Confirm the
previous revision name from `gcloud run services describe` before executing:

```sh
gcloud run services update-traffic allergen-finder \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --to-revisions PREVIOUS_REVISION=100
```

## Account Access Rollout

The account-enabled revision adds Identity Platform, Firebase Admin sessions,
and Cloud SQL for PostgreSQL. Provision Cloud SQL in `europe-central2`, enable
automated backups before user-owned data arrives, keep Cloud Run
`max-instances` bounded, and retain the application pool maximum of three
connections per instance.

Enable the required services:

```sh
gcloud services enable \
  identitytoolkit.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  serviceusage.googleapis.com \
  --project gcp-10xdev-bara-lab-3t60
```

Configure Identity Platform email/password sign-in with a 10-character minimum,
128-character maximum, no composition requirements, and email-enumeration
protection. Email verification is intentionally not an access gate for this
MVP. Monitor registration volume, failed sign-ins, throttling, and quotas.

The Cloud Run runtime service account needs:

- `roles/cloudsql.client`;
- `roles/secretmanager.secretAccessor` only for this service's secrets;
- `roles/serviceusage.serviceUsageConsumer`;
- a project-level custom role containing only
  `firebaseauth.users.createSession` and `firebaseauth.users.get`.

Do not grant Firebase Authentication Admin or Identity Platform Admin to the
runtime service account. Store `DATABASE_URL`, `IDENTITY_PLATFORM_API_KEY`,
`GOOGLE_MAPS_API_KEY`, and smoke credentials in Secret Manager. Set
`APP_ORIGIN` to the exact canonical public service origin. Attach the Cloud SQL
instance to the revision and never set `FIREBASE_AUTH_EMULATOR_HOST` in
deployed environments.

Use the Cloud SQL Unix socket in the runtime database URL:

```sh
INSTANCE_CONNECTION_NAME="gcp-10xdev-bara-lab-3t60:europe-central2:INSTANCE"
DATABASE_URL="postgresql://USER:PASSWORD@localhost/DATABASE?host=/cloudsql/${INSTANCE_CONNECTION_NAME}"
```

Deploy the account-enabled service with the bounded instance count, explicit
runtime identity, Cloud SQL attachment, and Secret Manager bindings:

```sh
gcloud run deploy allergen-finder \
  --image "$APPLICATION_IMAGE" \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --set-secrets "DATABASE_URL=allergen-database-url:latest,IDENTITY_PLATFORM_API_KEY=allergen-identity-api-key:latest,GOOGLE_MAPS_API_KEY=allergen-google-maps-api-key:latest" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=gcp-10xdev-bara-lab-3t60,APP_ORIGIN=$SERVICE_ORIGIN" \
  --max-instances 3 \
  --no-traffic
```

The live-auth preflight uses a dedicated image because the production image
correctly omits Vitest and development dependencies:

```sh
PREFLIGHT_IMAGE="europe-central2-docker.pkg.dev/gcp-10xdev-bara-lab-3t60/allergen-finder/auth-preflight:$REVISION"

gcloud builds submit \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --gcs-source-staging-dir gs://run-sources-gcp-10xdev-bara-lab-3t60-europe-central2/cloud-build/source \
  --config cloudbuild.auth-live.yaml \
  --substitutions "_IMAGE=$PREFLIGHT_IMAGE" \
  .

gcloud run jobs deploy allergen-finder-auth-preflight \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --image "$PREFLIGHT_IMAGE" \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --set-secrets "IDENTITY_PLATFORM_API_KEY=allergen-identity-api-key:latest,AUTH_LIVE_EMAIL=allergen-smoke-email:latest,AUTH_LIVE_PASSWORD=allergen-smoke-password:latest" \
  --set-env-vars "AUTH_LIVE_OPT_IN=1,AUTH_LIVE_TARGET=final-pre-traffic,AUTH_LIVE_FINAL_PROJECT_ID=gcp-10xdev-bara-lab-3t60,AUTH_LIVE_ALLOW_FINAL_TARGET=1,GOOGLE_CLOUD_PROJECT=gcp-10xdev-bara-lab-3t60"

gcloud run jobs execute allergen-finder-auth-preflight \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --wait
```

The migration also uses a dedicated one-off image:

```sh
MIGRATION_IMAGE="europe-central2-docker.pkg.dev/gcp-10xdev-bara-lab-3t60/allergen-finder/migrate:$REVISION"

gcloud builds submit \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --gcs-source-staging-dir gs://run-sources-gcp-10xdev-bara-lab-3t60-europe-central2/cloud-build/source \
  --config cloudbuild.migrate.yaml \
  --substitutions "_IMAGE=$MIGRATION_IMAGE" \
  .

gcloud run jobs deploy allergen-finder-migrate \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --image "$MIGRATION_IMAGE" \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --set-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --set-secrets "DATABASE_URL=allergen-database-url:latest"

gcloud run jobs execute allergen-finder-migrate \
  --project gcp-10xdev-bara-lab-3t60 \
  --region europe-central2 \
  --wait
```

### Release Sequence

1. Build and execute the dedicated migration Cloud Run Job above against the
   final MVP database.
2. Deploy a tagged/no-traffic revision using the command above, target runtime
   service account, attached Cloud SQL instance, and final MVP project.
3. Run `npm run test:db` against a disposable database.
4. Build and execute the dedicated live-auth Cloud Run Job above under the
   same runtime service account.
5. Smoke test registration, sign-in, seven-day session persistence, visible
   account email, sign-out, and both signed-out guest checks.
6. Inspect logs and confirm they contain no passwords, ID tokens, refresh
   tokens, session cookies, or full provider payloads.
7. Move traffic only after explicit human approval. The previous guest-only
   revision remains rollback-compatible because it ignores the new `users`
   table.

Production migrations, secret rotation, and traffic movement always require
human approval. A failed migration or live-auth preflight stops the release.

## Saved History Rollout

The symptom-history migration is additive and creates `symptom_checks` after
the account-enabled `users` table. Before moving traffic to the
history-enabled revision:

1. Verify Cloud SQL automated-backup retention and record the configured
   retention window.
2. Restore the latest backup into a non-production Cloud SQL database, run a
   basic user-table read, and retain the restore job/database evidence.
3. Run the migration job against the final database before deploying the
   no-traffic history revision.
4. Run `npm run test:db` against a separate disposable database.
5. Run deterministic tests, typecheck, production build, dependency audit, and
   the approved live-auth preflight.
6. Smoke test explicit save, private history list/detail, cross-user not-found
   behavior, and both signed-out guest flows.
7. Inspect Cloud Run logs and confirm they contain no symptom snapshot, city
   label, record content, owner identifier, password, token, or session cookie.

The previous account-enabled revision remains rollback-compatible because it
ignores the additive `symptom_checks` table. Production migration, restore,
and traffic changes require explicit human approval.

## Per-Symptom Intensity Rollout

This release replaces the saved-check ranking contract with `current-v2`.
Migration `0002_reset_symptom_checks_for_current_v2.sql` permanently deletes
all existing `symptom_checks`; the new pending-save storage key also
intentionally abandons browser drafts created by the previous revision.

Before running the production migration:

1. Confirm the latest automated Cloud SQL backup is successful and record its
   timestamp and retention window.
2. Confirm the documented restore procedure has been exercised against a
   non-production database and retain evidence that user records are readable.
3. Obtain explicit human approval for permanent removal of existing saved
   checks and old pending drafts.
4. Build the migration and application images from the same reviewed commit.

Release sequence:

1. Deploy the `current-v2` application revision with `--no-traffic`.
2. Run the migration job before sending any requests to that revision.
3. Verify the migration completed, saved history is empty, and existing user
   accounts remain readable.
4. Run deterministic tests, typecheck, production build, dependency audit, and
   `npm run test:db` against a separate disposable database.
5. Exercise a no-traffic `current-v2` smoke check: assign mixed intensities,
   save directly and through login, and confirm live/history rankings match.
6. Inspect logs for symptom snapshots, city labels, record content, owner
   identifiers, credentials, tokens, and session cookies.
7. Move traffic only after the migration and no-traffic verification pass and
   a human explicitly approves traffic movement.

Do not route traffic to `current-v2` before the reset migration. After the new
revision writes any `current-v2` checks, the previous revision is not
data-compatible. Rollback requires either restoring the verified pre-release
backup or deleting all post-release `symptom_checks` before routing traffic
back to the old revision.

### Dependency Audit Acceptance

The June 18, 2026 `npm audit --json` release check reports 12 advisories:
2 high, 10 moderate, and 0 critical.

- The direct Vite advisories affect development-server behavior. Keep
  development servers private; update Vite in a separately tested dependency
  change.
- The `form-data` advisory is transitive through Google/Firebase request
  tooling. Verify any non-breaking remediation separately because the affected
  packages sit under authentication/provider dependencies.
- The Drizzle Kit advisories affect migration/development tooling. The audit's
  suggested `0.18.1` change is a downgrade from `0.31.10` and is not accepted
  without a separately tested migration-tooling change.
- The Firebase Admin/Google Cloud/UUID chain suggests downgrading
  `firebase-admin` from `14.x` to `10.3.0`; that incompatible downgrade is not
  accepted during this product change.

These advisories are accepted for this release with no critical finding. Keep
development servers private, run migration tooling only in trusted build/job
environments, and re-run the audit before traffic movement. Dependency
upgrades remain a separate reviewed change.
