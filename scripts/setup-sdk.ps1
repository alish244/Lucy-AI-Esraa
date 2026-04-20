# ==============================================================================
# Lucy — WebView2 SDK fetcher
#
# Downloads the Microsoft.Web.WebView2 NuGet package and extracts its contents
# to third_party/webview2/ so CMake can build Lucy.exe.
#
# Usage:
#     powershell -ExecutionPolicy Bypass -File scripts/setup-sdk.ps1
# Or simply run build.bat.
# ==============================================================================

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root      = Split-Path -Parent $ScriptDir
$Dest      = Join-Path $Root 'third_party\webview2'
$Version   = '1.0.2592.51'  # Stable WebView2 SDK
$Url       = "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$Version"
$Temp      = Join-Path $env:TEMP 'lucy-webview2.zip'

if (Test-Path (Join-Path $Dest 'build\native\include\WebView2.h')) {
    Write-Host "WebView2 SDK already present at $Dest" -ForegroundColor Green
    exit 0
}

Write-Host "Downloading Microsoft.Web.WebView2 $Version ..." -ForegroundColor Cyan
Write-Host "  from: $Url"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $Url -OutFile $Temp -UseBasicParsing

if (-not (Test-Path $Temp)) {
    throw "Download failed: $Temp not found"
}

Write-Host "Extracting to $Dest ..." -ForegroundColor Cyan
if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

# .nupkg is a ZIP — extract with Expand-Archive after renaming.
$Zip = [System.IO.Path]::ChangeExtension($Temp, '.zip')
Move-Item -Force $Temp $Zip
Expand-Archive -Path $Zip -DestinationPath $Dest -Force
Remove-Item -Force $Zip

$Header = Join-Path $Dest 'build\native\include\WebView2.h'
if (-not (Test-Path $Header)) {
    throw "Extraction succeeded but WebView2.h not found at $Header"
}

Write-Host ""
Write-Host "WebView2 SDK installed." -ForegroundColor Green
Write-Host "  Header: $Header"
Write-Host "Now run build.bat (or configure CMake manually)."
