@echo off
setlocal
title 16-Bit Retro Expert Terminal
cd /d "%~dp0"

where py >nul 2>&1
if %errorlevel%==0 (
    py -3 "%~dp0server.py"
    goto :done
)

where python >nul 2>&1
if %errorlevel%==0 (
    python "%~dp0server.py"
    goto :done
)

where python3 >nul 2>&1
if %errorlevel%==0 (
    python3 "%~dp0server.py"
    goto :done
)

echo.
echo [ERROR] Python 3 was not found in PATH.
echo Please install Python 3 from https://www.python.org/downloads/
echo and make sure "Add Python to PATH" is checked.
echo.
pause
exit /b 1

:done
endlocal
