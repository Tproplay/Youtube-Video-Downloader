Add-Type -AssemblyName System.Drawing

$projectDir = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $projectDir "assets"
$publicDir = Join-Path $projectDir "public"

if (!(Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
}

$iconSourcePath = Join-Path $assetsDir "icon-source.png"
$sizes = @(16, 32, 48, 64, 128, 256)

$entries = @()

if (Test-Path $iconSourcePath) {
    Write-Host "Loading custom icon from: $iconSourcePath"
    $srcImg = [System.Drawing.Image]::FromFile($iconSourcePath)

    # 1. High-resolution 256x256 PNG for assets/app.png and public/icon.png
    $bmp256 = New-Object System.Drawing.Bitmap 256, 256
    $g256 = [System.Drawing.Graphics]::FromImage($bmp256)
    $g256.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g256.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g256.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g256.Clear([System.Drawing.Color]::Transparent)
    $g256.DrawImage($srcImg, 0, 0, 256, 256)
    $g256.Dispose()

    $pngPath = Join-Path $assetsDir "app.png"
    $bmp256.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $publicIconPath = Join-Path $publicDir "icon.png"
    $bmp256.Save($publicIconPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp256.Dispose()

    # 2. Multi-resolution frames
    foreach ($s in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap $s, $s
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($srcImg, 0, 0, $s, $s)
        $g.Dispose()

        $hIcon = $bmp.GetHicon()
        $icon = [System.Drawing.Icon]::FromHandle($hIcon)
        $ms = New-Object System.IO.MemoryStream
        $icon.Save($ms)
        $bytes = $ms.ToArray()
        $ms.Dispose()
        $icon.Dispose()
        $bmp.Dispose()

        $imgData = New-Object byte[] ($bytes.Length - 22)
        [System.Array]::Copy($bytes, 22, $imgData, 0, $imgData.Length)

        $wByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }
        $hByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }

        $entries += [PSCustomObject]@{
            Width = $wByte
            Height = $hByte
            Colors = $bytes[8]
            Reserved = $bytes[9]
            Planes = [BitConverter]::ToUInt16($bytes, 10)
            BitCount = [BitConverter]::ToUInt16($bytes, 12)
            Size = [uint32]$imgData.Length
            Data = $imgData
        }
    }

    $srcImg.Dispose()
} else {
    Write-Host "No icon-source.png found; drawing fallback vector icon..."
    $bmp = New-Object System.Drawing.Bitmap 256, 256
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rect = New-Object System.Drawing.Rectangle 14, 14, 228, 228
    $radius = 48
    $d = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    $c1 = [System.Drawing.Color]::FromArgb(255, 255, 20, 60)
    $c2 = [System.Drawing.Color]::FromArgb(255, 180, 0, 30)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)
    $g.FillPath($brush, $path)

    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 255, 255, 255), 2.5)
    $g.DrawPath($borderPen, $path)

    $playPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p1 = New-Object System.Drawing.PointF 96, 78
    $p2 = New-Object System.Drawing.PointF 184, 128
    $p3 = New-Object System.Drawing.PointF 96, 178
    $playPath.AddPolygon(@($p1, $p2, $p3))
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(250, 255, 255, 255))
    $g.FillPath($whiteBrush, $playPath)

    $arrowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 210, 10, 45))
    $arrowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shaft = New-Object System.Drawing.RectangleF 119, 94, 14, 28
    $arrowPath.AddRectangle($shaft)
    $ah1 = New-Object System.Drawing.PointF 108, 122
    $ah2 = New-Object System.Drawing.PointF 144, 122
    $ah3 = New-Object System.Drawing.PointF 126, 146
    $arrowPath.AddPolygon(@($ah1, $ah2, $ah3))
    $tray = New-Object System.Drawing.RectangleF 112, 154, 28, 6
    $arrowPath.AddRectangle($tray)
    $g.FillPath($arrowBrush, $arrowPath)

    $pngPath = Join-Path $assetsDir "app.png"
    $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $publicIconPath = Join-Path $publicDir "icon.png"
    $bmp.Save($publicIconPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $hIcon = $bmp.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    $ms = New-Object System.IO.MemoryStream
    $icon.Save($ms)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    $icon.Dispose()
    $g.Dispose()
    $bmp.Dispose()

    $imgData = New-Object byte[] ($bytes.Length - 22)
    [System.Array]::Copy($bytes, 22, $imgData, 0, $imgData.Length)

    $entries += [PSCustomObject]@{
        Width = [byte]0
        Height = [byte]0
        Colors = $bytes[8]
        Reserved = $bytes[9]
        Planes = [BitConverter]::ToUInt16($bytes, 10)
        BitCount = [BitConverter]::ToUInt16($bytes, 12)
        Size = [uint32]$imgData.Length
        Data = $imgData
    }
}

# Function to write ICO file from entries
function Write-IcoFile($targetPath, $iconEntries) {
    $fs = [System.IO.File]::Create($targetPath)
    $bw = New-Object System.IO.BinaryWriter($fs)

    $bw.Write([uint16]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]$iconEntries.Count)

    $offset = 6 + (16 * $iconEntries.Count)

    foreach ($e in $iconEntries) {
        $bw.Write([byte]$e.Width)
        $bw.Write([byte]$e.Height)
        $bw.Write([byte]$e.Colors)
        $bw.Write([byte]$e.Reserved)
        $bw.Write([uint16]$e.Planes)
        $bw.Write([uint16]$e.BitCount)
        $bw.Write([uint32]$e.Size)
        $bw.Write([uint32]$offset)
        $offset += $e.Size
    }

    foreach ($e in $iconEntries) {
        $bw.Write($e.Data)
    }

    $bw.Close()
    $fs.Close()
}

$icoPath = Join-Path $assetsDir "app.ico"
Write-IcoFile $icoPath $entries

$favPath = Join-Path $publicDir "favicon.ico"
Write-IcoFile $favPath $entries

Write-Host "Icons generated successfully with $($entries.Count) resolution frames:"
Write-Host "  PNG Asset:   $pngPath"
Write-Host "  Public Icon: $publicIconPath"
Write-Host "  App ICO:     $icoPath ($((Get-Item $icoPath).Length) bytes)"
Write-Host "  Favicon:     $favPath ($((Get-Item $favPath).Length) bytes)"
