# build-installer.ps1
# Packages YouTube Video Downloader into a standalone single-file Windows Installer (.exe)

$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $projectDir "dist"
$stagingDir = Join-Path $distDir "staging"
$stagingBin = Join-Path $stagingDir "bin"
$payloadZip = Join-Path $distDir "app_payload.zip"
$outputExe = Join-Path $distDir "YouTube-Downloader-Setup.exe"
$iconPath = Join-Path $projectDir "assets\app.ico"
$installerCs = Join-Path $projectDir "src-installer\Installer.cs"
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

Write-Host "============================================================"
Write-Host " Building Standalone Windows Installer: YouTube Downloader"
Write-Host "============================================================"

# 1. Ensure high-res icon exists
if (!(Test-Path $iconPath)) {
    Write-Host "[1/7] Generating application icons..."
    $iconScript = Join-Path $PSScriptRoot "create-app-icon.ps1"
    & powershell -ExecutionPolicy Bypass -File $iconScript
}

# 2. Reset staging directory
Write-Host "[2/7] Preparing staging directory..."
if (Test-Path $stagingDir) {
    Remove-Item -Recurse -Force $stagingDir
}
if (!(Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}
New-Item -ItemType Directory -Path $stagingBin -Force | Out-Null

# 3. Locate runtime binaries on this machine
Write-Host "[3/7] Locating portable runtimes (Node.js, yt-dlp, FFmpeg)..."

# Node.js
$nodeCandidates = @(
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe",
    (Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe")
)
$nodeExe = $nodeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (!$nodeExe) {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) { $nodeExe = $nodeCmd.Source }
}
if (!$nodeExe) {
    Write-Error "Node.js executable was not found. Please install Node.js."
    exit 1
}
Write-Host "   Node.js: $nodeExe"

# yt-dlp
$ytdlpExe = $null
$ytdlpCmd = Get-Command yt-dlp -ErrorAction SilentlyContinue
if ($ytdlpCmd) { $ytdlpExe = $ytdlpCmd.Source }
if (!$ytdlpExe) {
    $wingetYtdlp = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "yt-dlp.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($wingetYtdlp) { $ytdlpExe = $wingetYtdlp.FullName }
}
if (!$ytdlpExe) {
    Write-Error "yt-dlp executable was not found. Please install yt-dlp."
    exit 1
}
Write-Host "   yt-dlp:  $ytdlpExe"

# FFmpeg & FFprobe
$ffmpegExe = $null
$ffmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpegCmd) { $ffmpegExe = $ffmpegCmd.Source }
if (!$ffmpegExe) {
    $wingetFfmpeg = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($wingetFfmpeg) { $ffmpegExe = $wingetFfmpeg.FullName }
}
if (!$ffmpegExe) {
    Write-Error "FFmpeg executable was not found. Please install FFmpeg."
    exit 1
}
Write-Host "   FFmpeg:  $ffmpegExe"

$ffprobeExe = Join-Path (Split-Path -Parent $ffmpegExe) "ffprobe.exe"
if (!(Test-Path $ffprobeExe)) {
    $ffprobeCmd = Get-Command ffprobe -ErrorAction SilentlyContinue
    if ($ffprobeCmd) { $ffprobeExe = $ffprobeCmd.Source }
}

# 4. Copy runtime binaries to staging/bin
Write-Host "[4/7] Copying runtime binaries into staging/bin (this may take a few seconds)..."
Copy-Item -Path $nodeExe -Destination (Join-Path $stagingBin "node.exe") -Force
Copy-Item -Path $ytdlpExe -Destination (Join-Path $stagingBin "yt-dlp.exe") -Force
Copy-Item -Path $ffmpegExe -Destination (Join-Path $stagingBin "ffmpeg.exe") -Force
if (Test-Path $ffprobeExe) {
    Copy-Item -Path $ffprobeExe -Destination (Join-Path $stagingBin "ffprobe.exe") -Force
}

