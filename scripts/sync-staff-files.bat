@echo off
title Pullens Staff Files Sync
echo.
echo Starting staff files sync...
echo.
cd /d "%~dp0\.."
node scripts/sync-staff-files.mjs
echo.
echo Press any key to close...
pause >nul
