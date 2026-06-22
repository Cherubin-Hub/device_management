@echo off
title Endivio Outlook Mail Helper
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0EndivioOutlookHelper.ps1"
pause
