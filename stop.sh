#!/usr/bin/env bash

# MCSPanel - Process Stopper for Linux & macOS

cd "$(dirname "$0")"

TARGET_PORT=24565

echo "========================================================"
echo "       MCSPanel - Folyamat Leallitasa"
echo "========================================================"
echo ""

PID=$(lsof -ti :$TARGET_PORT -sTCP:LISTEN 2>/dev/null || fuser $TARGET_PORT/tcp 2>/dev/null || true)

if [ -z "$PID" ]; then
    echo "[INFO] Az MCSPanel nem fut a(z) $TARGET_PORT-os porton."
else
    echo "[INFO] Futó MCSPanel folyamat azonosítva (PID: $PID). Leállítás..."
    kill -TERM $PID 2>/dev/null || kill -9 $PID 2>/dev/null || true
    echo "[OK] Az MCSPanel leállítva."
fi
