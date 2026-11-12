# install-shortcut.ps1
# Creates Start Menu and Desktop shortcuts for YouTube Video Downloader
# Enables searching for "YouTube Video Downloader" in Windows Search / Start Menu

$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $projectDir "assets"
$icoPath = Join-Path $assetsDir "app.ico"
$vbsPath = Join-Path $projectDir "start-hidden.vbs"

# 1. Ensure app icon exists
if (!(Test-Path $icoPath)) {
    Write-Host "App icon not found. Generating high-resolution icon..."
    $iconScript = Join-Path $PSScriptRoot "create-app-icon.ps1"
    & powershell -ExecutionPolicy Bypass -File $iconScript
}

if (!(Test-Path $vbsPath)) {
    Write-Error "Launcher script not found: $vbsPath"
    exit 1
}

$wsh = New-Object -ComObject WScript.Shell

# 2. Start Menu Programs (Indexed automatically by Windows Search)
$startMenu = [Environment]::GetFolderPath('Programs')
$startMenuShortcut = Join-Path $startMenu "YouTube Video Downloader.lnk"

$s1 = $wsh.CreateShortcut($startMenuShortcut)
$s1.TargetPath = "C:\Windows\System32\wscript.exe"
$s1.Arguments = "`"$vbsPath`""
$s1.WorkingDirectory = $projectDir
$s1.IconLocation = "$icoPath,0"
$s1.Description = "YouTube Video Downloader - Fast, local, high-fidelity media downloader"
$s1.Save()

Write-Host "[OK] Windows Search and Start Menu shortcut created:"
Write-Host "     $startMenuShortcut"

# 3. Desktop Shortcut
$desktop = [Environment]::GetFolderPath('Desktop')
$desktopShortcut = Join-Path $desktop "YouTube Video Downloader.lnk"

$s2 = $wsh.CreateShortcut($desktopShortcut)
$s2.TargetPath = "C:\Windows\System32\wscript.exe"
$s2.Arguments = "`"$vbsPath`""
$s2.WorkingDirectory = $projectDir
$s2.IconLocation = "$icoPath,0"
$s2.Description = "YouTube Video Downloader - Fast, local, high-fidelity media downloader"
$s2.Save()

Write-Host "[OK] Desktop shortcut created:"
Write-Host "     $desktopShortcut"

Write-Host ""
Write-Host "============================================================"
Write-Host " Installation Complete!"
Write-Host " You can now search 'YouTube' or 'YouTube Video Downloader'"
Write-Host " in your Windows Search bar / Start Menu to launch the app!"
Write-Host "============================================================"
