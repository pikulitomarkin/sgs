#!/usr/bin/env bash
# Autostart da stack no boot + watchdog simples
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_DIR="${INSTALL_DIR:-/opt/sgs}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root"
  exit 1
fi

mkdir -p "$INSTALL_DIR"
rsync -a --exclude '.git' "$ROOT_DIR/" "$INSTALL_DIR/" 2>/dev/null || cp -a "$ROOT_DIR/." "$INSTALL_DIR/"

cat > /etc/systemd/system/sgs-novosga.service <<EOF
[Unit]
Description=SGS NovoSGA Docker Stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sgs-novosga.service
systemctl start sgs-novosga.service

cat > /usr/local/bin/sgs-watchdog.sh <<'EOF'
#!/usr/bin/env bash
cd /opt/sgs
docker compose up -d >/dev/null 2>&1 || true
EOF
chmod +x /usr/local/bin/sgs-watchdog.sh
(crontab -l 2>/dev/null | grep -v sgs-watchdog; echo "*/5 * * * * /usr/local/bin/sgs-watchdog.sh") | crontab -

echo "Autostart habilitado. Lembre BIOS: After Power Loss = Power On"
