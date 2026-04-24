#!/usr/bin/env bash
set -euo pipefail

# Monitors the local app and public Cloudflare URL.
# If anything important is down, restart the full stack and keep watching until
# the monitor window ends.
#
# Usage:
#   bash scripts/auto-restart.sh
#
# Optional env vars:
#   MONITOR_MINUTES=5
#   CHECK_INTERVAL=15
#   BACKEND_HEALTH_URL=http://127.0.0.1:8100/api/health
#   FRONTEND_LOCAL_URL=http://127.0.0.1:3100/login
#   PUBLIC_URL=https://finfreak.shivomsangha.com/login

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
RESTART_SCRIPT="$APP_DIR/scripts/restart.sh"
LOCK_FILE="$APP_DIR/.auto-restart.lock"

MONITOR_MINUTES="${MONITOR_MINUTES:-5}"
CHECK_INTERVAL="${CHECK_INTERVAL:-15}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:8100/api/health}"
FRONTEND_LOCAL_URL="${FRONTEND_LOCAL_URL:-http://127.0.0.1:3100/login}"

if [[ -f "$BACKEND_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$BACKEND_DIR/.env"
  set +a
fi

PUBLIC_BASE_URL="${PUBLIC_URL:-${FRONTEND_URL:-https://finfreak.shivomsangha.com}}"
PUBLIC_CHECK_URL="${PUBLIC_CHECK_URL:-${PUBLIC_BASE_URL%/}/login}"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another auto-restart monitor is already running."
  exit 1
fi

timestamp() {
  date '+%Y-%m-%d %H:%M:%S %Z'
}

log() {
  echo "[$(timestamp)] $*"
}

http_ok() {
  local url="$1"
  curl -fsS --max-time 15 "$url" >/dev/null 2>&1
}

cloudflare_ok() {
  local url="$1"
  local headers

  if [[ "$url" =~ ^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?(/|$) ]]; then
    return 0
  fi

  headers="$(curl -fsSI --max-time 20 "$url" 2>/dev/null || true)"
  [[ -n "$headers" ]] || return 1
  grep -qiE '^(server: cloudflare|cf-ray:|cf-cache-status:)' <<<"$headers"
}

service_running() {
  local label="$1"
  local url="$2"
  if http_ok "$url"; then
    log "$label check passed: $url"
    return 0
  fi

  log "$label check failed: $url"
  return 1
}

public_running() {
  if http_ok "$PUBLIC_CHECK_URL"; then
    if cloudflare_ok "$PUBLIC_CHECK_URL"; then
      log "Public Cloudflare check passed: $PUBLIC_CHECK_URL"
      return 0
    fi
    log "Public URL responds but Cloudflare headers were not detected: $PUBLIC_CHECK_URL"
    return 1
  fi

  log "Public URL is unreachable: $PUBLIC_CHECK_URL"
  return 1
}

stack_healthy() {
  local ok=0

  service_running "Backend" "$BACKEND_HEALTH_URL" || ok=1
  service_running "Frontend" "$FRONTEND_LOCAL_URL" || ok=1
  public_running || ok=1

  return "$ok"
}

restart_stack() {
  log "Restarting Financial Command Center..."
  bash "$RESTART_SCRIPT"
}

deadline=$(( $(date +%s) + MONITOR_MINUTES * 60 ))
restart_count=0

log "Auto-restart monitor started for ${MONITOR_MINUTES} minute(s)."
log "Backend: $BACKEND_HEALTH_URL"
log "Frontend: $FRONTEND_LOCAL_URL"
log "Public: $PUBLIC_CHECK_URL"

while (( $(date +%s) < deadline )); do
  if stack_healthy; then
    sleep "$CHECK_INTERVAL"
    continue
  fi

  restart_count=$((restart_count + 1))
  restart_stack

  local_deadline=$(( $(date +%s) + 180 ))
  recovered=0
  while (( $(date +%s) < local_deadline )); do
    if stack_healthy; then
      recovered=1
      log "Recovery check passed after restart."
      break
    fi
    sleep 10
  done

  if (( recovered == 0 )); then
    log "Stack did not recover within 3 minutes after restart."
  fi

  sleep "$CHECK_INTERVAL"
done

if (( restart_count == 0 )); then
  log "Monitor window ended. No restart was needed."
else
  log "Monitor window ended. Restart attempts: $restart_count"
fi
