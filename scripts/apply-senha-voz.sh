#!/bin/bash
# Aplica formatação A001/P001 + voz no painel (força arquivos no disco)
set -euo pipefail
cd /home/sgs/sgs

REF="${1:-main}"
BASE="https://cdn.jsdelivr.net/gh/pikulitomarkin/sgs@${REF}"
TS=$(date +%s)

echo "==> Baixando totem + painel (${REF})..."
curl -fsSL "$BASE/totem/app.js?t=$TS" -o totem/app.js
curl -fsSL "$BASE/totem/config.js?t=$TS" -o totem/config.js
curl -fsSL "$BASE/totem/index.html?t=$TS" -o totem/index.html
curl -fsSL "$BASE/painel/app.js?t=$TS" -o painel/app.js
curl -fsSL "$BASE/painel/config.js?t=$TS" -o painel/config.js
curl -fsSL "$BASE/painel/index.html?t=$TS" -o painel/index.html
curl -fsSL "$BASE/painel/styles.css?t=$TS" -o painel/styles.css

# Força config do totem com padding
cat > totem/config.js <<'EOF'
window.SGS_TOTEM_CONFIG = {
  apiBase: "",
  clientId: "de68badb6f990b5ec99d5fad8f441d50",
  clientSecret: "57355874b476cf0f3fdc0088b6661b334336fa5485ece87744c63da020d7681b4ed0aa7ad1e886e9c67d41b2d78a369f5a25223d28a979e87ea3626f090cdb27",
  username: "admin",
  password: "00351master",
  unidadeId: 2,
  servicoId: 6,
  servicoNormalId: 6,
  servicoPreferencialId: 7,
  prioridadeNormalId: 3,
  prioridadePreferencialId: 4,
  autoPrint: true,
  autoCloseMs: 8000,
  senhaDigitos: 3,
  unidadeNome: "2º Ofício de Notas e Registro de Imóveis"
};
EOF

# Força voz no painel
python3 - <<'PY'
from pathlib import Path
p = Path("painel/config.js")
t = p.read_text(encoding="utf-8")
for old, new in [
    ("speak: false", "speak: true"),
    ("speakRepeats: 1", "speakRepeats: 2"),
]:
    t = t.replace(old, new)
if "speak: true" not in t:
    t = t.replace("window.SGS_PAINEL_CONFIG = {", "window.SGS_PAINEL_CONFIG = {\n  speak: true,")
p.write_text(t, encoding="utf-8")
print("painel config ok")
PY

echo "==> Conferindo padding no totem/app.js..."
grep -n "senhaFinal\|pad3\|A001\|normalizarTextoSenha" totem/app.js | head -20
if ! grep -q "senhaFinal\|pad3" totem/app.js; then
  echo "ERRO: totem/app.js sem formatação A001"
  exit 1
fi

echo "==> Conferindo voz no painel..."
grep -n "speakCall\|speechSynthesis\|Voz do painel" painel/app.js | head -20
grep -E "speak:" painel/config.js

docker compose restart totem painel-tv
sleep 1
docker compose ps totem painel-tv

echo ""
echo "OK. Teste:"
echo "  Totem:  http://192.168.18.54:8082/?v=$TS  (Ctrl+Shift+R) → Preferencial deve imprimir P00X"
echo "  Painel: http://192.168.18.54:8083/?v=$TS  → toque em 'ativar a voz' (deve falar a confirmação)"
