@echo off
REM Installs a Windows Startup shortcut so the Outlook helper runs after user login.
title Install Endivio Outlook Helper Startup Shortcut
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$startup=[Environment]::GetFolderPath('Startup'); $shell=New-Object -ComObject WScript.Shell; $shortcut=$shell.CreateShortcut((Join-Path $startup 'Endivio Outlook Helper.lnk')); $shortcut.TargetPath=(Join-Path '%~dp0' 'Start-EndivioOutlookHelper.bat'); $shortcut.WorkingDirectory='%~dp0'; $shortcut.Save(); Write-Host 'Installed startup shortcut:' $shortcut.FullName"
pause
