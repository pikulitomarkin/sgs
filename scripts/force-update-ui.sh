#!/bin/bash
# Atualiza totem + painel forçando download do GitHub
set -euo pipefail
cd /home/sgs/sgs

BASE="https://raw.githubusercontent.com/pikulitomarkin/sgs/main"

echo "==> Baixando arquivos do GitHub..."
mkdir -p totem/assets painel/assets

curl -fsSL "$BASE/totem/index.html" -o totem/index.html
curl -fsSL "$BASE/totem/styles.css" -o totem/styles.css
curl -fsSL "$BASE/totem/app.js" -o totem/app.js
curl -fsSL "$BASE/totem/config.js" -o totem/config.js
curl -fsSL "$BASE/totem/assets/logo-cartorio.png" -o totem/assets/logo-cartorio.png

curl -fsSL "$BASE/painel/index.html" -o painel/index.html
curl -fsSL "$BASE/painel/styles.css" -o painel/styles.css
curl -fsSL "$BASE/painel/app.js" -o painel/app.js
curl -fsSL "$BASE/painel/config.js" -o painel/config.js
curl -fsSL "$BASE/painel/assets/logo-cartorio.png" -o painel/assets/logo-cartorio.png

echo "==> Conferindo..."
grep -n "logo-cartorio\|2º Ofício\|half-normal\|brand-wrap" totem/index.html painel/index.html || true
ls -la totem/assets/logo-cartorio.png painel/assets/logo-cartorio.png
grep -E "servicoPreferencialId|servicoNormalId" totem/config.js

echo "==> Reiniciando containers..."
docker compose restart totem painel-tv
docker compose ps totem painel-tv

echo ""
echo "OK. Abra com Ctrl+Shift+R:"
echo "  Totem:  http://192.168.18.54:8082/"
echo "  Painel: http://192.168.18.54:8083/"
