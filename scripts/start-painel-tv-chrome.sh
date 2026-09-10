#!/usr/bin/env bash
# Abre o painel TV no Chrome com áudio automático liberado (Linux)
URL="${1:-http://192.168.18.54:8083/?v=10}"
CHROME=$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)
if [ -z "$CHROME" ]; then
  echo "Chrome/Chromium não encontrado"
  exit 1
fi
exec "$CHROME" \
  --kiosk \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=PreloadMediaEngagementData,AutoplayIgnoreWebAudio,MediaEngagementBypassAutoplayPolicies \
  --check-for-update-interval=31536000 \
  --noerrdialogs \
  --disable-session-crashed-bubble \
  "$URL"
