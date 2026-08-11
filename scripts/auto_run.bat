@echo off
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
set VENV_PY=e:\workspace\projects\tier-0-revenue\shadow-merchant\.venv\Scripts\python.exe
set SCHED_PY=e:\workspace\projects\tier-0-revenue\shadow-merchant\scripts\scheduler.py
set LOG=e:\workspace\projects\tier-0-revenue\shadow-merchant\scripts\pipeline_auto.log
echo. >> "%LOG%"
echo =============================== >> "%LOG%"
echo [%DATE% %TIME%] AUTO-RUN STARTED >> "%LOG%"
echo =============================== >> "%LOG%"

echo [%DATE% %TIME%] Pass 1: Light scrapers (meesho + myntra + nykaa) >> "%LOG%"
"%VENV_PY%" "%SCHED_PY%" --run-now --scrapers meesho myntra nykaa >> "%LOG%" 2>&1

echo [%DATE% %TIME%] Pass 2: Amazon (Playwright - separate process for clean RAM) >> "%LOG%"
"%VENV_PY%" "%SCHED_PY%" --run-now --scrapers amazon >> "%LOG%" 2>&1

echo [%DATE% %TIME%] AUTO-RUN FINISHED >> "%LOG%"

