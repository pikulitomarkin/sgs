#!/bin/bash
# Preferencial passa na frente do Normal ao usar "Chamar próximo"
set -euo pipefail
cd /home/sgs/sgs
DBPASS=$(grep '^DB_PASSWORD=' .env | cut -d= -f2-)

echo "==> Ajustando pesos (maior peso = atende primeiro)..."
docker compose exec -T mysqldb mysql -unovosga -p"$DBPASS" novosga2 <<'SQL'
-- Prioridades: Normal peso 0 | Preferencial peso 1 (ou mais)
UPDATE prioridades SET peso=0, ativo=1 WHERE id=3;
UPDATE prioridades SET peso=1, ativo=1 WHERE id=4;
-- Se existirem outros nomes
UPDATE prioridades SET peso=0 WHERE LOWER(nome) LIKE '%normal%' OR LOWER(nome) LIKE '%sem prioridade%' OR LOWER(nome) LIKE '%convencional%';
UPDATE prioridades SET peso=1 WHERE LOWER(nome) LIKE '%prefer%' OR LOWER(nome) LIKE '%priori%' OR LOWER(nome) LIKE '%idoso%';

-- Serviços: Normal (6) peso 0 | Preferencial (7) peso 1
UPDATE servicos SET peso=0, ativo=1 WHERE id=6;
UPDATE servicos SET peso=1, ativo=1 WHERE id=7;

-- Na unidade
UPDATE servicos_unidades SET peso=0, ativo=1, sigla='A' WHERE unidade_id=2 AND servico_id=6;
UPDATE servicos_unidades SET peso=1, ativo=1, sigla='P' WHERE unidade_id=2 AND servico_id=7;

-- No vínculo do atendente (peso do serviço por usuário)
UPDATE servicos_usuarios SET peso=0 WHERE unidade_id=2 AND servico_id=6;
UPDATE servicos_usuarios SET peso=1 WHERE unidade_id=2 AND servico_id=7;

-- Garantir vínculo
INSERT IGNORE INTO servicos_usuarios (servico_id, unidade_id, usuario_id, peso)
SELECT 6, 2, u.id, 0 FROM usuarios u;
INSERT IGNORE INTO servicos_usuarios (servico_id, unidade_id, usuario_id, peso)
SELECT 7, 2, u.id, 1 FROM usuarios u;

SELECT '=== PRIORIDADES ===' AS info;
SELECT id, nome, peso, ativo FROM prioridades ORDER BY peso DESC, id;

SELECT '=== SERVICOS UNIDADE 2 ===' AS info;
SELECT su.servico_id, s.nome, su.sigla, su.peso, su.ativo
FROM servicos_unidades su
JOIN servicos s ON s.id=su.servico_id
WHERE su.unidade_id=2;

SELECT '=== SERVICOS USUARIOS ===' AS info;
SELECT * FROM servicos_usuarios WHERE unidade_id=2 ORDER BY usuario_id, peso DESC;
SQL

echo "==> Garantindo totem usa prioridade 4 no Preferencial..."
if [ -f totem/config.js ]; then
  sed -i 's/prioridadePreferencialId: *[0-9]*/prioridadePreferencialId: 4/' totem/config.js
  sed -i 's/prioridadeNormalId: *[0-9]*/prioridadeNormalId: 3/' totem/config.js
  sed -i 's/servicoPreferencialId: *[0-9]*/servicoPreferencialId: 7/' totem/config.js
  sed -i 's/servicoNormalId: *[0-9]*/servicoNormalId: 6/' totem/config.js
  grep -E 'prioridade|servico' totem/config.js
fi

docker compose restart totem >/dev/null 2>&1 || true

echo ""
echo "OK. Preferencial (P) tem peso maior que Normal (A)."
echo "No atendimento use o botão azul **Chamar próximo** (Todos serviços)."
echo "Se clicar Chamar só na fila Normal, a Preferencial não entra nessa fila."
echo "Saia e entre de novo no atendimento após este ajuste."
