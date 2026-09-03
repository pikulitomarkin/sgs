# Painel SGS — TV / monitor

Exibe na chamada:

- **Senha**
- **Guichê** (`local` + `numeroLocal`)
- **Nome do atendente** (via `GET /api/atendimentos/{id}` → `usuario`)

## URL

`http://IP_DO_SERVIDOR:8083/`

## Configuração

1. No admin NovoSGA → API / Clientes, crie:
   - Client ID: `painel`
   - Client Secret: `painelsecret`
2. Edite `config.js` (usuário, senha, `unidadeId`, serviços).
3. No guichê, ao entrar no atendimento, selecione o **número do guichê** antes de chamar.
4. Cadastre o **Nome** e **Sobrenome** do usuário atendente no admin (é o que aparece no painel).

## Observação

O painel oficial (`:8080`) mostra senha e local. Este painel customizado (`:8083`) adiciona o **nome do atendente** de forma explícita.
