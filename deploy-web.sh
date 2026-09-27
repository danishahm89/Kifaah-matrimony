#!/bin/bash
# Rebuild and publish the web app (the backend has its own deploy.sh).
# Usage on the VPS:  cd /opt/kifaah-matrimony && bash deploy-web.sh
set -e
cd /opt/kifaah-matrimony
echo "[web] Pulling latest from main..."
git pull --rebase origin main
cd mobile
echo "[web] Installing packages..."
npm install --no-audit --no-fund
echo "[web] Building..."
EXPO_PUBLIC_API_URL=https://kifaah-api.srv1164487.hstgr.cloud \
EXPO_PUBLIC_SUPPORT_EMAIL="${SUPPORT_EMAIL:-alzakwaantours@gmail.com}" \
EXPO_PUBLIC_SUPPORT_WHATSAPP="${SUPPORT_WHATSAPP:-919990543267}" \
  npx expo export -p web --output-dir dist
cd ..
echo "[web] Restarting web container..."
docker compose restart web
echo "[web] Done."
