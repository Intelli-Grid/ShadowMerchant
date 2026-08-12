@echo off
:: ShadowMerchant — Growth Orchestrator Task Scheduler Setup
:: Run this ONCE as Administrator to register the daily growth job.
:: Right-click this file -> Run as administrator

echo === ShadowMerchant Growth Orchestrator Setup ===
echo.

:: Detect Python path
for /f "delims=" %%i in ('where python') do set PYTHON_PATH=%%i
if not defined PYTHON_PATH (
    echo ERROR: Python not found in PATH.
    echo Install Python from python.org and re-run this script.
    pause
    exit /b 1
)
echo Python found: %PYTHON_PATH%

:: Set project root
set PROJECT_ROOT=%~dp0..\..
set SCRIPT=%PROJECT_ROOT%\scripts\growth\growth_orchestrator.py
set LOG=%PROJECT_ROOT%\scripts\growth\orchestrator.log

echo Project root: %PROJECT_ROOT%
echo Script: %SCRIPT%
echo.

:: Delete existing task if it exists
schtasks /delete /tn "ShadowMerchant_GrowthOrchestrator" /f >nul 2>&1

:: Create daily task at 8:30 AM
schtasks /create ^
  /tn "ShadowMerchant_GrowthOrchestrator" ^
  /tr "\"%PYTHON_PATH%\" \"%SCRIPT%\" --all >> \"%LOG%\" 2>&1" ^
  /sc DAILY ^
  /st 08:30 ^
  /ru "%USERNAME%" ^
  /rl HIGHEST ^
  /f

if %errorlevel% == 0 (
    echo.
    echo SUCCESS: Growth orchestrator scheduled for 8:30 AM daily.
    echo Log file: %LOG%
    echo.
    echo To run manually right now:
    echo   python "%SCRIPT%" --all
    echo.
    echo To test without sending:
    echo   python "%SCRIPT%" --test
    echo.
    echo To check scheduler status:
    echo   schtasks /query /tn "ShadowMerchant_GrowthOrchestrator"
) else (
    echo.
    echo ERROR: Failed to create scheduled task.
    echo Make sure you are running this script as Administrator.
)

pause
