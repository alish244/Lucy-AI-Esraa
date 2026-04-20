@echo off
REM ============================================================================
REM Lucy — one-click build
REM
REM 1. Fetches the WebView2 SDK (if missing) via scripts\setup-sdk.ps1
REM 2. Configures CMake with the default Visual Studio 2022 generator
REM 3. Builds Release x64
REM 4. Prints the path to Lucy.exe when done
REM ============================================================================

setlocal EnableDelayedExpansion
pushd "%~dp0"

echo.
echo ===============================================================
echo   Lucy build script
echo   Al-Esraa University . Section A3
echo ===============================================================
echo.

REM --- Step 1: fetch SDK --------------------------------------------------------
echo [1/3] Checking WebView2 SDK...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-sdk.ps1"
if errorlevel 1 (
    echo.
    echo SDK setup failed. Aborting.
    popd
    exit /b 1
)

REM --- Step 2: configure --------------------------------------------------------
echo.
echo [2/3] Configuring CMake (Visual Studio 17 2022, x64)...
if not exist build mkdir build
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
if errorlevel 1 (
    echo.
    echo CMake configure failed. Make sure Visual Studio 2022 is installed.
    popd
    exit /b 1
)

REM --- Step 3: build ------------------------------------------------------------
echo.
echo [3/3] Building Release...
cmake --build build --config Release --parallel
if errorlevel 1 (
    echo.
    echo Build failed.
    popd
    exit /b 1
)

echo.
echo ===============================================================
echo   Build complete.
echo   Launcher : %CD%\build\Release\Lucy.exe
echo   Web UI   : %CD%\build\Release\app\index.html
echo ===============================================================
echo.

popd
endlocal
