$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$packageDir = Join-Path $dist "lively-solar-wallpaper"
$zipPath = Join-Path $dist "solar-system-wallpaper.zip"

Push-Location $root
try {
  npm run build
} finally {
  Pop-Location
}

if (Test-Path -LiteralPath $packageDir) {
  $resolvedPackage = Resolve-Path -LiteralPath $packageDir
  $resolvedDist = Resolve-Path -LiteralPath $dist
  if (-not $resolvedPackage.Path.StartsWith($resolvedDist.Path)) {
    throw "Refusing to remove path outside dist: $resolvedPackage"
  }
  Remove-Item -LiteralPath $packageDir -Recurse -Force
}

New-Item -ItemType Directory -Path $packageDir | Out-Null
Copy-Item -LiteralPath (Join-Path $dist "wallpaper.html") -Destination (Join-Path $packageDir "index.html")
Copy-Item -LiteralPath (Join-Path $dist "assets") -Destination (Join-Path $packageDir "assets") -Recurse

@'
{
  "AppVersion": "2.0.6.1",
  "Title": "Solar System Wallpaper",
  "Thumbnail": null,
  "Preview": null,
  "Desc": "Infinite inner Solar System simulation.",
  "Author": "Local",
  "License": null,
  "Contact": null,
  "Type": 1,
  "FileName": "index.html",
  "Arguments": null,
  "IsAbsolutePath": false
}
'@ | Set-Content -LiteralPath (Join-Path $packageDir "LivelyInfo.json") -Encoding UTF8

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -Path (Join-Path $packageDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Created $zipPath"
