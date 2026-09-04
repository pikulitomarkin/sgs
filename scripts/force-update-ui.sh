#!/bin/bash
# Atualiza totem + painel forçando download do GitHub (sem cache)
set -euo pipefail
cd /home/sgs/sgs

# Pin no commit mais recente / use main com cache-bust
REF="${1:-main}"
BASE="https://cdn.jsdelivr.net/gh/pikulitomarkin/sgs@${REF}"
# Fallback raw com timestamp
RAW="https://raw.githubusercontent.com/pikulitomarkin/sgs/${REF}"
TS=$(date +%s)

download() {
  local rel="$1"
  local dest="$2"
  if curl -fsSL "${BASE}/${rel}" -o "$dest"; then
    return 0
  fi
  curl -fsSL "${RAW}/${rel}?t=${TS}" -o "$dest"
}

echo "==> Baixando arquivos (ref=${REF})..."
mkdir -p totem/assets painel/assets

download "totem/index.html" "totem/index.html"
download "totem/styles.css" "totem/styles.css"
download "totem/app.js" "totem/app.js"
download "totem/config.js" "totem/config.js"
download "totem/nginx.conf" "totem/nginx.conf" || true

download "painel/index.html" "painel/index.html"
download "painel/styles.css" "painel/styles.css"
download "painel/app.js" "painel/app.js"
download "painel/config.js" "painel/config.js"
download "painel/assets/logo-cartorio.png" "painel/assets/logo-cartorio.png" || true
download "painel/nginx.conf" "painel/nginx.conf" || true

echo "==> Conferindo totem (não deve ter logo/header)..."
if grep -q "top-brand\|logo-cartorio" totem/index.html; then
  echo "ERRO: totem/index.html ainda tem logo/header"
  exit 1
fi
grep -n "half-normal\|half-pref\|NORMAL\|PREFERENCIAL" totem/index.html | head -20
ls -la totem/index.html totem/styles.css

echo "==> Reiniciando containers..."
docker compose restart totem painel-tv
docker compose ps totem painel-tv

echo ""
echo "OK. No tablet: Ctrl+Shift+R ou limpar cache"
echo "  Totem:  http://192.168.18.54:8082/"
echo "  Painel: http://192.168.18.54:8083/"
