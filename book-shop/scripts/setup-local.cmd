@echo off
REM ============================================================
REM  Book Shop - local setup launcher for Windows
REM  ASCII-only on purpose. Thai docs are in README.md
REM  Double-click this file, or run: scripts\setup-local.cmd
REM ============================================================
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0.."

echo.
echo === Book Shop local setup ===
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-local.ps1"
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% NEQ 0 (
  echo Setup finished with errors. Exit code: %EXITCODE%
) else (
  echo Done.
)
echo.
echo Press Enter to close this window.
pause >nul
endlocal
