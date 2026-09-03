# Totem SGS — tela de senha

Tela touch com dois botões:

- **Normal** → `emitirTabletNormal()`
- **Preferencial** → `emitirTabletPreferencial()`

## Arquivos

| Arquivo | Função |
|---------|--------|
| `index.html` | Layout dos botões |
| `styles.css` | Visual (tablet / TV) |
| `config.js` | OAuth, unidade, serviço, prioridades |
| `app.js` | Chamada `POST /api/token` + `POST /api/distribui` |
| `nginx.conf` | Serve estático + proxy `/api` |

## Configuração mínima

1. No admin NovoSGA, cadastre um Cliente API (`totem` / `totemsecret`)
2. Edite `config.js` com usuário, senha e IDs corretos
3. Acesse `http://IP_DO_SERVIDOR:8082/`
