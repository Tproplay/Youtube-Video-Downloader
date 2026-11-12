Add-Type -AssemblyName System.Drawing

$projectDir = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $projectDir "assets"
$publicDir = Join-Path $projectDir "public"

if (!(Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
}

$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Rounded rectangle background (YouTube red gradient)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$rect = New-Object System.Drawing.Rectangle 14, 14, 228, 228
$radius = 48
$d = $radius * 2

$path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
$path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
$path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
$path.CloseFigure()

# Red gradient brush (#FF0033 to #CC0029)
$c1 = [System.Drawing.Color]::FromArgb(255, 255, 20, 60)
$c2 = [System.Drawing.Color]::FromArgb(255, 180, 0, 30)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)
$g.FillPath($brush, $path)

# Subtle inner gloss border
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 255, 255, 255), 2.5)
$g.DrawPath($borderPen, $path)

# Play triangle centered
$playPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$p1 = New-Object System.Drawing.PointF 96, 78
$p2 = New-Object System.Drawing.PointF 184, 128
$p3 = New-Object System.Drawing.PointF 96, 178
$playPath.AddPolygon(@($p1, $p2, $p3))
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(250, 255, 255, 255))
$g.FillPath($whiteBrush, $playPath)

# Download arrow centered on the triangle (red)
$arrowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 210, 10, 45))
$arrowPath = New-Object System.Drawing.Drawing2D.GraphicsPath

# Arrow shaft: rectangle
$shaft = New-Object System.Drawing.RectangleF 119, 94, 14, 28
$arrowPath.AddRectangle($shaft)

# Arrow head: triangle pointing down
$ah1 = New-Object System.Drawing.PointF 108, 122
$ah2 = New-Object System.Drawing.PointF 144, 122
$ah3 = New-Object System.Drawing.PointF 126, 146
$arrowPath.AddPolygon(@($ah1, $ah2, $ah3))

# Tray under arrow
$tray = New-Object System.Drawing.RectangleF 112, 154, 28, 6
$arrowPath.AddRectangle($tray)

$g.FillPath($arrowBrush, $arrowPath)

# Save PNG
$pngPath = Join-Path $assetsDir "app.png"
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Save ICO
$icoPath = Join-Path $assetsDir "app.ico"
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::OpenWrite($icoPath)
$icon.Save($fs)
$fs.Close()

# Also save favicon in public directory
$favPath = Join-Path $publicDir "favicon.ico"
$fsFav = [System.IO.File]::OpenWrite($favPath)
$icon.Save($fsFav)
$fsFav.Close()

$icon.Dispose()
$g.Dispose()
$bmp.Dispose()

Write-Host "Icons generated successfully:"
Write-Host "  PNG: $pngPath"
Write-Host "  ICO: $icoPath"
Write-Host "  Favicon: $favPath"
