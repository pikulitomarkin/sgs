#!/bin/bash
# Libera Normal (6) e Preferencial (7) para atendentes + emite senhas de teste
set -euo pipefail
cd /home/sgs/sgs
DBPASS=$(grep '^DB_PASSWORD=' .env | cut -d= -f2-)

echo "==> 1) Garantir serviços na unidade 2..."
docker compose exec -T mysqldb mysql -unovosga -p"$DBPASS" novosga2 <<'SQL'
UPDATE servicos SET nome='Normal', descricao='Atendimento normal', ativo=1, peso=0 WHERE id=6;
UPDATE servicos SET nome='Preferencial', descricao='Atendimento preferencial', ativo=1, peso=1 WHERE id=7;

INSERT INTO servicos_unidades
  (servico_id, unidade_id, departamento_id, sigla, ativo, peso, tipo, incremento, numero_inicial, numero_final, maximo, mensagem)
VALUES
  (6, 2, NULL, 'A', 1, 0, 1, 1, 1, NULL, NULL, 'Aguarde ser chamado'),
  (7, 2, NULL, 'P', 1, 1, 1, 1, 1, NULL, NULL, 'Aguarde ser chamado')
ON DUPLICATE KEY UPDATE ativo=1, sigla=VALUES(sigla), peso=VALUES(peso);

INSERT INTO contador (unidade_id, servico_id, numero) VALUES (2, 6, 0), (2, 7, 0)
ON DUPLICATE KEY UPDATE numero=numero;

SELECT id, nome, ativo, peso FROM servicos WHERE id IN (6,7);
SELECT servico_id, unidade_id, sigla, ativo, peso FROM servicos_unidades WHERE unidade_id=2;
SQL

echo "==> 2) Liberar serviços 6 e 7 para TODOS os usuários da unidade 2..."
docker compose exec -T mysqldb mysql -unovosga -p"$DBPASS" novosga2 <<'SQL'
-- usuários existentes
SELECT id, login, nome, sobrenome FROM usuarios;

-- lotacoes (quem tem acesso à unidade)
SELECT * FROM lotacoes;

-- limpa e reinsere vínculos (Normal peso 0, Preferencial peso 1)
DELETE FROM servicos_usuarios WHERE unidade_id=2 AND servico_id IN (6,7);

INSERT INTO servicos_usuarios (servico_id, unidade_id, usuario_id, peso)
SELECT 6, 2, u.id, 0 FROM usuarios u;

INSERT INTO servicos_usuarios (servico_id, unidade_id, usuario_id, peso)
SELECT 7, 2, u.id, 1 FROM usuarios u;

SELECT * FROM servicos_usuarios WHERE unidade_id=2 ORDER BY usuario_id, servico_id;
SQL

echo "==> 3) Emitir 1 Normal + 1 Preferencial de teste..."
TOKEN=$(curl -s -X POST http://127.0.0.1/api/token \
  -d "grant_type=password" \
  -d "client_id=de68badb6f990b5ec99d5fad8f441d50" \
  -d "client_secret=57355874b476cf0f3fdc0088b6661b334336fa5485ece87744c63da020d7681b4ed0aa7ad1e886e9c67d41b2d78a369f5a25223d28a979e87ea3626f090cdb27" \
  -d "username=admin" \
  -d "password=00351master" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

echo "Normal:"
curl -s -X POST http://127.0.0.1/api/distribui \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"unidade":2,"servico":6,"prioridade":3}'
echo
echo "Preferencial:"
curl -s -X POST http://127.0.0.1/api/distribui \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"unidade":2,"servico":7,"prioridade":4}'
echo

echo "==> 4) Senhas aguardando na fila..."
docker compose exec -T mysqldb mysql -unovosga -p"$DBPASS" novosga2 -e "
SELECT id, status, senha_sigla, senha_numero, servico_id, prioridade_id, unidade_id
FROM atendimentos
WHERE unidade_id=2 AND status IN ('emitida','senha','aguardando')
ORDER BY id DESC LIMIT 20;

SELECT status, COUNT(*) c FROM atendimentos WHERE unidade_id=2 GROUP BY status;
"

echo ""
echo "OK. Agora no navegador:"
echo "  1) SAIA do atendimento (logout ou /logout)"
echo "  2) Entre de novo com o usuário do guichê (teste)"
echo "  3) Abra Atendimento e escolha Guichê"
echo "  4) Deve aparecer duas filas: Normal e Preferencial"
echo "     + botão Chamar em cada uma / Chamar próximo"
