# First Cloud Run Deployment Plan

## Summary

Deploy the existing React Router app to Google Cloud Run using the repo's current Dockerfile and current GCP config:

- Project: `gcp-10xdev-bara-lab-3t60`
- Region: `europe-central2`
- Service: `allergen-finder`
- Access: public unauthenticated
- Build path: `gcloud run deploy --source .`, which uses the existing `Dockerfile`

Local readiness already checked: `npm run typecheck` and `npm run build` pass.

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
