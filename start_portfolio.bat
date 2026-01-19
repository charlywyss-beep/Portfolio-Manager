@echo off
echo Starting Portfolio Manager...
cd /d "c:\Users\01\.gemini\antigravity\scratch\portfolio-manager"
echo Project directory: %CD%
echo.
echo Starting development server...
echo Access the app at: http://localhost:5173/
echo.
call npm run dev -- --host
pause
