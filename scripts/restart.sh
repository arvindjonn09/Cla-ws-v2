#!/usr/bin/env bash
set -euo pipefail

# Financial Command Center — full stack restart
# Stops Kosa frontend/backend if already running, then starts both fresh.
#
# Usage:
#   bash scripts/restart.sh
#
# Defaults:
#   Frontend: http://localhost:3100
#   Backend:  http://localhost:8100

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
BACKEND_PORT="${BACKEND_PORT:-8100}"
FRONTEND_PORT="${FRONTEND_PORT:-3100}"
HOST="${HOST:-0.0.0.0}"
LOG_DIR="$APP_DIR/logs"
PID_DIR="$APP_DIR/.pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

port_pids() {
  local port="$1"
  ss -ltnp "sport = :$port" 2>/dev/null \
    | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' \
    | sort -u
}

descendant_pids() {
  local roots=("$@")
  local changed=1
  local all=" ${roots[*]} "

  while (( changed )); do
    changed=0
    while read -r pid ppid; do
      [[ -z "${pid:-}" || -z "${ppid:-}" ]] && continue
      if [[ "$all" == *" $ppid "* && "$all" != *" $pid "* ]]; then
        all+="$pid "
        changed=1
      fi
    done < <(ps -eo pid=,ppid=)
  done

  xargs -n1 <<<"$all" | awk 'NF' | sort -rn
}

stop_port() {
  local name="$1"
  local port="$2"
  mapfile -t pids < <(port_pids "$port")

  if (( ${#pids[@]} == 0 )); then
    echo "$name port $port is already free."
    return
  fi

  mapfile -t groups < <(ps -o pgid= -p "${pids[@]}" 2>/dev/null | awk '{print $1}' | sort -u)
  mapfile -t all_pids < <(descendant_pids "${pids[@]}")
  echo "Stopping $name on port $port: ${all_pids[*]}${groups[*]:+ (process groups: ${groups[*]})}"
  for group in "${groups[@]}"; do
    kill -- "-$group" 2>/dev/null || true
  done
  kill "${all_pids[@]}" 2>/dev/null || true
  sleep 2

  if ss -ltnp "sport = :$port" 2>/dev/null | grep -q ":$port"; then
    echo "$name did not stop gracefully; forcing stop."
    mapfile -t pids < <(port_pids "$port")
    mapfile -t groups < <(ps -o pgid= -p "${pids[@]}" 2>/dev/null | awk '{print $1}' | sort -u)
    mapfile -t all_pids < <(descendant_pids "${pids[@]}")
    for group in "${groups[@]}"; do
      kill -9 -- "-$group" 2>/dev/null || true
    done
    kill -9 "${all_pids[@]}" 2>/dev/null || true
    sleep 1
  fi
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local attempts="${3:-30}"

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$name is ready: $url"
      return 0
    fi
    sleep 1
  done

  echo "$name did not become ready: $url"
  return 1
}

echo "Restarting Financial Command Center..."
stop_port "frontend" "$FRONTEND_PORT"
stop_port "backend" "$BACKEND_PORT"

rm -rf "$BACKEND_DIR"/.venv/lib/python*/site-packages/~ip* 2>/dev/null || true

cd "$BACKEND_DIR"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
REQ_HASH="$(sha256sum requirements.txt | awk '{print $1}')"
REQ_STAMP=".venv/.requirements.sha256"

if find .venv/lib/python*/site-packages -maxdepth 1 -user root | grep -q .; then
  echo "Warning: some virtualenv files are owned by root."
  echo "If pip warnings continue, run:"
  echo "  sudo chown -R $(id -un):$(id -gn) $BACKEND_DIR/.venv"
fi

if [[ ! -f "$REQ_STAMP" || "$(cat "$REQ_STAMP")" != "$REQ_HASH" ]]; then
  pip install --quiet --upgrade pip
  pip install --quiet -r requirements.txt
  printf '%s\n' "$REQ_HASH" > "$REQ_STAMP"
else
  echo "Python requirements unchanged; skipping pip install."
fi
PYTHONPATH=. alembic upgrade head

echo "Starting backend on port $BACKEND_PORT..."
setsid .venv/bin/uvicorn app.main:app \
  --host "$HOST" \
  --port "$BACKEND_PORT" \
  > "$LOG_DIR/backend.log" 2>&1 < /dev/null &
echo $! > "$PID_DIR/backend.pid"

cd "$FRONTEND_DIR"
if [[ ! -d node_modules ]]; then
  npm install
fi

echo "Starting frontend on port $FRONTEND_PORT..."
setsid npm run dev \
  > "$LOG_DIR/frontend.log" 2>&1 < /dev/null &
echo $! > "$PID_DIR/frontend.pid"

wait_for_http "backend" "http://localhost:$BACKEND_PORT/api/health"
wait_for_http "frontend" "http://localhost:$FRONTEND_PORT/login"

echo
echo "Financial Command Center is running:"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend:  http://localhost:$BACKEND_PORT/api/health"
echo
echo "Logs:"
echo "  $LOG_DIR/frontend.log"
echo "  $LOG_DIR/backend.log"
