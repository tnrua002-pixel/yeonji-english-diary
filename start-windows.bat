@echo off
rem Yeonji's English Diary - local start script (double-click to run)
cd /d "%~dp0"
set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
  ) else (
    echo Node.js is not installed. Please install the LTS version from https://nodejs.org
    pause
    exit /b 1
  )
)
start "" "http://localhost:3000"
"%NODE_EXE%" server.js
pause
