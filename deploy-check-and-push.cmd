@echo off
REM ============================================================
REM  Check, push to GitHub, then deploy to Cloudflare Workers.
REM  Repo: https://github.com/SlOVVliKE/LineOA-Library001-7.git
REM
REM  IMPORTANT - this changed when the site moved off Netlify.
REM  Netlify used to build and publish automatically on every push.
REM  Cloudflare does NOT. Pushing to GitHub alone changes nothing
REM  that customers can see. The deploy step below is what ships.
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
echo   Step 1 of 4 : type check
echo ============================================
cd book-shop
call npx.cmd tsc --noEmit
if errorlevel 1 (
  echo.
  echo FAILED: type errors above. Nothing was pushed or deployed.
  cd ..
  goto :done
)
echo     OK

echo.
echo ============================================
echo   Step 2 of 4 : build for Cloudflare
echo ============================================
REM  This runs "next build" AND bundles the Worker, so it checks the
REM  exact artifact that gets deployed - not just the Next.js output.
REM  Step 4 then uploads what was built here, so nothing is built twice.
call npx.cmd opennextjs-cloudflare build
if errorlevel 1 (
  echo.
  echo FAILED: the build broke. Nothing was pushed or deployed.
  cd ..
  goto :done
)
echo.
echo     Build OK
cd ..

echo.
echo ============================================
echo   Step 3 of 4 : push to GitHub
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
  echo.
  echo STOPPING: not deploying, because the code on GitHub and the
  echo code about to go live would not match.
  goto :done
)
echo     Pushed - OK

echo.
echo ============================================
echo   Step 4 of 4 : deploy to Cloudflare
echo ============================================
cd book-shop
call npm.cmd run cf:deploy-only
if errorlevel 1 (
  echo.
  echo FAILED to deploy. The code IS on GitHub but the live site was
  echo NOT updated. Fix the error, then run:  npm run cf:deploy
  echo If you are not signed in, run:         npx wrangler login
  cd ..
  goto :done
)
cd ..

echo.
echo ============================================
echo   Done - live site updated
echo ============================================
echo   https://libraryforu.thirakan-weef64.workers.dev
echo   https://github.com/SlOVVliKE/LineOA-Library001-7
echo.
echo   Check it worked:
echo     Cloudflare dashboard - Workers - libraryforu - Metrics
echo     Watch for "exceededCpu" under Errors.

:done
echo.
echo Press Enter to close.
pause >nul
endlocal
