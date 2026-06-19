$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $PSScriptRoot "SolarSystemLauncher.cs"
$output = Join-Path $projectRoot "SolarSystem.exe"
$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path $compiler)) {
  $compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (-not (Test-Path $compiler)) {
  throw "Could not find csc.exe. Install the .NET SDK or run this on Windows with .NET Framework tooling."
}

& $compiler /nologo /target:exe /optimize+ /out:$output $source
Write-Host "Created $output"
