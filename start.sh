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

# 2. Check dependencies
if [ ! -d "node_modules" ]; then
    echo "[INFO] Függőségek nincsenek telepítve, npm install futtatása..."
    npm install
fi

# 3. Check build outputs
if [ ! -f "web/dist/index.html" ]; then
    echo "[INFO] Első indítás: frontend felépítése..."
    npm run build
fi

if [ ! -f "server/dist/index.js" ]; then
    echo "[INFO] Szerver felépítése..."
    npm --workspace=server run build
fi

# 4. Ensure config.json exists
if [ ! -f "config.json" ] && [ -f "config.example.json" ]; then
    cp "config.example.json" "config.json"
fi

# 5. Read configuration
PORT=$(node -e "try { const c = JSON.parse(require('fs').readFileSync('./config.json','utf8')); console.log(c.port || 24565); } catch { console.log('24565'); }" 2>/dev/null || echo "24565")
OPEN_BROWSER=$(node -e "try { const c = JSON.parse(require('fs').readFileSync('./config.json','utf8')); console.log(c.openBrowserOnStart !== false ? '1' : '0'); } catch { console.log('1'); }" 2>/dev/null || echo "1")

echo "[OK] MCSPanel indítása..."
echo "[INFO] Webes felület elérhető: http://localhost:$PORT"
echo ""

# 6. Open browser if enabled
if [ "$OPEN_BROWSER" = "1" ]; then
    if command -v xdg-open &> /dev/null; then
        (sleep 2 && xdg-open "http://localhost:$PORT") &
    elif command -v open &> /dev/null; then
        (sleep 2 && open "http://localhost:$PORT") &
    fi
fi

# 7. Start backend
node server/dist/index.js
