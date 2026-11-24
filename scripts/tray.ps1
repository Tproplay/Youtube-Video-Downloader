param(
    [string]$IconPath = ""
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

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

$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

$openItem = New-Object System.Windows.Forms.ToolStripMenuItem
$openItem.Text = "Open YouTube Downloader"
$openItem.Font = New-Object System.Drawing.Font($openItem.Font, [System.Drawing.FontStyle]::Bold)
$openItem.Add_Click({
    [Console]::Out.WriteLine("OPEN")
    [Console]::Out.Flush()
})

$separator = New-Object System.Windows.Forms.ToolStripSeparator

$quitItem = New-Object System.Windows.Forms.ToolStripMenuItem
$quitItem.Text = "Quit"
$quitItem.Add_Click({
    [Console]::Out.WriteLine("QUIT")
    [Console]::Out.Flush()
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    [System.Windows.Forms.Application]::Exit()
})

$null = $contextMenu.Items.Add($openItem)
$null = $contextMenu.Items.Add($separator)
$null = $contextMenu.Items.Add($quitItem)

$notifyIcon.ContextMenuStrip = $contextMenu
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
            [System.Windows.Forms.Application]::Exit()
            return
        }
        $script:readTask = [Console]::In.ReadLineAsync()
    }
})
$timer.Start()

[System.Windows.Forms.Application]::Run()

if ($notifyIcon) {
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
}
