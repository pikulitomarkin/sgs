#!/bin/bash
# Corrige totem: tela 50/50 sem logo + serviços 6/7 na unidade 2
set -euo pipefail
cd /home/sgs/sgs

REF="${1:-83c5aa9}"
BASE="https://cdn.jsdelivr.net/gh/pikulitomarkin/sgs@${REF}"

echo "==> 1) Baixando totem (tela cheia sem logo)..."
mkdir -p totem/assets
curl -fsSL "$BASE/totem/index.html" -o totem/index.html
curl -fsSL "$BASE/totem/styles.css" -o totem/styles.css
curl -fsSL "$BASE/totem/app.js" -o totem/app.js
curl -fsSL "$BASE/totem/nginx.conf" -o totem/nginx.conf || true

# Config com IDs corretos (NÃO usar serviço 1)
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
  unidadeNome: "2º Ofício de Notas e Registro de Imóveis"
};
EOF

echo "==> 2) Conferindo HTML (não pode ter top-brand/logo)..."
if grep -qE 'top-brand|logo-cartorio' totem/index.html; then
  echo "FALHOU: HTML ainda tem logo/header"
  exit 1
fi
grep -n 'half-normal\|NORMAL\|PREFERENCIAL' totem/index.html | head -10
grep -E 'servicoNormalId|servicoPreferencialId|unidadeId' totem/config.js

echo "==> 3) Ligando serviços 6 (A) e 7 (P) na unidade 2..."
DBPASS=$(grep '^DB_PASSWORD=' .env | cut -d= -f2-)
docker compose exec -T mysqldb mysql -unovosga -p"$DBPASS" novosga2 <<'SQL'
-- Normal A
INSERT INTO servicos_unidades
  (servico_id, unidade_id, departamento_id, sigla, ativo, peso, tipo, incremento, numero_inicial, numero_final, maximo, mensagem)
VALUES
  (6, 2, NULL, 'A', 1, 0, 1, 1, 1, NULL, NULL, 'Aguarde ser chamado')
ON DUPLICATE KEY UPDATE ativo=1, sigla='A';

-- Preferencial P
INSERT INTO servicos_unidades
  (servico_id, unidade_id, departamento_id, sigla, ativo, peso, tipo, incremento, numero_inicial, numero_final, maximo, mensagem)
VALUES
  (7, 2, NULL, 'P', 1, 1, 1, 1, 1, NULL, NULL, 'Aguarde ser chamado')
ON DUPLICATE KEY UPDATE ativo=1, sigla='P';

INSERT INTO contador (unidade_id, servico_id, numero) VALUES (2, 6, 0)
ON DUPLICATE KEY UPDATE numero=numero;
INSERT INTO contador (unidade_id, servico_id, numero) VALUES (2, 7, 0)
ON DUPLICATE KEY UPDATE numero=numero;

SELECT servico_id, unidade_id, sigla, ativo FROM servicos_unidades WHERE unidade_id=2;
SQL

echo "==> 4) Reiniciando totem..."
docker compose restart totem
sleep 2

echo "==> 5) Teste API emitir Normal (serviço 6)..."
TOKEN=$(curl -s -X POST http://127.0.0.1/api/token \
  -d "grant_type=password" \
  -d "client_id=de68badb6f990b5ec99d5fad8f441d50" \
  -d "client_secret=57355874b476cf0f3fdc0088b6661b334336fa5485ece87744c63da020d7681b4ed0aa7ad1e886e9c67d41b2d78a369f5a25223d28a979e87ea3626f090cdb27" \
  -d "username=admin" \
  -d "password=00351master" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

echo "TOKEN ok: ${#TOKEN} chars"
curl -s -o /tmp/emit.json -w "HTTP %{http_code}\n" -X POST http://127.0.0.1/api/distribui \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"unidade":2,"servico":6,"prioridade":3}'
cat /tmp/emit.json; echo

echo ""
echo "OK. No tablet abra http://192.168.18.54:8082/?v=5 e Ctrl+Shift+R"
echo "Deve aparecer SÓ verde | vermelho, SEM barra azul/logo."
