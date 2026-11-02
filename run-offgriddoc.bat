@echo off
cd /d "%~dp0"
title OffgridDoc (Offline PDF Workspace)

if not exist "dist" (
    echo Building OffgridDoc production bundle...
    call npm run build
)

echo Starting OffgridDoc offline server...
echo Your browser will open automatically.
echo Press Ctrl+C or close this window when done.
echo.
call npm run preview -- --open
