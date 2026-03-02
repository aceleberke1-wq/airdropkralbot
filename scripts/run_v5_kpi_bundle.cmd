@echo off
setlocal
cd /d "%~dp0.."
call npm run kpi:v5:bundle
endlocal

