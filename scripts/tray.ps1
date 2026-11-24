param(
    [string]$IconPath = ""
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$appContext = New-Object System.Windows.Forms.ApplicationContext

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Text = "YouTube Video Downloader"

if ($IconPath -and (Test-Path $IconPath)) {
    try {
        $notifyIcon.Icon = New-Object System.Drawing.Icon($IconPath)
    } catch {
        $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
    }
} else {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}

$contextMenu = New-Object System.Windows.Forms.ContextMenu

$openItem = New-Object System.Windows.Forms.MenuItem
$openItem.Text = "Open YouTube Downloader"
$openItem.DefaultItem = $true
$openItem.Add_Click({
    [Console]::Out.WriteLine("OPEN")
    [Console]::Out.Flush()
})

$separator = New-Object System.Windows.Forms.MenuItem
$separator.Text = "-"

$quitItem = New-Object System.Windows.Forms.MenuItem
$quitItem.Text = "Quit"
$quitItem.Add_Click({
    [Console]::Out.WriteLine("QUIT")
    [Console]::Out.Flush()
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    $appContext.ExitThread()
})

$null = $contextMenu.MenuItems.Add($openItem)
$null = $contextMenu.MenuItems.Add($separator)
$null = $contextMenu.MenuItems.Add($quitItem)

$notifyIcon.ContextMenu = $contextMenu
$notifyIcon.Add_DoubleClick({
    [Console]::Out.WriteLine("OPEN")
    [Console]::Out.Flush()
})

$notifyIcon.Visible = $true

$script:readTask = [Console]::In.ReadLineAsync()
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 200
$timer.Add_Tick({
    if ($script:readTask.IsCompleted) {
        $line = $null
        try { $line = $script:readTask.Result } catch {}
        if ($null -eq $line -or $line.Trim() -eq "EXIT") {
            $timer.Stop()
            $notifyIcon.Visible = $false
            $notifyIcon.Dispose()
            $appContext.ExitThread()
            return
        }
        $script:readTask = [Console]::In.ReadLineAsync()
    }
})
$timer.Start()

[System.Windows.Forms.Application]::Run($appContext)

if ($notifyIcon) {
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
}
