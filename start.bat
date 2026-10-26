
@echo off
setlocal
title NexusMind - Start All Services

cd /d "%~dp0"

echo ==========================================
echo       NexusMind Startup
echo ==========================================
echo.

REM Check Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Start Redis
echo [1/6] Starting Redis...
docker compose -f "%~dp0Backend\docker-compose.yml" up -d redis
if errorlevel 1 (
    echo ERROR: Redis failed to start.
    pause
    exit /b 1
)

REM Start Auth Service
echo [2/6] Starting Auth Service...
start "NexusMind - Auth" cmd /k "cd /d ""%~dp0Backend\Services\auth"" && npm run dev"

REM Start Chat Service
echo [3/6] Starting Chat Service...
start "NexusMind - Chat" cmd /k "cd /d ""%~dp0Backend\Services\Chat"" && npm run dev"

REM Start Agent Service
echo [4/6] Starting Agent Service...
start "NexusMind - Agent" cmd /k "cd /d ""%~dp0Backend\Services\Agent"" && npm run dev"

REM Start Gateway
echo [5/6] Starting Gateway...
start "NexusMind - Gateway" cmd /k "cd /d ""%~dp0Backend\Gateway"" && npm run dev"

REM Start Frontend
echo [6/6] Starting Frontend...
start "NexusMind - Frontend" cmd /k "cd /d ""%~dp0Frontend"" && npm run dev"

echo.
echo All startup commands launched.
pause
