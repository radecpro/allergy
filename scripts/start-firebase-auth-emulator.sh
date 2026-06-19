#!/bin/sh
set -eu

: "${GOOGLE_CLOUD_PROJECT:?GOOGLE_CLOUD_PROJECT is required}"

set -- firebase emulators:start \
  --only auth \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --export-on-exit=/data

if [ -f /data/firebase-export-metadata.json ]; then
  set -- "$@" --import=/data
fi

exec "$@"
