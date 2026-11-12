@echo off
setlocal
title YouTube Video Downloader
cd /d "%~dp0"

echo ============================================================
echo   YouTube Video Downloader
echo ============================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org or run:
    echo winget install OpenJS.NodeJS
    echo.
    pause
    exit /b 1
)

echo Starting server...
echo The app will open in your default browser automatically.
echo (Press Ctrl+C in this window to stop the server)
echo.

node server.js
pause
