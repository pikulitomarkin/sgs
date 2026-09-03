# SGS — Sistema de Gerenciamento de Senhas (NovoSGA)

Pacote de **deploy Docker** para instalação no servidor do cliente (Dell OptiPlex / Debian ou Ubuntu).

Baseado na documentação oficial: [NovoSGA Docker](https://novosga.org/docs/#/2.2/install-docker)

## O que sobe

| Serviço | Imagem | Porta padrão |
|---------|--------|--------------|
| NovoSGA | `novosga/novosga:2.2-standalone` | 80 |
| Painel (TV) | `novosga/panel-app:v2.1.0` | 8080 |
| Triagem oficial | `novosga/triage-app:v2.1.0` | 8081 |
| **Totem customizado** | nginx + `totem/` | **8082** |
| **Painel TV (guichê + atendente)** | nginx + `painel/` | **8083** |
| Mercure | `novosga/mercure:v0.11` | 3000 |
| MySQL 8 | `mysql:8.0` | interno |

## Requisitos

- Docker Engine + Docker Compose plugin
- Linux (Debian/Ubuntu recomendado) ou Windows com Docker Desktop (só para teste)
- Portas livres: 80, 3000, 8080, 8081

## Instalação rápida (servidor do cliente)

```bash
# 1. Clonar
git clone <URL_DESTE_REPO> sgs
cd sgs

# 2. Configurar ambiente
cp .env.example .env
nano .env
# Ajuste MERCURE_PUBLIC_URL para o IP local do servidor, ex:
# MERCURE_PUBLIC_URL=http://192.168.18.54:3000/.well-known/mercure

# 3. Subir
bash scripts/install.sh

# 4. Testar
bash scripts/test.sh
```

## URLs após subir

```text
Admin / Guichê:  http://IP_DO_SERVIDOR/
Painel TV:       http://IP_DO_SERVIDOR:8080/
Triagem oficial: http://IP_DO_SERVIDOR:8081/
Totem (botões):  http://IP_DO_SERVIDOR:8082/
Painel TV:       http://IP_DO_SERVIDOR:8083/   ← senha + guichê + atendente
Mercure:         http://IP_DO_SERVIDOR:3000/.well-known/mercure
```

### Totem Normal / Preferencial

Abra `http://IP:8082/` no tablet. Configure OAuth e IDs em `totem/config.js` (ver `INSTALACAO.md`).

### Painel na TV (guichê + nome do atendente)

Abra `http://IP:8083/` na Smart TV. Configure OAuth em `painel/config.js`.

Login padrão (trocar depois): `admin` / `123456`

## Comandos úteis

```bash
docker compose ps
docker compose logs -f novosga
docker compose restart
docker compose down
docker compose pull && docker compose up -d
```

## Hardware do cliente

- Servidor: Dell OptiPlex (Debian) — IP típico `192.168.18.54`
- Impressora: Bematech MP-4200 TH (USB/Ethernet, porta 9100)
- Painel: Smart TV TCL (browser em `:8080`)
- Totem: tablet/navegador em `:8081`
- Guichês: PCs com browser em `/`

## Estrutura

```text
sgs/
├── docker-compose.yml
├── .env.example
├── mysql/init.sql
├── scripts/
│   ├── install.sh
│   ├── test.sh
│   ├── setup-printing.sh
│   └── setup-autostart.sh
├── INSTALACAO.md
└── contexto.md
```

## Segurança

- Nunca commitar `.env` com senhas reais
- Trocar `NOVOSGA_ADMIN_PASSWORD`, senhas do MySQL e `MERCURE_JWT_SECRET` em produção
- Preferir acesso só na rede local; liberar portas externas só se necessário

## Licença

NovoSGA é MIT. Este pacote de deploy é de uso interno do projeto SGS / Vintage DevStack.
