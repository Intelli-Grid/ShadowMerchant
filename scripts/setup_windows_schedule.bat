@echo off
:: =============================================================================
:: ShadowMerchant — Windows Task Scheduler Setup (FIXED VERSION)
:: =============================================================================
:: Registers 2 daily pipeline runs at 07:00 and 21:00 IST.
:: Uses PowerShell Register-ScheduledTask (no admin needed).
:: Includes: WakeToRun + StartWhenAvailable (catches missed runs after sleep).
::
:: Run this ONCE. Tasks persist across reboots.
::
:: To verify tasks:
::   Open Task Scheduler → Look for ShadowMerchant_Morning / ShadowMerchant_Evening
::
:: To remove tasks:
::   Unregister-ScheduledTask -TaskName "ShadowMerchant_Morning" -Confirm:$false
::   Unregister-ScheduledTask -TaskName "ShadowMerchant_Evening" -Confirm:$false
::
:: To run manually right now:
::   Double-click run_local.bat
:: =============================================================================
title ShadowMerchant -- Task Scheduler Setup

set SCRIPT_DIR=%~dp0
set BAT_PATH=%SCRIPT_DIR%auto_run.bat

echo.
echo  ============================================
echo   ShadowMerchant -- Auto-Schedule Setup
echo  ============================================
echo.
echo  Registering TWO daily pipeline runs:
echo    Morning : 07:00 IST daily
echo    Evening : 21:00 IST daily
echo.
echo  Entry point: %BAT_PATH%
echo  Log file:    %SCRIPT_DIR%pipeline_auto.log
echo.

:: Use PowerShell to register — no admin required, no /tr length limit
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$action = New-ScheduledTaskAction -Execute '%BAT_PATH%';" ^
  "$t1 = New-ScheduledTaskTrigger -Daily -At '07:00AM';" ^
  "$t2 = New-ScheduledTaskTrigger -Daily -At '09:00PM';" ^
  "$s = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 45) -MultipleInstances IgnoreNew;" ^
  "Register-ScheduledTask -TaskName 'ShadowMerchant_Morning' -Action $action -Trigger $t1 -Settings $s -Force | Out-Null;" ^
  "Register-ScheduledTask -TaskName 'ShadowMerchant_Evening' -Action $action -Trigger $t2 -Settings $s -Force | Out-Null;" ^
  "Write-Host '[OK] Tasks registered successfully.'"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Task registration failed.
    echo Try running PowerShell manually:
    echo   $action = New-ScheduledTaskAction -Execute '%BAT_PATH%'
    echo   ...
    pause
    exit /b 1
)

echo.
echo  ============================================
echo   Setup complete! Tasks are ACTIVE.
echo  ============================================
echo.
powershell -NoProfile -Command ^
  "Get-ScheduledTask -TaskName 'ShadowMerchant_Morning','ShadowMerchant_Evening' | Select-Object TaskName,State | Format-Table -AutoSize"
echo.
echo  Next steps:
echo    - Keep PC plugged in at 07:00 and 21:00 IST
echo    - Task Scheduler will wake PC from sleep automatically
echo    - Check logs at: %SCRIPT_DIR%pipeline_auto.log
echo    - Check Telegram admin channel for pipeline reports
echo.
pause
