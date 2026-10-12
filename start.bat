@echo off
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
if %errorlevel% neq 0 (
    echo [HIBA] A Node.js nem található a gépeden!
    echo Kérlek telepítsd a legfrissebb Node.js-t innen: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 2. Check if build outputs exist, if not, build project
if not exist "web\dist\index.html" (
    echo [INFO] Első indítás észlelve, projekt lefordítása folyamatban...
    echo.
    call npm run build
    if %errorlevel% neq 0 (
        echo [HIBA] A fordítás sikertelen volt!
        pause
        exit /b 1
    )
    echo.
)

if not exist "server\dist\index.js" (
    echo [INFO] Szerver fordítása folyamatban...
    call npm --workspace=server run build
    if %errorlevel% neq 0 (
        echo [HIBA] A szerver fordítása sikertelen volt!
        pause
        exit /b 1
    )
)

echo [OK] MCSPanel indítása...
echo [INFO] A weboldal elérhető: http://localhost:24565
echo.

:: 3. Open browser after short delay in background
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:24565"

:: 4. Start MCSPanel backend
node server/dist/index.js

pause
