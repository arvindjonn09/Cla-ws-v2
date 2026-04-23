#!/usr/bin/env bash
set -euo pipefail

# Financial Command Center — backend startup script
# Used by systemd fcc-backend.service
# Usage:
#   bash scripts/start.sh          # start backend on port 8100
#   bash scripts/start.sh restart  # stop existing backend on 8100, then start
#   bash scripts/start.sh fresh    # restart frontend and backend
#   bash scripts/start.sh status   # show current listener on 8100

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
VENV_DIR="$BACKEND_DIR/.venv"
PORT="${PORT:-8100}"
HOST="${HOST:-0.0.0.0}"
ACTION="${1:-start}"

cd "$BACKEND_DIR"

if [[ "$ACTION" == "fresh" || "$ACTION" == "all" ]]; then
  exec "$APP_DIR/scripts/restart.sh"
fi

port_pids() {
  ss -ltnp "sport = :$PORT" 2>/dev/null \
    | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' \
    | sort -u
}

show_status() {
  if ss -ltnp "sport = :$PORT" 2>/dev/null | grep -q ":$PORT"; then
    echo "Port $PORT is in use:"
    ss -ltnp "sport = :$PORT"
  else
    echo "Port $PORT is free."
  fi
}

if [[ "$ACTION" == "status" ]]; then
  show_status
  exit 0
fi

if [[ "$ACTION" == "restart" ]]; then
  mapfile -t pids < <(port_pids)
  if (( ${#pids[@]} > 0 )); then
    echo "Stopping existing backend on port $PORT: ${pids[*]}"
    kill "${pids[@]}" 2>/dev/null || true
    sleep 1
  fi
elif [[ "$ACTION" != "start" ]]; then
  echo "Unknown action: $ACTION"
  echo "Use: start, restart, or status"
  exit 2
fi

if ss -ltnp "sport = :$PORT" 2>/dev/null | grep -q ":$PORT"; then
  show_status
  echo "Backend is already running. Use: bash scripts/start.sh restart"
  exit 1
fi

if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

rm -rf "$VENV_DIR"/lib/python*/site-packages/~ip*

pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

# Apply pending migrations before starting
alembic upgrade head

exec uvicorn app.main:app \
  --host "$HOST" \
  --port "$PORT" \
  --workers 2 \
  --log-level info
