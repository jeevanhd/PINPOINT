@echo off
setlocal
set ROOT=%~dp0..\..\..
set ROOT=%ROOT%\.
set DESKTOP=%USERPROFILE%\Desktop
set TARGET=%DESKTOP%\Pinpoint.lnk

powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%TARGET%');" ^
  "$s.TargetPath='wscript.exe';" ^
  "$s.Arguments='\"%ROOT%\scripts\install-shortcut\windows\Pinpoint-Hidden.vbs\"';" ^
  "$s.WorkingDirectory='%ROOT%';" ^
  "$s.IconLocation='%ROOT%\apps\web\public\icons\icon-192.png';" ^
  "$s.Description='Pinpoint - explain it, pin it, own it';" ^
  "$s.Save()"

if exist "%TARGET%" (
  echo Installed: %TARGET%
) else (
  echo Could not create the shortcut. Run Pinpoint.bat directly.
)
endlocal
