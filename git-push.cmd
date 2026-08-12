@echo off
REM ============================================================
REM  Push this project to GitHub
REM  Repo: https://github.com/SlOVVliKE/LineOA-Library001-7.git
REM
REM  ASCII-only on purpose (Windows console encoding).
REM  Double-click this file, or run it from the project root.
REM ============================================================
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"

set REPO=https://github.com/SlOVVliKE/LineOA-Library001-7.git

echo.
echo === Push to GitHub ===
echo Folder: %CD%
echo Repo  : %REPO%
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: git not found. Install Git from https://git-scm.com
  goto :done
)

REM ---------- identity ----------
git config user.name  >nul 2>&1 || git config user.name  "SlOVVliKE"
git config user.email >nul 2>&1 || git config user.email "thirakan.weef64@gmail.com"

REM ---------- init ----------
if not exist ".git" (
  echo [1/5] Initialising repository...
  git init -b main
) else (
  echo [1/5] Repository already exists
)

echo.
echo [2/5] Staging files...
git add -A

REM ---------- safety check: never publish secrets ----------
echo.
echo [3/5] Checking that no secrets are staged...
git diff --cached --name-only > "%TEMP%\bs_staged.txt"
findstr /I /C:".env.local" /C:"supabase/.temp" /C:"supabase\\.temp" "%TEMP%\bs_staged.txt" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo STOPPED: a secret file is staged. Nothing was pushed.
  echo Files in question:
  findstr /I /C:".env.local" /C:"supabase/.temp" "%TEMP%\bs_staged.txt"
  del "%TEMP%\bs_staged.txt" >nul 2>&1
  goto :done
)
del "%TEMP%\bs_staged.txt" >nul 2>&1
echo     OK - no secrets staged

echo.
echo [4/5] Creating commit...
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Book shop + LINE OA: FIFO stock costing, RBAC, storefront, pre-orders, profit reports"
) else (
  echo     Nothing new to commit
)

echo.
echo [5/5] Pushing to GitHub...
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin %REPO%
) else (
  git remote set-url origin %REPO%
)

git branch -M main
git push -u origin main
if errorlevel 1 (
  echo.
  echo Push failed. Common causes:
  echo   - Sign-in window did not appear or was cancelled
  echo   - The repo already has commits: run  git pull --rebase origin main  then push again
  echo   - No permission on that repository
) else (
  echo.
  echo Done. Open: https://github.com/SlOVVliKE/LineOA-Library001-7
)

:done
echo.
echo Press Enter to close.
pause >nul
endlocal
