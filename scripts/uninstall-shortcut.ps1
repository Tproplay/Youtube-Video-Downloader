# uninstall-shortcut.ps1
# Removes Start Menu and Desktop shortcuts for YouTube Video Downloader

$startMenu = [Environment]::GetFolderPath('Programs')
$startMenuShortcut = Join-Path $startMenu "YouTube Video Downloader.lnk"

$desktop = [Environment]::GetFolderPath('Desktop')
$desktopShortcut = Join-Path $desktop "YouTube Video Downloader.lnk"

if (Test-Path $startMenuShortcut) {
    Remove-Item -Force $startMenuShortcut
    Write-Host "Removed Start Menu shortcut: $startMenuShortcut"
}

if (Test-Path $desktopShortcut) {
    Remove-Item -Force $desktopShortcut
    Write-Host "Removed Desktop shortcut: $desktopShortcut"
}

Write-Host "Shortcuts removed successfully."
