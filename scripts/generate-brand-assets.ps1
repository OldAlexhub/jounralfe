param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$masterPath = Join-Path $ProjectRoot 'assets\innerfolio-icon-v2.png'
$foregroundPath = Join-Path $ProjectRoot 'assets\innerfolio-icon-foreground-v2.png'
$featureSourcePath = Join-Path $ProjectRoot 'assets\feature-graphic-source-v2.png'
$storeIconPath = Join-Path $ProjectRoot 'store_assets\app-icon-512.png'
$featurePath = Join-Path $ProjectRoot 'store_assets\feature-graphic-1024x500.png'
$resourceRoot = Join-Path $ProjectRoot 'android\app\src\main\res'

foreach ($path in @($masterPath, $foregroundPath, $featureSourcePath)) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing brand source: $path" }
}

function New-RenderedBitmap {
  param(
    [System.Drawing.Image]$Source,
    [int]$Width,
    [int]$Height,
    [bool]$Round = $false,
    [System.Drawing.Color]$Background = [System.Drawing.Color]::Transparent
  )

  $pixelFormat = if ($Background.A -eq 255) {
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  }
  else {
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  }
  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, $pixelFormat)
  $bitmap.SetResolution(144, 144)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear($Background)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    if ($Round) {
      $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
      try {
        $clip.AddEllipse(0, 0, $Width, $Height)
        $graphics.SetClip($clip)
        $graphics.DrawImage($Source, 0, 0, $Width, $Height)
      }
      finally { $clip.Dispose() }
    }
    else {
      $graphics.DrawImage($Source, 0, 0, $Width, $Height)
    }
  }
  finally { $graphics.Dispose() }
  return $bitmap
}

function Save-RenderedPng {
  param(
    [System.Drawing.Image]$Source,
    [int]$Width,
    [int]$Height,
    [string]$Destination,
    [bool]$Round = $false,
    [System.Drawing.Color]$Background = [System.Drawing.Color]::Transparent
  )

  $bitmap = New-RenderedBitmap -Source $Source -Width $Width -Height $Height -Round $Round -Background $Background
  try { $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png) }
  finally { $bitmap.Dispose() }
}

$master = [System.Drawing.Image]::FromFile($masterPath)
$foreground = [System.Drawing.Image]::FromFile($foregroundPath)
$feature = [System.Drawing.Image]::FromFile($featureSourcePath)
try {
  if ($master.Width -ne $master.Height) { throw 'The app icon master must be square.' }
  if (($foreground.PixelFormat -band [System.Drawing.Imaging.PixelFormat]::Alpha) -eq 0) { throw 'The adaptive foreground must include transparency.' }
  if ([math]::Abs(($feature.Width / $feature.Height) - (1024 / 500)) -gt 0.01) { throw 'The feature graphic source must use the 1024:500 aspect ratio.' }

  $iconBackground = [System.Drawing.Color]::FromArgb(255, 3, 72, 70)
  $featureBackground = [System.Drawing.Color]::FromArgb(255, 2, 70, 67)
  Save-RenderedPng -Source $master -Width 512 -Height 512 -Destination $storeIconPath -Background $iconBackground
  Save-RenderedPng -Source $feature -Width 1024 -Height 500 -Destination $featurePath -Background $featureBackground

  $densities = @{
    'mipmap-mdpi' = @{ Legacy = 48; Foreground = 108 }
    'mipmap-hdpi' = @{ Legacy = 72; Foreground = 162 }
    'mipmap-xhdpi' = @{ Legacy = 96; Foreground = 216 }
    'mipmap-xxhdpi' = @{ Legacy = 144; Foreground = 324 }
    'mipmap-xxxhdpi' = @{ Legacy = 192; Foreground = 432 }
  }
  foreach ($entry in $densities.GetEnumerator()) {
    $folder = Join-Path $resourceRoot $entry.Key
    Save-RenderedPng -Source $master -Width $entry.Value.Legacy -Height $entry.Value.Legacy -Destination (Join-Path $folder 'ic_launcher.png') -Background $iconBackground
    Save-RenderedPng -Source $master -Width $entry.Value.Legacy -Height $entry.Value.Legacy -Destination (Join-Path $folder 'ic_launcher_round.png') -Round $true
    Save-RenderedPng -Source $foreground -Width $entry.Value.Foreground -Height $entry.Value.Foreground -Destination (Join-Path $folder 'ic_launcher_foreground.png')
  }
}
finally {
  $feature.Dispose()
  $foreground.Dispose()
  $master.Dispose()
}

Write-Host "Generated Play icon, feature graphic, and Android launcher assets."
