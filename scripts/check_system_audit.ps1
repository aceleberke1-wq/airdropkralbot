param(
  [string]$RepoRoot = "",
  [switch]$Strict,
  [string]$JsonOut = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = Split-Path -Parent $PSScriptRoot
}

$repoPath = (Resolve-Path $RepoRoot).Path
$excludeDirNames = @(".git", "node_modules", "dist", "coverage")
$keywordPattern = '(?i)\b(mock|placeholder|demo|fake)\b'

function Test-IsExcludedPath {
  param([string]$Path)
  $segments = $Path -split '[\\/]'
  foreach ($seg in $segments) {
    if ($excludeDirNames -contains $seg) { return $true }
  }
  return $false
}

function Classify-Finding {
  param(
    [string]$FilePath,
    [string]$LineText
  )
  $normalizedPath = $FilePath.Replace('\','/').ToLower()
  $text = [string]$LineText
  if ($normalizedPath -match '/(test|tests)/' -or $normalizedPath -match '\.test\.' -or $normalizedPath -match '\.spec\.') {
    return "test_only"
  }
  if ($normalizedPath -match '(^|/)scripts/check_system_audit\.ps1$') {
    return "audit_tooling"
  }
  if ($normalizedPath -match '(^|/)apps/admin-api/src/index\.js$' -and ($text -match 'line\.includes\(\"placeholder\"\)' -or $text -match 'classifyKeywordFinding')) {
    return "audit_tooling"
  }
  if ($normalizedPath -match 'scripts/' -and ($normalizedPath -match 'check' -or $normalizedPath -match 'validate')) {
    return "audit_tooling"
  }
  if ($normalizedPath -match 'allowedSnippets') {
    return "audit_tooling"
  }
  if ($normalizedPath -match '\.tsx?$' -and $text -match 'placeholder=\{') {
    return "ui_placeholder"
  }
  if ($normalizedPath -match 'apps/webapp/(index(\.vite)?\.html|styles\.css|app\.js)$' -and ($text -match 'placeholder' -or $text -match 'orn:' -or $text -match 'veya hash')) {
    return "ui_placeholder"
  }
  if ($normalizedPath -match '\.(json|yaml|yml)$' -and ($text -match '"notes"' -or $text -match 'description')) {
    return "docs_text"
  }
  if ($normalizedPath -match '\.md$' -or $normalizedPath -match 'docs/') {
    return "docs_text"
  }
  if ($normalizedPath -match 'architecture/' -or $normalizedPath -match 'blueprint' -or $normalizedPath -match 'canonical') {
    return "docs_text"
  }
  if ($text -match 'allowedSnippets' -or $text -match 'bannedPattern') {
    return "audit_tooling"
  }
  if ($text -match 'depends on placeholder' -or $text -match 'No critical trust') {
    return "docs_text"
  }
  return "runtime_risk"
}

Write-Host ("[audit] repo: " + $repoPath) -ForegroundColor Cyan

$files = Get-ChildItem -Path $repoPath -Recurse -File | Where-Object {
  -not (Test-IsExcludedPath -Path $_.FullName)
}

$hashBuckets = @{}
$duplicateGroups = @()
$keywordFindings = New-Object System.Collections.Generic.List[object]

foreach ($file in $files) {
  try {
    $hash = (Get-FileHash -Algorithm SHA256 -Path $file.FullName).Hash
    if (-not $hashBuckets.ContainsKey($hash)) {
      $hashBuckets[$hash] = New-Object System.Collections.Generic.List[string]
    }
    $hashBuckets[$hash].Add($file.FullName)
  } catch {
    # Skip unreadable binary edge cases but note them as runtime risk only if strict parsing is needed.
  }

  $lineNo = 0
  try {
    foreach ($line in Get-Content -Path $file.FullName -ErrorAction Stop) {
      $lineNo++
      if ($line -match $keywordPattern) {
        $keyword = $Matches[1].ToLower()
        $klass = Classify-Finding -FilePath $file.FullName -LineText $line
        $keywordFindings.Add([pscustomobject]@{
          file = $file.FullName.Substring($repoPath.Length).TrimStart('\','/')
          line = $lineNo
          keyword = $keyword
          classification = $klass
          snippet = ([string]$line).Trim()
        })
      }
    }
  } catch {
    # Ignore binary/non-text reads
  }
}

foreach ($hash in $hashBuckets.Keys) {
  $paths = @($hashBuckets[$hash])
  if ($paths.Count -gt 1) {
    $duplicateGroups += [pscustomobject]@{
      hash = $hash
      count = $paths.Count
      files = @($paths | ForEach-Object { $_.Substring($repoPath.Length).TrimStart('\','/') } | Sort-Object)
    }
  }
}

$classificationBuckets = @{
  test_only = @()
  ui_placeholder = @()
  docs_text = @()
  audit_tooling = @()
  runtime_risk = @()
}
foreach ($finding in $keywordFindings) {
  if (-not $classificationBuckets.ContainsKey($finding.classification)) {
    $classificationBuckets[$finding.classification] = @()
  }
  $classificationBuckets[$finding.classification] += $finding
}

$summary = [ordered]@{
  generated_at = (Get-Date).ToString("o")
  repo_root = $repoPath
  file_count = $files.Count
  duplicate_exact_content_groups = $duplicateGroups.Count
  duplicate_exact_content_files = @($duplicateGroups | ForEach-Object { $_.count } | Measure-Object -Sum).Sum
  keyword_finding_count = $keywordFindings.Count
  classification_counts = [ordered]@{
    test_only = @($classificationBuckets["test_only"]).Count
    ui_placeholder = @($classificationBuckets["ui_placeholder"]).Count
    docs_text = @($classificationBuckets["docs_text"]).Count
    audit_tooling = @($classificationBuckets["audit_tooling"]).Count
    runtime_risk = @($classificationBuckets["runtime_risk"]).Count
  }
  strict_status = if (@($classificationBuckets["runtime_risk"]).Count -gt 0) { "fail" } else { "pass" }
}

$report = @{}
$report["summary"] = $summary
$report["duplicate_groups"] = @($duplicateGroups | ForEach-Object { $_ })
$report["keyword_findings"] = @($keywordFindings | ForEach-Object { $_ })

Write-Host ""
Write-Host "== System Audit Summary ==" -ForegroundColor Cyan
Write-Host ("files: " + $summary.file_count)
Write-Host ("duplicate groups: " + $summary.duplicate_exact_content_groups)
Write-Host ("keyword findings: " + $summary.keyword_finding_count)
Write-Host ("  test_only: " + $summary.classification_counts.test_only)
Write-Host ("  ui_placeholder: " + $summary.classification_counts.ui_placeholder)
Write-Host ("  docs_text: " + $summary.classification_counts.docs_text)
Write-Host ("  audit_tooling: " + $summary.classification_counts.audit_tooling)
if ($summary.classification_counts.runtime_risk -gt 0) {
  Write-Host ("  runtime_risk: " + $summary.classification_counts.runtime_risk) -ForegroundColor Red
} else {
  Write-Host "  runtime_risk: 0" -ForegroundColor Green
}

if ($summary.classification_counts.runtime_risk -gt 0) {
  Write-Host ""
  Write-Host "[runtime_risk sample]" -ForegroundColor Red
  @($classificationBuckets["runtime_risk"] | Select-Object -First 20) | ForEach-Object {
    Write-Host (" - {0}:{1} [{2}] {3}" -f $_.file, $_.line, $_.keyword, $_.snippet) -ForegroundColor Red
  }
}

$json = $report | ConvertTo-Json -Depth 8
if (-not [string]::IsNullOrWhiteSpace($JsonOut)) {
  $outPath = $JsonOut
  if (-not [System.IO.Path]::IsPathRooted($outPath)) {
    $outPath = Join-Path $repoPath $outPath
  }
  $dir = Split-Path -Parent $outPath
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  Set-Content -Path $outPath -Value $json -Encoding UTF8
  Write-Host ("[json] " + $outPath) -ForegroundColor DarkCyan
}

if ($Strict -and $summary.classification_counts.runtime_risk -gt 0) {
  Write-Host ""
  Write-Host "System audit FAILED (runtime_risk findings present)." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "System audit PASS." -ForegroundColor Green
exit 0
