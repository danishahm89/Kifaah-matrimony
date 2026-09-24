#!/bin/bash
set -e
cd /opt/kifaah-matrimony
echo "[deploy] Pulling latest from main..."
git pull origin main
echo "[deploy] Building backend image..."
docker compose build backend
echo "[deploy] Running DB migrations..."
docker compose run --rm --no-deps backend npx prisma migrate deploy
echo "[deploy] Restarting backend..."
docker compose up -d --no-deps --force-recreate backend
echo "[deploy] Done! Checking health..."
sleep 3
curl -sf https://kifaah-api.srv1164487.hstgr.cloud/health && echo " API healthy"
