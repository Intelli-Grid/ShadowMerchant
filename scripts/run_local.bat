@echo off
:: =============================================================================
:: ShadowMerchant — One-Click Local Pipeline
:: =============================================================================
:: Double-click to run all scrapers NOW from your local machine.
:: No Render. No ScraperAPI credits. Uses your home residential IP.
:: Results go to the same cloud MongoDB + Telegram report posted automatically.
::
:: Usage:
::   run_local.bat                      Run all scrapers (2-pass, OOM-safe)
::   run_local.bat nykaa                Run Nykaa only
::   run_local.bat nykaa meesho         Run two scrapers
::   run_local.bat amazon               Run Amazon only
:: =============================================================================
title ShadowMerchant -- Running Pipeline...

set VENV_PYTHON=e:\workspace\projects\tier-0-revenue\shadow-merchant\.venv\Scripts\python.exe
set SCRIPTS_DIR=e:\workspace\projects\tier-0-revenue\shadow-merchant\scripts

:: Force UTF-8 so emoji in logs don't crash (Windows cp1252 fix)
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

echo.
echo  ====================================================
echo   ShadowMerchant -- Local Pipeline
echo   %DATE% %TIME%
echo  ====================================================
echo.

if not exist "%VENV_PYTHON%" (
    echo [ERROR] .venv not found. Have you set it up?
    echo.
    echo To fix, open PowerShell and run:
    echo   cd e:\workspace\projects\tier-0-revenue\shadow-merchant
    echo   python -m venv .venv
    echo   .venv\Scripts\pip install -r scripts\requirements.txt
    echo   .venv\Scripts\pip install curl_cffi flask groq algoliasearch
    pause
    exit /b 1
)

cd /d "%SCRIPTS_DIR%"

if "%1"=="" (
    echo  [INFO] Pass 1 -- Light scrapers: Meesho + Myntra + Nykaa
    echo.
    "%VENV_PYTHON%" scheduler.py --run-now --scrapers meesho myntra nykaa
    echo.
    echo  [INFO] Pass 2 -- Amazon (Playwright, fresh RAM)
    echo.
    "%VENV_PYTHON%" scheduler.py --run-now --scrapers amazon
) else (
    echo  [INFO] Running scrapers: %*
    echo.
    "%VENV_PYTHON%" scheduler.py --run-now --scrapers %*
)

echo.
echo  ====================================================
echo   Done! Check Telegram admin channel for report.
echo  ====================================================
echo.
pause

