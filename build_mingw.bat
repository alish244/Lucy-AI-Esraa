@echo off
REM ============================================================================
REM Lucy - one-click build (MinGW / no Visual Studio required)
REM
REM Produces build\Release\Lucy.exe using g++.
REM Requires MinGW-w64 g++ on PATH (you can install it via scoop, msys2,
REM w64devkit, or chocolatey).
REM
REM Unlike build.bat, this variant does NOT need:
REM   - Visual Studio 2022
REM   - CMake
REM   - The WebView2 SDK
REM
REM Instead, Lucy.exe spawns Microsoft Edge in app-mode pointed at the bundled
REM web UI. Edge ships with every up-to-date Windows 10/11 install, so there is
REM no extra runtime for end users to download.
REM ============================================================================

setlocal EnableDelayedExpansion
pushd "%~dp0"

echo.
echo ===============================================================
echo   Lucy build script (MinGW / Edge app-mode launcher)
echo   Al-Esraa University . Section A3
echo ===============================================================
echo.

where g++ >nul 2>nul
if errorlevel 1 (
    echo g++ was not found on PATH.
    echo.
    echo Please install MinGW-w64 first. Recommended options:
    echo   - scoop install gcc
    echo   - choco install mingw
    echo   - https://www.mingw-w64.org/downloads/
    echo.
    popd
    exit /b 1
)

echo [1/3] Compiling Lucy.exe ...
if not exist "build\Release" mkdir "build\Release"
g++ -std=c++17 -O2 -municode -mwindows -o "build\Release\Lucy.exe" "native\launcher_edge.cpp" -lshlwapi -ladvapi32 -luser32
if errorlevel 1 (
    echo Compile failed.
    popd
    exit /b 1
)

echo [2/3] Staging web UI into build\Release\app ...
if not exist "build\Release\app" mkdir "build\Release\app"
xcopy /E /I /Y /Q "index.html" "build\Release\app\" >nul
xcopy /E /I /Y /Q "styles"     "build\Release\app\styles\" >nul
xcopy /E /I /Y /Q "scripts"    "build\Release\app\scripts\" >nul
xcopy /E /I /Y /Q "data"       "build\Release\app\data\" >nul
xcopy /E /I /Y /Q "assets"     "build\Release\app\assets\" >nul

echo [3/3] Done.
echo.
echo ===============================================================
echo   Build complete.
echo   Launcher : %CD%\build\Release\Lucy.exe
echo   Web UI   : %CD%\build\Release\app\index.html
echo ===============================================================
echo.

popd
endlocal
