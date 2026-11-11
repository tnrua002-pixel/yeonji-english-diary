@echo off
rem Yeonji's English Diary - local start script (double-click to run)
cd /d "%~dp0"
set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if exist "%PY_EXE%" goto run
where py >nul 2>nul
if errorlevel 1 (
  echo Python is not installed. Please install Python 3 from https://www.python.org
  pause
  exit /b 1
)
set "PY_EXE=py"
:run
start "" "http://localhost:3000"
"%PY_EXE%" app.py
pause
