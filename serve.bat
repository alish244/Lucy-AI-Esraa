@echo off
REM ============================================================================
REM Lucy — quick local preview (no compilation required)
REM Requires Python 3 on PATH.
REM After starting, open http://localhost:5173/ in Chrome or Edge.
REM ============================================================================

pushd "%~dp0"
echo.
echo Serving Lucy web UI at http://localhost:5173/
echo Press Ctrl+C to stop.
echo.
python -m http.server 5173
popd
