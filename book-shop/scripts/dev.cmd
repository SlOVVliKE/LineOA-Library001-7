@echo off
REM Start the dev server (works even when PowerShell blocks .ps1 files)
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0.."
echo Starting dev server...
echo Open http://localhost:3000/admin when it says Ready
echo.
call npm.cmd run dev
endlocal
