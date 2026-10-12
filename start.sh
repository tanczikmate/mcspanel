#!/usr/bin/env bash

# MCSPanel - Modern Minecraft Server Platform
# Cross-platform Launcher for Linux & macOS

set -e

cd "$(dirname "$0")"

echo "========================================================"
echo "       MCSPanel - Minecraft Server Platform"
echo "========================================================"
echo ""

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo "[HIBA] A Node.js nem található a rendszeren!"
    echo "Kérlek telepítsd a legfrissebb Node.js-t (pl. curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs)"
    exit 1
fi

# 2. Check build outputs
if [ ! -f "web/dist/index.html" ]; then
    echo "[INFO] Első indítás: frontend felépítése..."
    npm run build
fi

if [ ! -f "server/dist/index.js" ]; then
    echo "[INFO] Szerver felépítése..."
    npm --workspace=server run build
fi

echo "[OK] MCSPanel indítása..."
echo "[INFO] Webes felület elérhető: http://localhost:24565"
echo ""

# 3. Open browser
if command -v xdg-open &> /dev/null; then
    (sleep 2 && xdg-open http://localhost:24565) &
elif command -v open &> /dev/null; then
    (sleep 2 && open http://localhost:24565) &
fi

# 4. Start backend
node server/dist/index.js
