@echo off
REM Pinpoint launcher - visible console, useful when something fails.
cd /d "%~dp0\..\.."
node scripts\launcher.mjs start
if errorlevel 1 pause
