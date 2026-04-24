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
BACKEND_PORT="8100"
FRONTEND_PORT="3100"
HOST="${HOST:-0.0.0.0}"
PUBLIC_URL="${FRONTEND_URL:-https://finfreak.shivomsangha.com}"
CLOUDFLARE_TARGET_PORT="${CLOUDFLARE_TARGET_PORT:-$FRONTEND_PORT}"
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

cloudflared_cmdline() {
  if command -v pgrep >/dev/null 2>&1; then
    pgrep -af cloudflared 2>/dev/null || true
  fi
}

verify_cloudflare_link() {
  if [[ "$PUBLIC_URL" =~ ^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?(/|$) ]]; then
    echo "Cloudflare check skipped: FRONTEND_URL points to a local address ($PUBLIC_URL)."
    return 0
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "Cloudflare check skipped: curl is not installed."
    return 0
  fi

  local tunnel_cmd tunnel_config tunnel_target_match
  tunnel_cmd="$(cloudflared_cmdline)"
  tunnel_config=""

  if [[ -n "$tunnel_cmd" ]]; then
    echo "Cloudflare tunnel process detected:"
    printf '%s\n' "$tunnel_cmd"
  elif [[ -f "${HOME:-}/.cloudflared/config.yml" ]]; then
    tunnel_config="${HOME:-}/.cloudflared/config.yml"
  elif [[ -f "${HOME:-}/.cloudflared/config.yaml" ]]; then
    tunnel_config="${HOME:-}/.cloudflared/config.yaml"
  elif [[ -f "/etc/cloudflared/config.yml" ]]; then
    tunnel_config="/etc/cloudflared/config.yml"
  elif [[ -f "/etc/cloudflared/config.yaml" ]]; then
    tunnel_config="/etc/cloudflared/config.yaml"
  fi

  if [[ -n "$tunnel_config" ]]; then
    echo "Cloudflare tunnel config detected: $tunnel_config"
    tunnel_target_match="$(grep -E "localhost:${CLOUDFLARE_TARGET_PORT}|127\.0\.0\.1:${CLOUDFLARE_TARGET_PORT}" "$tunnel_config" || true)"
    if [[ -n "$tunnel_target_match" ]]; then
      echo "Cloudflare tunnel target matches local port $CLOUDFLARE_TARGET_PORT."
    else
      echo "Warning: Cloudflare tunnel config does not reference local port $CLOUDFLARE_TARGET_PORT."
      echo "Expected the tunnel to point at http://localhost:$CLOUDFLARE_TARGET_PORT or http://127.0.0.1:$CLOUDFLARE_TARGET_PORT."
    fi
  else
    echo "Warning: no cloudflared process or config file was found."
    echo "If Cloudflare is meant to front this app, make sure the tunnel points to port $CLOUDFLARE_TARGET_PORT."
  fi

  local headers
  headers="$(curl -fsSI --max-time 15 "$PUBLIC_URL" 2>/dev/null || true)"
  if [[ -z "$headers" ]]; then
    echo "Cloudflare check failed: could not reach $PUBLIC_URL."
    return 1
  fi

  if grep -qiE '^(server: cloudflare|cf-ray:|cf-cache-status:)' <<<"$headers"; then
    echo "Cloudflare edge response detected for $PUBLIC_URL."
  else
    echo "Warning: $PUBLIC_URL responded, but Cloudflare headers were not obvious."
    echo "Response headers:"
    printf '%s\n' "$headers"
  fi

  return 0
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
verify_cloudflare_link || true

echo
echo "Financial Command Center is running:"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend:  http://localhost:$BACKEND_PORT/api/health"
echo "  Public:   $PUBLIC_URL"
echo "  Cloudflare target port: $CLOUDFLARE_TARGET_PORT"
echo
echo "Logs:"
echo "  $LOG_DIR/frontend.log"
echo "  $LOG_DIR/backend.log"
