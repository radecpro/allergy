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
