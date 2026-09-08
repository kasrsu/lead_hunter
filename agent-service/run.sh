#!/usr/bin/env bash
# Start the agent service for local dev.
#
# Uses the machine's preferred venv if present, else a local .venv, else
# whatever `uvicorn` is on PATH. Override with PYTHON_VENV to pin one:
#   PYTHON_VENV=/path/to/venv ./run.sh
set -euo pipefail
cd "$(dirname "$0")"

UVICORN_BIN=""
for candidate in \
  "${PYTHON_VENV:-/home/kasr/Storage/Study_Dir/venvs/vz_rag}/bin/uvicorn" \
  ".venv/bin/uvicorn"; do
  if [ -x "$candidate" ]; then
    UVICORN_BIN="$candidate"
    break
  fi
done
if [ -z "$UVICORN_BIN" ] && command -v uvicorn >/dev/null 2>&1; then
  UVICORN_BIN="uvicorn"
fi

if [ -z "$UVICORN_BIN" ]; then
  echo "No uvicorn found. Activate a venv with the agent-service deps installed (pip install -r requirements.txt)." >&2
  exit 1
fi

exec "$UVICORN_BIN" app.main:app --reload --port "${PORT:-8000}"