# 5. Copy app source files into staging
Write-Host "[5/7] Copying application code and assets..."
Copy-Item -Path (Join-Path $projectDir "server.js") -Destination $stagingDir -Force
Copy-Item -Path (Join-Path $projectDir "package.json") -Destination $stagingDir -Force
Copy-Item -Path (Join-Path $projectDir "start-hidden.vbs") -Destination $stagingDir -Force
Copy-Item -Path (Join-Path $projectDir "start.bat") -Destination $stagingDir -Force

Copy-Item -Path (Join-Path $projectDir "lib") -Destination $stagingDir -Recurse -Force
Copy-Item -Path (Join-Path $projectDir "public") -Destination $stagingDir -Recurse -Force
Copy-Item -Path (Join-Path $projectDir "assets") -Destination $stagingDir -Recurse -Force

$stagingScripts = Join-Path $stagingDir "scripts"
New-Item -ItemType Directory -Path $stagingScripts -Force | Out-Null
Copy-Item -Path (Join-Path $projectDir "scripts\install-shortcut.ps1") -Destination $stagingScripts -Force
Copy-Item -Path (Join-Path $projectDir "scripts\uninstall-shortcut.ps1") -Destination $stagingScripts -Force
Copy-Item -Path (Join-Path $projectDir "scripts\tray.ps1") -Destination $stagingScripts -Force

# Create clean data structure in staging
$stagingData = Join-Path $stagingDir "data"
New-Item -ItemType Directory -Path $stagingData -Force | Out-Null
Set-Content -Path (Join-Path $stagingData "queue.json") -Value "[]" -Encoding UTF8
Set-Content -Path (Join-Path $stagingData "history.json") -Value "[]" -Encoding UTF8
Set-Content -Path (Join-Path $stagingData "settings.json") -Value '{"filenameTemplate":"%(title)s.%(ext)s","concurrency":2,"maxRetries":3,"theme":"system","browserCookies":"none","autoOpenFolder":false,"defaultFormat":{"type":"video_audio","quality":"best","container":"mp4","audioFormat":"mp3","audioQuality":"best","embedThumbnail":true,"embedMetadata":true,"embedChapters":true,"saveThumbnailImage":false,"sponsorBlock":false}}' -Encoding UTF8

# 6. Compress staging to payload.zip
Write-Host "[6/7] Compressing application payload into package archive..."
if (Test-Path $payloadZip) {
    Remove-Item -Force $payloadZip
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $payloadZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$zipSizeMb = [math]::Round(((Get-Item $payloadZip).Length / 1MB), 2)
Write-Host "   Compressed payload size: $zipSizeMb MB"

# 7. Compile standalone C# installer with embedded payload
Write-Host "[7/7] Compiling standalone setup executable: YouTube-Downloader-Setup.exe..."
if (Test-Path $outputExe) {
    Remove-Item -Force $outputExe
}

$compileArgs = @(
    "/target:winexe",
    "/optimize+",
    "/win32icon:$iconPath",
    "/resource:$payloadZip,app_payload.zip",
    "/reference:System.dll,System.Windows.Forms.dll,System.Drawing.dll,System.IO.Compression.dll,System.IO.Compression.FileSystem.dll,Microsoft.CSharp.dll",
    "/out:$outputExe",
    "$installerCs"
)

& $csc $compileArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "C# compilation of installer failed."
    exit 1
}

# Clean temporary staging files
Write-Host "Cleaning up build artifacts..."
Remove-Item -Recurse -Force $stagingDir
Remove-Item -Force $payloadZip

$exeSizeMb = [math]::Round(((Get-Item $outputExe).Length / 1MB), 2)

Write-Host ""
Write-Host "============================================================"
Write-Host " Build Complete!"
Write-Host " Standalone Installer:"
Write-Host "   $outputExe ($exeSizeMb MB)"
Write-Host ""
Write-Host " This single .exe file contains everything:"
Write-Host "  - Node.js runtime"
Write-Host "  - yt-dlp core engine"
Write-Host "  - FFmpeg + FFprobe"
Write-Host "  - YouTube Downloader App, UI & Icons"
Write-Host ""
Write-Host " Anyone on Windows 10/11 can double-click this .exe to install"
Write-Host " and run the app with ZERO external setup required!"
Write-Host "============================================================"
