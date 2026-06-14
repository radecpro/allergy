# Local Development Setup

This guide runs the complete local application stack:

- React Router development server;
- containerized PostgreSQL 17 Alpine for users and saved symptom checks;
- containerized Firebase Authentication emulator for accounts and sessions;
- Google Maps Platform APIs for city and pollen data.

No GCP credentials or service-account key are required for local
authentication. The Firebase emulator owns local accounts, PostgreSQL owns
application users and saved checks, and the configured Maps API key calls the
live Google APIs. Firebase CLI runs inside Docker and is not installed on the
host.

## Prerequisites

Install:

- Node.js 24 LTS and npm;
- Docker Desktop with Docker Compose.

Confirm the tools are available:

```sh
node --version
npm --version
docker --version
docker compose version
```

## 1. Install Dependencies

From the repository root:

```sh
npm install
```

## 2. Configure the Environment

The local `.env` must already exist. Validate that it contains every variable
required by the complete local stack:

```sh
test -f .env || {
  echo ".env is required"
  exit 1
}

for variable in \
  GOOGLE_MAPS_API_KEY \
  DATABASE_URL \
  TEST_DATABASE_URL \
  GOOGLE_CLOUD_PROJECT \
  IDENTITY_PLATFORM_API_KEY \
  APP_ORIGIN \
  FIREBASE_AUTH_EMULATOR_HOST
do
  node --env-file=.env scripts/require-env.mjs "$variable" || exit 1
done
```

The validation does not modify `.env`. It exits with an error when the file is
missing or a required value is empty.

The local values should follow this shape:

```dotenv
GOOGLE_MAPS_API_KEY=your-valid-maps-api-key
DATABASE_URL=postgresql://app:password@127.0.0.1:5432/allergen_finder
TEST_DATABASE_URL=postgresql://app:password@127.0.0.1:5432/allergen_finder_test
GOOGLE_CLOUD_PROJECT=allergen-finder-local
IDENTITY_PLATFORM_API_KEY=fake-api-key
APP_ORIGIN=http://localhost:5173
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

`IDENTITY_PLATFORM_API_KEY` must be non-empty, but the Auth emulator does not
validate it against GCP. Keep `GOOGLE_CLOUD_PROJECT` identical to the project
used by the containerized Firebase CLI. Do not add a protocol to
`FIREBASE_AUTH_EMULATOR_HOST`.

The Maps key must allow the Places API, Geocoding API, and Pollen API. Restrict
the key appropriately because these calls use live Google services.

The `AUTH_LIVE_*` variables in `.env.example` are only needed for the optional
auth preflight test, not for normal browser development.

## 3. Start PostgreSQL and Firebase Authentication

Build and start both local dependencies:

```sh
docker compose up --build -d postgres firebase-auth
```

The first build downloads `postgres:17-alpine`, `node:24-alpine`, and the
pinned Firebase CLI into Docker images. Later starts reuse the images and
persistent volumes.

Wait for PostgreSQL:

```sh
until docker compose exec postgres \
  pg_isready -U app -d allergen_finder
do
  sleep 1
done
```

Create the separate disposable integration-test database when it is absent:

```sh
docker compose exec postgres sh -c \
  'psql -U app -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '\''allergen_finder_test'\''" |
    grep -q 1 ||
    createdb -U app allergen_finder_test'
```

The Compose volumes preserve PostgreSQL records and Firebase accounts between
normal restarts.

## 4. Apply Database Migrations

Migrations do not run when the application starts. Export the local
`DATABASE_URL` and apply all committed migrations:

```sh
set -a
source .env
set +a
npm run db:migrate
```

This creates the `users` and `symptom_checks` tables. Run the command again
after pulling new committed migrations.

`npm run db:generate` creates migration files after a schema change; it is not
part of normal setup.

## 5. Start the Application

PostgreSQL and Firebase Auth remain in Docker. Start the application on the
host:

```sh
npm run dev
```

Open:

```text
http://localhost:5173
```

Keep the PostgreSQL container, Firebase emulator, and application server
running while using authenticated features.

## Optional Verification

Run deterministic tests and type checking:

```sh
npm test
npm run typecheck
```

Run PostgreSQL integration tests against the separate disposable database:

```sh
set -a
source .env
set +a
npm run test:db
```

The database suite may apply migrations and modify
`allergen_finder_test`. Never point `TEST_DATABASE_URL` at the runtime or
production database.

## Stopping the Stack

Stop the application with `Ctrl+C` in its terminal. Stop the containerized
dependencies while retaining their data:

```sh
docker compose down
```

Start them again later:

```sh
docker compose up -d postgres firebase-auth
```

To delete all local PostgreSQL and Firebase data and start clean:

```sh
docker compose down --volumes
```

## Troubleshooting

### Firebase container fails to build

Confirm Docker can access the network, then rebuild:

```sh
docker compose build --no-cache firebase-auth
```

### Port 5173, 5432, or 9099 is already in use

Stop the process using the port. `APP_ORIGIN` must exactly match the browser
origin, so changing the app port also requires changing `APP_ORIGIN`.
The dev server now uses `strictPort`, so it will fail fast instead of silently
moving to another port.

### Registration or sign-in returns a generic error

Check that:

- the Firebase Auth emulator is running;
- `IDENTITY_PLATFORM_API_KEY` is non-empty;
- `GOOGLE_CLOUD_PROJECT` matches the Firebase CLI `--project` value;
- `FIREBASE_AUTH_EMULATOR_HOST` is `127.0.0.1:9099`;
- PostgreSQL is running and migrations have completed.

Authentication intentionally fails if the provider succeeds but the
application cannot persist the local user.

### History fails or saved checks do not persist

Verify the runtime database:

```sh
docker compose exec postgres \
  psql -U app -d allergen_finder -c '\dt'
```

Both `users` and `symptom_checks` should be listed.

### City or pollen requests fail

Confirm the Maps key is valid, billing is enabled, and the Places, Geocoding,
and Pollen APIs are enabled for the key's project. Inspect the terminal running
`npm run dev` for server-side provider errors.
