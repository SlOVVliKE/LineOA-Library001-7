@echo off
REM Install new dependencies and re-apply the database
REM Run this after pulling changes that add packages or migrations
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0.."
echo.
echo === [1/2] Installing dependencies ===
call npm.cmd install --no-audit --no-fund
echo.
echo === [2/2] Resetting database ===
call npx.cmd --yes supabase db reset
echo.
echo Done. Restart the dev server (scripts\dev.cmd).
echo Press Enter to close.
pause >nul
endlocal
