@echo off
setlocal enabledelayedexpansion
title MCSPanel [TESZT KORNYEZET LEALLITAS]
chcp 65001 >nul
color 0E

cd /d "%~dp0"

echo ========================================================
echo        MCSPanel - TESZT KÖRNYEZET LEÁLLÍTÁSA
echo ========================================================
echo.

set TARGET_PORT=
for /f "tokens=1" %%a in ('node -e "try { const c = JSON.parse(require('fs').readFileSync('./config.test.json','utf8')); console.log(c.port || 24566); } catch { console.log('24566'); }"' ) do (
    set TARGET_PORT=%%a
)
if "!TARGET_PORT!"=="" set TARGET_PORT=24566

call "%~dp0stop.bat" !TARGET_PORT!
