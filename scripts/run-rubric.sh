#!/usr/bin/env bash
# Shim — canonical script lives at rubrics/run-rubric.sh
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/rubrics/run-rubric.sh" "$@"
