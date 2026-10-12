#!/usr/bin/env bash

# MCSPanel - Process Stopper for Linux & macOS

cd "$(dirname "$0")"

TARGET_PORT=${1:-$(node -e "try { const c = JSON.parse(require('fs').readFileSync('./config.json','utf8')); console.log(c.port || 24565); } catch { console.log('24565'); }" 2>/dev/null || echo "24565")}

echo "========================================================"
echo "       MCSPanel - Folyamat Leallitasa"
echo "========================================================"
echo ""

PID=$(lsof -ti :$TARGET_PORT -sTCP:LISTEN 2>/dev/null || fuser $TARGET_PORT/tcp 2>/dev/null || true)

if [ -z "$PID" ]; then
    echo "[INFO] Az MCSPanel nem fut a(z) $TARGET_PORT-os porton."
else
    echo "[INFO] Futó MCSPanel folyamat azonosítva a(z) $TARGET_PORT-os porton (PID: $PID). Leállítás..."
    kill -TERM $PID 2>/dev/null || kill -9 $PID 2>/dev/null || true
    echo "[OK] Az MCSPanel leállítva."
fi
