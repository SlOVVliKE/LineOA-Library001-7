@echo off
REM ============================================================
REM  Check, then push to GitHub. Cloudflare builds and deploys.
REM  Repo: https://github.com/SlOVVliKE/LineOA-Library001-7.git
REM
REM  WHY THERE IS NO DEPLOY STEP HERE ANYMORE
REM  Deploying from this machine is impossible: Device Guard /
REM  WDAC policy blocks workerd.exe, which opennextjs-cloudflare
REM  deploy has to launch. See "ตั้งค่า-Workers-Builds.md".
REM  Cloudflare Workers Builds now builds and deploys from GitHub
REM  instead, on their Linux builders.
REM
REM  So: the live site updates a few minutes AFTER this finishes,
REM  not the moment it finishes. Watch the build at
REM  Workers - libraryforu - Deployments - View build history.
REM
REM  ASCII-only on purpose (Windows console encoding).
REM  Double-click this file, or pass a commit message:
REM      deploy-check-and-push.cmd "fix daily stock net total"
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
echo   Step 2 of 3 : build for Cloudflare
echo ============================================
REM  This runs "next build" AND bundles the Worker, so it checks the
REM  exact artifact Cloudflare will produce - not just Next.js output.
REM  Cloudflare builds again on its own machine; this run is purely a
REM  local check so a broken build never reaches GitHub.
REM
REM  This step does NOT need workerd, which is why it still works here
REM  even though deploying does not.
call npx.cmd opennextjs-cloudflare build
if errorlevel 1 (
  echo.
  echo FAILED: the build broke. Nothing was pushed.
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
REM  .dev.vars is on this list because it holds Worker environment
REM  values when testing locally. It leaked real Supabase keys once
REM  already. It must never reach GitHub.
git diff --cached --name-only > "%TEMP%\bs_staged.txt"
findstr /I /C:".env.local" /C:".dev.vars" /C:"supabase/.temp" /C:"supabase\\.temp" "%TEMP%\bs_staged.txt" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo STOPPED: a secret file is staged. Nothing was pushed.
  findstr /I /C:".env.local" /C:".dev.vars" /C:"supabase/.temp" "%TEMP%\bs_staged.txt"
  del "%TEMP%\bs_staged.txt" >nul 2>&1
  goto :done
)
del "%TEMP%\bs_staged.txt" >nul 2>&1
echo     No secrets staged - OK

REM ---------- commit message ----------
REM  Pass one as an argument to describe what changed. Without an
REM  argument every commit gets the same generic text and the git
REM  history stops being useful for finding when a change happened.
set "MSG=%~1"
if "%MSG%"=="" set "MSG=update book-shop"

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%MSG%"
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
  goto :done
)
echo     Pushed - OK

echo.
echo ============================================
echo   Done - Cloudflare is building now
echo ============================================
echo   The live site is NOT updated yet. Cloudflare picks up the
echo   commit and builds it, which takes about 2-3 minutes.
echo.
echo   Watch the build:
echo     Workers - libraryforu - Deployments - View build history
echo.
echo   Then check for problems:
echo     Workers - libraryforu - Metrics - Errors
echo     Watch for "exceededCpu".
echo.
echo   https://libraryforu.thirakan-weef64.workers.dev
echo   https://github.com/SlOVVliKE/LineOA-Library001-7

:done
echo.
echo Press Enter to close.
pause >nul
endlocal
