# SGS — contexto do projeto

## Identidade

| Campo | Valor |
|-------|-------|
| Nome | SGS — Gerenciamento de Senhas (NovoSGA) |
| Tipo | Pacote de deploy Docker para cliente |
| Stack | NovoSGA 2.2-standalone + MySQL 8 + Mercure + panel-app + triage-app |
| Servidor cliente | Dell OptiPlex `sgs` — `192.168.18.54` (Debian) |
| Timezone | America/Sao_Paulo |

## Status (Prompt 0)

| Área | Status |
|------|--------|
| docker-compose oficial adaptado | ✅ |
| Painel + Triagem containers | ✅ |
| Scripts install/test/print/autostart | ✅ |
| Repo git + remote | ⚠️ em andamento |
| Teste local Docker | ⚠️ |
| Instalação validada no Dell | ⚠️ (cliente já tinha instalação; bug `emitirTabletNormal`) |
| Impressora Bematech | ❌ IP/porta a confirmar |
| Port forwarding SSH externo | ❌ |

## Fluxo crítico

1. Totem/triagem emite senha (`POST /api/distribui`)
2. Impressão (browser kiosk ou CUPS/ESC-POS)
3. Guichê chama senha
4. Mercure notifica painel TV em tempo real
5. Atendimento / encerramento no guichê

## Totem customizado

- URL: `:8082/`
- Funções: `emitirTabletNormal` / `emitirTabletPreferencial` (definidas em `totem/app.js`)
- Proxy nginx `/api` → container `novosga` (sem CORS)

## Painel TV customizado

- URL: `:8083/`
- Exibe: senha + guichê (`local`/`numeroLocal`) + nome do atendente (`usuario`)
- Fonte: `GET /api/unidades/{id}/painel` + `GET /api/atendimentos/{id}`

## Bug conhecido (cliente)

- Instalação antiga sem `emitirTabletNormal` → usar este totem em `:8082`.

## Decisões

1. Usar imagem `2.2-standalone` (docs oficiais) em vez de build a partir do source PHP.
2. Painel/Triagem como containers oficiais (sem build Node no servidor do cliente).
3. `MERCURE_PUBLIC_URL` deve ser IP da LAN, nunca `127.0.0.1` em produção.
