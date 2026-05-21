#!/usr/bin/env bash
# Copy Firebase Admin JSON into server/ for Docker volume mount (gitignored).
set -euo pipefail
SERVER_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${SERVER_ROOT}/.." && pwd)"
SRC="${REPO_ROOT}/apgard-safe-online-firebase-adminsdk-fbsvc-d4f5701c1a.json"
DEST="${SERVER_ROOT}/firebase-credentials.json"

if [[ ! -f "${SRC}" ]]; then
  echo "Source not found: ${SRC}" >&2
  echo "Place your Firebase service account JSON at that path, or set SRC manually." >&2
  exit 1
fi

rm -rf "${DEST}"
cp "${SRC}" "${DEST}"
chmod 600 "${DEST}"
echo "Synced ${DEST}"
