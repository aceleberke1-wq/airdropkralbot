param(
  [string]$EnvPath = ".env"
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
  param([string]$Path, [string]$Key)
  if (-not (Test-Path $Path)) { return "" }
  $pattern = "^\s*$([Regex]::Escape($Key))\s*=\s*(.*)\s*$"
  foreach ($line in Get-Content $Path) {
    if ($line -match $pattern) { return $matches[1] }
  }
  return ""
}

$webappUrl = Get-EnvValue -Path $EnvPath -Key "WEBAPP_PUBLIC_URL"
if (-not $webappUrl) {
  Write-Error "WEBAPP_PUBLIC_URL missing in $EnvPath"
  exit 1
}

try {
  $uri = [Uri]$webappUrl
} catch {
  Write-Error "WEBAPP_PUBLIC_URL is not a valid URL: $webappUrl"
  exit 1
}

$webHost = $uri.Host
$parts = $webHost.Split(".")
$root = if ($parts.Length -ge 2) { "$($parts[$parts.Length - 2]).$($parts[$parts.Length - 1])" } else { $webHost }

Write-Host "WEBAPP_PUBLIC_URL: $webappUrl" -ForegroundColor Cyan
Write-Host "Host: $webHost" -ForegroundColor Cyan
Write-Host "Root domain: $root" -ForegroundColor Cyan
Write-Host ""

try {
  $ns = Resolve-DnsName -Type NS $root -ErrorAction Stop | Select-Object -ExpandProperty NameHost
  Write-Host ("NS: " + ($ns -join ", ")) -ForegroundColor Green
} catch {
  Write-Host "NS lookup failed." -ForegroundColor Yellow
}

Write-Host ""
try {
  $records = Resolve-DnsName $webHost -ErrorAction Stop
  $records | Format-Table -AutoSize
} catch {
  Write-Host "Host resolve failed: $webHost" -ForegroundColor Yellow
}

Write-Host ""
$base = "$($uri.Scheme)://$($uri.Host)"
$paths = @("/health", "/webapp")
$httpsFailures = 0
foreach ($p in $paths) {
  $url = "$base$p"
  try {
    $res = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 12
    Write-Host ("OK   " + $url + " -> " + $res.StatusCode) -ForegroundColor Green
  } catch {
    $msg = $_.Exception.Message
    Write-Host ("FAIL " + $url + " -> " + $msg) -ForegroundColor Yellow
    if ($url -like "https://*") {
      $httpsFailures += 1
    }
  }
}

Write-Host ""
try {
  $httpHealth = Invoke-WebRequest -UseBasicParsing "http://$webHost/health" -TimeoutSec 12
  $code = [int]$httpHealth.StatusCode
  Write-Host ("HTTP fallback check: http://$webHost/health -> " + $code) -ForegroundColor Cyan
} catch {
  $raw = ""
  if ($_.Exception.Response) {
    try {
      $stream = $_.Exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $raw = $reader.ReadToEnd()
      }
    } catch {}
  }
  $msg = $_.Exception.Message
  Write-Host ("HTTP fallback failed: " + $msg) -ForegroundColor Yellow
  if ($raw) {
    Write-Host ("HTTP body: " + $raw.Trim()) -ForegroundColor Yellow
  }
  if ($raw -match "error code:\s*1001") {
    Write-Host ""
    Write-Host "Detected Cloudflare 1001. This usually means custom domain is not active on Render yet." -ForegroundColor Red
    Write-Host "Fix:" -ForegroundColor Cyan
    Write-Host "  1) Render -> airdropkral-admin -> Settings -> Custom Domains"
    Write-Host "  2) Add host: $webHost"
    Write-Host "  3) Wait SSL certificate to become Active"
    Write-Host "  4) Keep Namecheap CNAME: $webHost -> airdropkral-admin.onrender.com"
  }
}

if ($httpsFailures -gt 0) {
  Write-Host ""
  Write-Host "If HTTPS still fails, do local tunnel fallback:" -ForegroundColor Cyan
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/use_ngrok_local.ps1 -StartAdmin -StartBot"
}
