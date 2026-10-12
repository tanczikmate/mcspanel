@echo off
setlocal enabledelayedexpansion
title MCSPanel [TESZT KORNYEZET]
color 0E
chcp 65001 >nul

cd /d "%~dp0"

echo ========================================================
echo        MCSPanel - TESZT KÖRNYEZET INDÍTÁSA
echo ========================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if !errorlevel! neq 0 (
    echo [HIBA] A Node.js nem található a gépeden!
    echo Kérlek telepítsd a legfrissebb Node.js-t innen: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 2. Ensure config.test.json exists
if not exist "config.test.json" (
    echo [INFO] config.test.json létrehozása teszt beállításokkal (port: 24566, mappa: data-test)...
    node -e "const fs = require('fs'); const cfg = { $schema: './config.schema.json', port: 24566, host: '0.0.0.0', dataDir: 'data-test', openBrowserOnStart: true, environment: 'test' }; fs.writeFileSync('config.test.json', JSON.stringify(cfg, null, 2) + '\n');"
    echo.
)

set CONFIG_PATH=config.test.json

:: 3. Read test configuration
set PORT=
set OPEN_BROWSER=
for /f "tokens=1,2" %%a in ('node -e "try { const c = JSON.parse(require('fs').readFileSync('./config.test.json','utf8')); console.log((c.port || 24566) + ' ' + (c.openBrowserOnStart !== false ? '1' : '0')); } catch { console.log('24566 1'); }"' ) do (
    set PORT=%%a
    set OPEN_BROWSER=%%b
)
if "!PORT!"=="" set PORT=24566
if "!OPEN_BROWSER!"=="" set OPEN_BROWSER=1

echo [OK] MCSPanel Teszt környezet indítása...
echo [INFO] Teszt felület elérhető: http://localhost:!PORT!
echo [INFO] Teszt adatbázis mappa: data-test
echo.

:: 4. Open browser if enabled
if "!OPEN_BROWSER!"=="1" (
    start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:!PORT!"
)

:: 5. Start backend with test config
node server/dist/index.js

pause
