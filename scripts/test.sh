#!/usr/bin/env bash
# Smoke tests da stack SGS
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

fail=0

check_http() {
  local name="$1"
  local url="$2"
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" || echo 000)"
  if [[ "$code" =~ ^(200|301|302|401|403)$ ]]; then
    echo "OK  [$code] $name -> $url"
  else
    echo "FAIL [$code] $name -> $url"
    fail=1
  fi
}

echo "============================================"
echo "  SGS — Testes"
echo "============================================"

echo ""
echo "[containers]"
docker compose ps || fail=1

echo ""
echo "[http]"
check_http "novosga-login" "http://127.0.0.1:${APP_PORT:-80}/login"
check_http "novosga-root"  "http://127.0.0.1:${APP_PORT:-80}/"
check_http "painel"        "http://127.0.0.1:${PAINEL_PORT:-8080}/"
check_http "triagem"       "http://127.0.0.1:${TRIAGEM_PORT:-8081}/"
check_http "mercure"       "http://127.0.0.1:${MERCURE_PORT:-3000}/.well-known/mercure"

echo ""
echo "[mercure config]"
if [ -f .env ]; then
  grep -E '^MERCURE_PUBLIC_URL=' .env || true
  PUB="$(grep -E '^MERCURE_PUBLIC_URL=' .env | cut -d= -f2-)"
  if echo "$PUB" | grep -q '127.0.0.1'; then
    echo "AVISO: MERCURE_PUBLIC_URL aponta para 127.0.0.1 — TV/totem na rede local não vão receber chamadas em tempo real."
    echo "       Ajuste para http://IP_DO_SERVIDOR:3000/.well-known/mercure"
  fi
fi

echo ""
echo "[logs recentes novosga]"
docker compose logs --tail 30 novosga || true

echo ""
if [ "$fail" -eq 0 ]; then
  echo "RESULTADO: PASS"
  exit 0
else
  echo "RESULTADO: FAIL"
  exit 1
fi
