@echo off
setlocal enabledelayedexpansion
title MCSPanel - Leallitas
chcp 65001 >nul
color 0F

cd /d "%~dp0"

echo ========================================================
echo        MCSPanel - Folyamat Leallitasa
echo ========================================================
echo.

set TARGET_PORT=
if not "%~1"=="" (
    set TARGET_PORT=%~1
) else (
    for /f "tokens=1" %%a in ('node -e "try { const c = JSON.parse(require('fs').readFileSync('./config.json','utf8')); console.log(c.port || 24565); } catch { console.log('24565'); }"' ) do (
        set TARGET_PORT=%%a
    )
)
if "!TARGET_PORT!"=="" set TARGET_PORT=24565

set PID=

for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":!TARGET_PORT! *[^ ]* *LISTENING"') do (
    set PID=%%a
)

if "!PID!"=="" (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":!TARGET_PORT!" ^| findstr /i "LISTENING"') do (
        set PID=%%a
    )
)

if "!PID!"=="" (
    echo [INFO] Az MCSPanel nem fut a !TARGET_PORT!-os porton.
    echo.
) else (
    echo [INFO] Futó MCSPanel folyamat azonosítva a !TARGET_PORT!-os porton - PID: !PID!.
    echo [INFO] Leállítás folyamatban...
    taskkill /f /t /pid !PID! >nul 2>&1
    if !errorlevel! equ 0 (
        echo [OK] Az MCSPanel és kapcsolódó folyamatai sikeresen leállítva.
    ) else (
        echo [HIBA] Nem sikerült leállítani a folyamatot - PID: !PID!.
    )
    echo.
)

pause
