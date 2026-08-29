@echo off
title LearnDash XML Generator
echo Starting LearnDash XML Generator local server...
cd /d "%~dp0"
py serve.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Trying python.exe...
    python serve.py
)
pause
