@echo off
cd /d "%~dp0"
"%~dp0runtime\node.exe" --no-warnings "%~dp0server.mjs"
pause
