@echo off
setlocal

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to serve the website locally.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

start "" /b node "%~dp0serve-local.js" "%~dp0dist"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/"
echo Keep this window open while using KUMPAS.
pause
