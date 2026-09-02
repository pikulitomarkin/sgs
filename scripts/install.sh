#!/usr/bin/env bash
# Instala e sobe a stack SGS/NovoSGA
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "============================================"
echo "  SGS — Instalação NovoSGA (Docker)"
echo "============================================"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado. Instale o Docker e tente novamente."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin não encontrado."
  exit 1
fi

if [ ! -f .env ]; then
  echo "Criando .env a partir de .env.example..."
  cp .env.example .env

  # Detecta IP local (Linux)
  if command -v hostname >/dev/null 2>&1; then
    DETECTED_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
    if [ -n "${DETECTED_IP:-}" ]; then
      sed -i.bak "s|MERCURE_PUBLIC_URL=http://127.0.0.1:3000/.well-known/mercure|MERCURE_PUBLIC_URL=http://${DETECTED_IP}:3000/.well-known/mercure|" .env || true
      rm -f .env.bak
      echo "MERCURE_PUBLIC_URL ajustado para http://${DETECTED_IP}:3000/.well-known/mercure"
    fi
  fi

  echo "Revise .env antes de uso em produção (senhas e IP)."
fi

echo "Baixando imagens..."
docker compose pull

echo "Subindo containers..."
docker compose up -d

echo "Aguardando healthchecks..."
sleep 20

echo ""
echo "Status:"
docker compose ps

APP_PORT="$(grep -E '^APP_PORT=' .env | cut -d= -f2 || echo 80)"
IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 127.0.0.1)"

echo ""
echo "============================================"
echo "  Pronto"
echo "  Admin:   http://${IP}:${APP_PORT}/"
echo "  Painel:  http://${IP}:8080/"
echo "  Triagem: http://${IP}:8081/"
echo "============================================"
echo "Rode: bash scripts/test.sh"
