param(
  [string]$SelectionPath = "apps/webapp/assets/district-variation-bundles.json",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Get-Sha256 {
  param([string]$Path)
  return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToUpperInvariant()
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$selectionFile = Join-Path $repoRoot $SelectionPath
if (-not (Test-Path $selectionFile)) {
  throw "Variation catalog not found: $selectionFile"
}

$selection = Get-Content -Raw -Path $selectionFile | ConvertFrom-Json
$rows = @($selection.rows)
if (-not $rows.Count) {
  Write-Host "[district-variations] no rows in variation catalog"
  exit 0
}

$assetDir = Join-Path $repoRoot "apps/webapp/assets"
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

foreach ($row in $rows) {
  $fileName = [string]$row.file_name
  $downloadUrl = [string]$row.download_url
  $sha256 = ([string]$row.sha256).ToUpperInvariant()
  $targetPath = Join-Path $assetDir $fileName

  $shouldDownload = $Force -or -not (Test-Path $targetPath)
  if (-not $shouldDownload -and $sha256) {
    $currentHash = Get-Sha256 -Path $targetPath
    if ($currentHash -ne $sha256) {
      $shouldDownload = $true
    }
  }

  if ($shouldDownload) {
    Write-Host "[district-variations] downloading $fileName"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $targetPath
  } else {
    Write-Host "[district-variations] keeping $fileName"
  }

  if ($sha256) {
    $finalHash = Get-Sha256 -Path $targetPath
    if ($finalHash -ne $sha256) {
      throw "SHA256 mismatch for $fileName. Expected $sha256, got $finalHash"
    }
  }
}

Write-Host "[district-variations] completed $($rows.Count) variation downloads"
