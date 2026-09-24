@echo off
title FITBOUND
rem Double-click to start FITBOUND Connected Play on this computer.
rem To get the latest version first: GitHub Desktop, Fetch origin, then Pull.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org and try again.
  pause
  exit /b 1
)

echo.
echo  [1/3] Checking packages (quick if nothing changed)...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 goto failed

echo.
echo  [2/3] Building the game...
call npm run build --silent
if errorlevel 1 goto failed

echo.
echo  [3/3] Starting. The game opens in your browser in a few seconds.
echo        Keep this window open while you play. Close it (or press Ctrl+C) to stop.
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start "" http://localhost:8080"
call npm run relay --silent
pause
exit /b 0

:failed
echo.
echo Something went wrong (see the messages above). Screenshot this window if you need help.
pause
exit /b 1
