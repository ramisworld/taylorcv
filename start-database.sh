#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the Taylor CV MVP database."
  exit 1
fi

docker compose up -d postgres