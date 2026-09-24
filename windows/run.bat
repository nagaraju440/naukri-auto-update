@echo off
REM Laptop fallback: runs one refresh using the saved session in state.json.
REM Put NAUKRI_EMAIL / NAUKRI_PASSWORD in windows\secrets.bat (gitignored pattern: keep it out of any repo).
cd /d "%~dp0.."
if exist "%~dp0secrets.bat" call "%~dp0secrets.bat"
set JITTER_MAX_MIN=10
node update.js >> "%~dp0run.log" 2>&1
