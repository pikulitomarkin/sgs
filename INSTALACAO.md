# Instalação no servidor do cliente

## 1. Pré-requisitos no Debian/Ubuntu

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates
# Docker (se ainda não tiver):
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

## 2. Clonar e subir

```bash
cd /opt
sudo git clone <URL_DO_REPO> sgs
cd sgs
sudo cp .env.example .env
sudo nano .env
```

Ajuste obrigatório:

```env
MERCURE_PUBLIC_URL=http://192.168.18.176:3000/.well-known/mercure
NOVOSGA_ADMIN_PASSWORD=<senha-forte>
DB_PASSWORD=<senha-forte>
DB_ROOT_PASSWORD=<senha-forte>
MERCURE_JWT_SECRET=<troque-esta-chave>
```

```bash
sudo bash scripts/install.sh
sudo bash scripts/test.sh
```

## 3. Autostart (queda de energia)

```bash
sudo bash scripts/setup-autostart.sh
```

No BIOS do Dell: **After Power Loss → Power On**.

## 4. Impressora Bematech

Descobrir IP (porta 9100) e:

```bash
# no .env
PRINTER_IP=192.168.18.XX

sudo bash scripts/setup-printing.sh
```

Totem: Chrome com `--kiosk --kiosk-printing`.

## 5. Configuração no sistema

1. Login em `http://IP/` → admin
2. Ativar serviços na unidade
3. Abrir painel `http://IP:8080/` e apontar para `http://IP/`
4. Abrir triagem `http://IP:8081/` e configurar API/cliente OAuth no admin
5. **Não use** botões customizados que chamam `emitirTabletNormal` — use a triagem oficial

## 6. Checklist de aceite

- [ ] Emitir senha na triagem oficial
- [ ] Impressão física
- [ ] Chamar no guichê
- [ ] Aparecer na TV sem F5
- [ ] Reiniciar servidor e stack volta sozinha
