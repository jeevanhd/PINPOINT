@echo off
setlocal
cd /d "%~dp0\..\.."
node scripts\launcher.mjs stop
if exist "%USERPROFILE%\Desktop\Pinpoint.lnk" del "%USERPROFILE%\Desktop\Pinpoint.lnk"
echo Removed the Pinpoint shortcut and stopped the app.
endlocal
