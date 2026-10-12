@echo off
setlocal enabledelayedexpansion
title MCSPanel - Minecraft Server Platform
color 0F
chcp 65001 >nul

cd /d "%~dp0"

echo ========================================================
echo        MCSPanel - Minecraft Server Platform
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

:: 2. Check if dependencies are installed
if not exist "node_modules\" (
    echo [INFO] Függőségek nincsenek telepítve, npm install futtatása...
    echo.
    call npm install
    if !errorlevel! neq 0 (
        echo [HIBA] A függőségek telepítése sikertelen volt!
        pause
        exit /b 1
    )
    echo [OK] Függőségek sikeresen telepítve.
    echo.
)

:: 3. Check if build outputs exist, if not, build project
if not exist "web\dist\index.html" (
    echo [INFO] Első indítás észlelve, projekt lefordítása folyamatban...
    echo.
    call npm run build
    if !errorlevel! neq 0 (
        echo [HIBA] A fordítás sikertelen volt!
        pause
        exit /b 1
    )
    echo [OK] Projekt sikeresen felépítve.
    echo.
)

if not exist "server\dist\index.js" (
    echo [INFO] Szerver fordítása folyamatban...
    call npm --workspace=server run build
    if !errorlevel! neq 0 (
        echo [HIBA] A szerver fordítása sikertelen volt!
        pause
        exit /b 1
    )
)

:: 4. Ensure config.json exists from template
if not exist "config.json" (
    if exist "config.example.json" (
        copy /y "config.example.json" "config.json" >nul 2>&1
    )
)

:: 5. Read configuration (port, openBrowserOnStart)
set PORT=
set OPEN_BROWSER=
for /f "tokens=1,2" %%a in ('node -e "try { const c = JSON.parse(require('fs').readFileSync('./config.json','utf8')); console.log((c.port || 24565) + ' ' + (c.openBrowserOnStart !== false ? '1' : '0')); } catch { console.log('24565 1'); }"' ) do (
    set PORT=%%a
    set OPEN_BROWSER=%%b
)
if "!PORT!"=="" set PORT=24565
if "!OPEN_BROWSER!"=="" set OPEN_BROWSER=1

echo [OK] MCSPanel indítása...
echo [INFO] A weboldal elérhető: http://localhost:!PORT!
echo.

:: 6. Open browser after short delay in background if enabled
if "!OPEN_BROWSER!"=="1" (
    start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:!PORT!"
)

:: 7. Start MCSPanel backend
node server/dist/index.js

pause
