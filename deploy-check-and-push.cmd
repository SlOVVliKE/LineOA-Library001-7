@echo off
REM ============================================================
REM  Build check, then push to GitHub (Netlify deploys from there)
REM  Repo: https://github.com/SlOVVliKE/LineOA-Library001-7.git
REM
REM  ASCII-only on purpose (Windows console encoding).
REM  Double-click this file.
REM ============================================================
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"

set REPO=https://github.com/SlOVVliKE/LineOA-Library001-7.git

echo.
echo ============================================
echo   Step 1 of 3 : type check
echo ============================================
cd book-shop
call npx.cmd tsc --noEmit
if errorlevel 1 (
  echo.
  echo FAILED: type errors above. Nothing was pushed.
  cd ..
  goto :done
)
echo     OK

echo.
echo ============================================
echo   Step 2 of 3 : production build
echo ============================================
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo FAILED: the build broke. Netlify would fail too, so nothing was pushed.
  cd ..
  goto :done
)
echo.
echo     Build OK
cd ..

echo.
echo ============================================
echo   Step 3 of 3 : push to GitHub
echo ============================================

where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: git not found. Install Git from https://git-scm.com
  goto :done
)

git config user.name  >nul 2>&1 || git config user.name  "SlOVVliKE"
git config user.email >nul 2>&1 || git config user.email "thirakan.weef64@gmail.com"

git add -A

REM ---------- safety check: never publish secrets ----------
git diff --cached --name-only > "%TEMP%\bs_staged.txt"
findstr /I /C:".env.local" /C:"supabase/.temp" /C:"supabase\\.temp" "%TEMP%\bs_staged.txt" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo STOPPED: a secret file is staged. Nothing was pushed.
  findstr /I /C:".env.local" /C:"supabase/.temp" "%TEMP%\bs_staged.txt"
  del "%TEMP%\bs_staged.txt" >nul 2>&1
  goto :done
)
del "%TEMP%\bs_staged.txt" >nul 2>&1
echo     No secrets staged - OK

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "LINE OA integration: webhook with signature check, Flex notifications via outbox, rich menu, Netlify config"
) else (
  echo     Nothing new to commit
)

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
  echo   - Remote is ahead: run  git pull --rebase origin main  then try again
  echo   - No permission on that repository
) else (
  echo.
  echo Done. Netlify will pick up the new commit automatically.
  echo https://github.com/SlOVVliKE/LineOA-Library001-7
)

:done
echo.
echo Press Enter to close.
pause >nul
endlocal
