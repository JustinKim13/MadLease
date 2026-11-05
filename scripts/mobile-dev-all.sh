#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"
FRONTEND_DIR="${REPO_ROOT}/frontend"
LOG_DIR="${REPO_ROOT}/.tmp"
BACKEND_LOG="${LOG_DIR}/mobile-backend.log"

detect_lan_ip() {
  local ip=""
  for iface in en0 en1 en2 en3 en4; do
    ip="$(ipconfig getifaddr "${iface}" 2>/dev/null || true)"
    [[ -n "${ip}" ]] && break
  done
  echo "${ip}"
}

LAN_IP="${LAN_IP:-$(detect_lan_ip)}"
if [[ -z "${LAN_IP}" ]]; then
  echo "Could not auto-detect LAN IP."
  echo "Run with: LAN_IP=192.168.x.x scripts/mobile-dev-all.sh"
  exit 1
fi

mkdir -p "${LOG_DIR}"

# Kill any process already on port 8080
if lsof -ti:8080 &>/dev/null; then
  echo "Killing existing process on port 8080..."
  lsof -ti:8080 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    echo
    echo "Stopping backend (pid ${BACKEND_PID})..."
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "LAN IP: ${LAN_IP}"
echo "Frontend URL (phone): http://${LAN_IP}:5173"
echo "Backend API URL: http://${LAN_IP}:8080/api"
echo
CORS_ALLOWED_ORIGINS="http://localhost:5173,http://${LAN_IP}:5173,http://localhost:4173,http://${LAN_IP}:4173"

echo "Starting backend (logs: ${BACKEND_LOG})..."
(
  cd "${BACKEND_DIR}"
  env \
    CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS}" \
    AWS_LOCALSTACK_ENDPOINT="http://${LAN_IP}:4566" \
    ./gradlew bootRun --args='--server.address=0.0.0.0'
) >"${BACKEND_LOG}" 2>&1 &
BACKEND_PID=$!

sleep 2
if ! kill -0 "${BACKEND_PID}" 2>/dev/null; then
  echo "Backend failed to start. Recent logs:"
  if [[ -f "${BACKEND_LOG}" ]]; then
    awk 'NR<=120 { print }' "${BACKEND_LOG}"
  fi
  exit 1
fi

echo "Backend started (pid ${BACKEND_PID})."
echo "Starting frontend..."
cd "${FRONTEND_DIR}"
env VITE_API_BASE_URL="http://${LAN_IP}:8080/api" npm run dev -- --host 0.0.0.0
