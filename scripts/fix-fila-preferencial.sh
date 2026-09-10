#!/bin/bash
# Preferencial na frente do Normal (Chamar próximo / Todos serviços)
# Causa: NovoSGA 2.2 ordena servicoUsuario ASC ANTES da prioridade.
# Com Normal peso=0 e Preferencial peso=1, o Normal vinha primeiro.
set -euo pipefail
cd /home/sgs/sgs
DBPASS=$(grep '^DB_PASSWORD=' .env | cut -d= -f2-)

echo "==> 1) Pesos de prioridade e serviço..."
docker compose exec -T mysqldb mysql -unovosga -p"$DBPASS" novosga2 <<'SQL'
-- Prioridade: Normal/sem = 0 | Preferencial = 10
UPDATE prioridades SET peso=0, ativo=1 WHERE id=3;
UPDATE prioridades SET peso=10, ativo=1 WHERE id=4;
UPDATE prioridades SET peso=0 WHERE LOWER(nome) LIKE '%normal%' OR LOWER(nome) LIKE '%sem prioridade%' OR LOWER(nome) LIKE '%convencional%';
UPDATE prioridades SET peso=10 WHERE (LOWER(nome) LIKE '%prefer%' OR LOWER(nome) LIKE '%priori%' OR LOWER(nome) LIKE '%idoso%') AND id<>3;

-- Serviço global + unidade: Preferencial peso maior (usado com order DESC em servicoUnidade)
UPDATE servicos SET peso=0, ativo=1, nome='Normal' WHERE id=6;
UPDATE servicos SET peso=10, ativo=1, nome='Preferencial' WHERE id=7;
UPDATE servicos_unidades SET peso=0, ativo=1, sigla='A' WHERE unidade_id=2 AND servico_id=6;
UPDATE servicos_unidades SET peso=10, ativo=1, sigla='P' WHERE unidade_id=2 AND servico_id=7;

-- CRÍTICO: servicoUsuario usa ASC no padrão do NovoSGA 2.2
-- peso MENOR = aparece ANTES → Preferencial=0, Normal=1
DELETE FROM servicos_usuarios WHERE unidade_id=2 AND servico_id IN (6,7);
INSERT INTO servicos_usuarios (servico_id, unidade_id, usuario_id, peso)
SELECT 6, 2, u.id, 1 FROM usuarios u;
INSERT INTO servicos_usuarios (servico_id, unidade_id, usuario_id, peso)
SELECT 7, 2, u.id, 0 FROM usuarios u;

SELECT 'PRIORIDADES' AS t; SELECT id, nome, peso FROM prioridades ORDER BY peso DESC, id;
SELECT 'SERVICOS_UNIDADE' AS t; SELECT servico_id, sigla, peso FROM servicos_unidades WHERE unidade_id=2;
SELECT 'SERVICOS_USUARIOS' AS t; SELECT servico_id, usuario_id, peso FROM servicos_usuarios WHERE unidade_id=2 ORDER BY peso, servico_id LIMIT 20;
SQL

echo "==> 2) Ordenação da fila: prioridade ANTES de dataChegada..."
docker compose exec -T mysqldb mysql -unovosga -p"$DBPASS" novosga2 <<'SQL'
-- Tabela metadata (NovoSGA 2.x)
DESCRIBE metadata;

-- Ver config atual
SELECT namespace, name, value FROM metadata
WHERE namespace='novosga.settings' AND name='queue';

-- Grava ordenação correta (prioridade DESC primeiro)
INSERT INTO metadata (namespace, name, value)
VALUES (
  'novosga.settings',
  'queue',
  '{"ordering":[{"field":"prioridade","order":"DESC"},{"field":"servicoUnidade","order":"DESC"},{"field":"servicoUsuario","order":"ASC"},{"field":"dataChegada","order":"ASC"},{"field":"dataAgendamento","order":"ASC"}]}'
)
ON DUPLICATE KEY UPDATE value=VALUES(value);

-- Se a PK/unique for outra, tenta UPDATE direto
UPDATE metadata
SET value='{"ordering":[{"field":"prioridade","order":"DESC"},{"field":"servicoUnidade","order":"DESC"},{"field":"servicoUsuario","order":"ASC"},{"field":"dataChegada","order":"ASC"},{"field":"dataAgendamento","order":"ASC"}]}'
WHERE namespace='novosga.settings' AND name='queue';

SELECT namespace, name, value FROM metadata
WHERE namespace='novosga.settings' AND name='queue';
SQL

echo "==> 3) Corrige senhas P já na fila (prioridade Preferencial id=4)..."
docker compose exec -T mysqldb mysql -unovosga -p"$DBPASS" novosga2 <<'SQL'
-- Descobre colunas
SHOW COLUMNS FROM atendimentos LIKE '%prioridade%';
SHOW COLUMNS FROM atendimentos LIKE '%status%';

-- Atualiza senhas emitidas do serviço Preferencial (7) para prioridade 4
UPDATE atendimentos
SET prioridade_id=4
WHERE unidade_id=2 AND servico_id=7 AND status IN ('emitida','senha')
  AND (prioridade_id IS NULL OR prioridade_id<>4);

UPDATE atendimentos
SET prioridade_id=3
WHERE unidade_id=2 AND servico_id=6 AND status IN ('emitida','senha')
  AND (prioridade_id IS NULL OR prioridade_id<>3);

-- Simulação da ordem (como a tela deveria mostrar)
SELECT
  a.senha_sigla, a.senha_numero, a.servico_id, a.prioridade_id, p.peso AS peso_prio, a.status
FROM atendimentos a
LEFT JOIN prioridades p ON p.id=a.prioridade_id
WHERE a.unidade_id=2 AND a.status IN ('emitida','senha')
ORDER BY p.peso DESC, a.data_chegada ASC
LIMIT 25;
SQL

echo "==> 4) Totem: Preferencial = serviço 7 + prioridade 4..."
if [ -f totem/config.js ]; then
  sed -i 's/prioridadePreferencialId: *[0-9]*/prioridadePreferencialId: 4/' totem/config.js
  sed -i 's/prioridadeNormalId: *[0-9]*/prioridadeNormalId: 3/' totem/config.js
  sed -i 's/servicoPreferencialId: *[0-9]*/servicoPreferencialId: 7/' totem/config.js
  sed -i 's/servicoNormalId: *[0-9]*/servicoNormalId: 6/' totem/config.js
  grep -E 'prioridade|servico' totem/config.js || true
fi

docker compose restart totem >/dev/null 2>&1 || true
# limpa cache do Symfony se existir
docker compose exec -T novosga php bin/console cache:clear --env=prod 2>/dev/null || true

echo ""
echo "OK. Agora em Todos serviços / Chamar próximo:"
echo "  1º as senhas P (Preferencial), depois as A (Normal)."
echo "Saia e entre de novo no atendimento (F5 / logout)."
