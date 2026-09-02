#!/usr/bin/env bash
# CUPS + Bematech MP-4200 (USB ou Ethernet)
set -euo pipefail

PRINTER_NAME="${PRINTER_NAME:-Bematech-MP4200}"
PRINTER_IP="${PRINTER_IP:-}"
PRINTER_PORT="${PRINTER_PORT:-9100}"

if [ -f "$(cd "$(dirname "$0")/.." && pwd)/.env" ]; then
  # shellcheck disable=SC1091
  set -a
  source "$(cd "$(dirname "$0")/.." && pwd)/.env"
  set +a
fi

echo "Instalando CUPS..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y cups cups-client

systemctl enable cups
systemctl start cups
usermod -aG lpadmin "${SUDO_USER:-root}" 2>/dev/null || true

if [ -n "${PRINTER_IP}" ]; then
  echo "Configurando impressora Ethernet ${PRINTER_IP}:${PRINTER_PORT}"
  lpadmin -x "$PRINTER_NAME" 2>/dev/null || true
  lpadmin -p "$PRINTER_NAME" -E -v "socket://${PRINTER_IP}:${PRINTER_PORT}" -m raw
  lpoptions -d "$PRINTER_NAME"
  echo "Teste: echo 'SGS teste' | lp -d $PRINTER_NAME"
else
  echo "PRINTER_IP vazio. Liste dispositivos:"
  lpinfo -v || true
  lsusb || true
  echo "Exemplo USB: lpadmin -p $PRINTER_NAME -E -v usb://Bematech/MP-4200 -m raw"
fi
