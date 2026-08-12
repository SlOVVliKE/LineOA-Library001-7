@echo off
REM Re-apply all migrations and reload sample data
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0.."
echo.
echo === Resetting local database ===
echo.
call npx.cmd --yes supabase db reset
echo.
echo Done. Press Enter to close.
pause >nul
endlocal
