@echo off
title AgriVault - Cold Storage IoT & Environmental Platform
color 0A

echo ============================================================
echo   AGRIvault - Storage Intelligence & Cold Chain Platform
echo ============================================================
echo.
echo [1/3] Checking environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "backend\node_modules\" (
    echo [INFO] Installing backend dependencies...
    cd backend && call npm install && cd ..
)

if not exist "frontend\dist\" (
    echo [INFO] Building frontend production bundle...
    cd frontend
    if not exist "node_modules\" call npm install
    call npm run build
    cd ..
)

echo [2/3] Starting AgriVault Unified Industrial Backend & Embedded MQTT Hub...
echo - REST API: http://localhost:4000/api
echo - Web / Desktop / Mobile PWA: http://localhost:4000
echo - Embedded MQTT Broker: mqtt://localhost:1883
echo - Real-Time Telemetry Stream: ws://localhost:4000/ws
echo.

cd backend
start "AgriVault Service" cmd /k "npx tsx src/index.ts"

echo [3/3] Opening AgriVault Application in Default Browser...
timeout /t 3 /nobreak >nul
start http://localhost:4000

echo.
echo ============================================================
echo   AgriVault is running in 24/7 industrial monitoring mode.
echo   Press Ctrl+C in the server window to stop.
echo ============================================================
pause
