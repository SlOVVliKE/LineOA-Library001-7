@echo off
REM ============================================================
REM  Apply pending database migrations to Supabase Cloud
REM
REM  Double-click this file. It changes into book-shop first,
REM  which is where the Supabase project link lives. Running
REM  "supabase db push" from the repo root fails with
REM  "Cannot find project ref".
REM
REM  ASCII-only on purpose (Windows console encoding).
REM ============================================================
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0book-shop"

echo.
echo ============================================
echo   Pushing migrations to Supabase Cloud
echo   Folder: %CD%
echo ============================================
echo.

if not exist "supabase\config.toml" (
  echo ERROR: supabase\config.toml not found.
  echo This script must sit next to the book-shop folder.
  goto :done
)

call npx.cmd supabase db push
if errorlevel 1 (
  echo.
  echo Push failed. Common causes:
  echo   - Not linked yet: run  npx supabase link --project-ref ^<ref^>
  echo   - Not logged in:  run  npx supabase login
  echo   - A migration has a SQL error, read the message above
) else (
  echo.
  echo Done. Now run deploy-check-and-push.cmd to ship the code.
)

:done
echo.
echo Press Enter to close.
pause >nul
endlocal
