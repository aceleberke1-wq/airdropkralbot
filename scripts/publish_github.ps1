param(
  [string]$RepoName = "airdropkralbot",
  [string]$Owner = "",
  [ValidateSet("private", "public")]
  [string]$Visibility = "private",
  [switch]$InitOnly
)

$ErrorActionPreference = "Stop"

function Resolve-ToolPath {
  param(
    [string]$Name,
    [string[]]$Fallbacks
  )
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }
  foreach ($path in $Fallbacks) {
    if (Test-Path $path) {
      return $path
    }
  }
  return $null
}

function Invoke-Tool {
  param(
    [string]$Exe,
    [string[]]$Args
  )
  $output = & $Exe @Args 2>&1
  $code = $LASTEXITCODE
  return @{
    Code = $code
    Out = $output
  }
}

function Ensure-Success {
  param(
    [string]$Name,
    [hashtable]$Result
  )
  if ($Result.Code -ne 0) {
    $outText = ""
    if ($Result.Out) {
      $outText = ($Result.Out | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    }
    throw "$Name basarisiz (exit=$($Result.Code)).`n$outText"
  }
}

function Resolve-GitHubOwner {
  param(
    [string]$GhExe,
    [string]$ExplicitOwner
  )
  if ($ExplicitOwner) {
    return $ExplicitOwner
  }

  $res = Invoke-Tool -Exe $GhExe -Args @("api", "user", "-q", ".login")
  Ensure-Success -Name "gh api user" -Result $res
  $candidate = ($res.Out | Select-Object -First 1).ToString().Trim()

  if ($candidate -notmatch "^[A-Za-z0-9-]+$") {
    throw "GitHub owner gecersiz/alinemedi: '$candidate'. -Owner parametresi ver."
  }
  return $candidate
}

$repoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $repoPath
try {
  $git = Resolve-ToolPath -Name "git" -Fallbacks @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe"
  )
  if (-not $git) {
    throw "git bulunamadi. Once kur: winget install --id Git.Git -e"
  }
  $gitDir = Split-Path $git -Parent
  if ($env:PATH -notlike "*$gitDir*") {
    $env:PATH = "$gitDir;$env:PATH"
  }

  $gh = Resolve-ToolPath -Name "gh" -Fallbacks @(
    "C:\Program Files\GitHub CLI\gh.exe"
  )
  if (-not $gh -and -not $InitOnly) {
    throw "gh bulunamadi. Once kur: winget install --id GitHub.cli -e"
  }

  foreach ($junk in @("node", "npm")) {
    if (Test-Path $junk) {
      $item = Get-Item $junk
      if (-not $item.PSIsContainer -and $item.Length -eq 0) {
        Remove-Item $junk -Force
        Write-Host "Temizlik: sifir byte dosya silindi -> $junk"
      }
    }
  }

  if (-not (Test-Path ".git")) {
    & $git init -b main | Out-Null
    Write-Host "Git init tamam (main)."
  } else {
    & $git branch -M main | Out-Null
  }

  $userName = (& $git config --get user.name 2>$null)
  $userEmail = (& $git config --get user.email 2>$null)
  if (-not $userName) {
    & $git config user.name $env:USERNAME
    Write-Host "git user.name local ayarlandi -> $env:USERNAME"
  }
  if (-not $userEmail) {
    $fallbackEmail = "$($env:USERNAME)@users.noreply.github.com"
    & $git config user.email $fallbackEmail
    Write-Host "git user.email local ayarlandi -> $fallbackEmail"
  }

  & $git add -A

  $staged = & $git diff --cached --name-only
  if ($staged) {
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    & $git commit -m "chore: bootstrap deploy state ($stamp)" | Out-Null
    Write-Host "Commit olusturuldu."
  } else {
    Write-Host "Commitlenecek degisiklik yok."
  }

  if ($InitOnly) {
    Write-Host ""
    Write-Host "InitOnly aktif. Remote/push atlandi."
    Write-Host "Sonraki adim: gh auth login + gh repo create"
    exit 0
  }

  $authCheck = Invoke-Tool -Exe $gh -Args @("auth", "status")
  if ($authCheck.Code -ne 0) {
    Write-Host "GitHub oturumu yok. Sunu calistir:" -ForegroundColor Yellow
    Write-Host "  gh auth login -w"
    throw "GitHub auth gerekli."
  }

  $repoNameOnly = $RepoName
  if ($repoNameOnly -match "/") {
    $repoNameOnly = $repoNameOnly.Split("/")[-1]
  }
  if ($repoNameOnly -notmatch "^[A-Za-z0-9._-]+$") {
    throw "RepoName gecersiz: $RepoName"
  }

  $fullRepo = $RepoName
  if ($RepoName -notmatch "/") {
    $ownerResolved = Resolve-GitHubOwner -GhExe $gh -ExplicitOwner $Owner
    $fullRepo = "$ownerResolved/$repoNameOnly"
  }

  $visibilityFlag = if ($Visibility -eq "private") { "--private" } else { "--public" }
  $repoView = Invoke-Tool -Exe $gh -Args @("repo", "view", $fullRepo)
  if ($repoView.Code -ne 0) {
    Write-Host "Repo olusturuluyor: $fullRepo ($Visibility)"
    $createRes = Invoke-Tool -Exe $gh -Args @("repo", "create", $fullRepo, $visibilityFlag, "--source", ".", "--remote", "origin", "--push")
    Ensure-Success -Name "gh repo create --push" -Result $createRes
  } else {
    Write-Host "Repo zaten var: $fullRepo"
    $remoteUrl = "https://github.com/$fullRepo.git"
    $remoteGet = Invoke-Tool -Exe $git -Args @("remote", "get-url", "origin")
    if ($remoteGet.Code -ne 0) {
      $addRemote = Invoke-Tool -Exe $git -Args @("remote", "add", "origin", $remoteUrl)
      Ensure-Success -Name "git remote add origin" -Result $addRemote
    } else {
      $setRemote = Invoke-Tool -Exe $git -Args @("remote", "set-url", "origin", $remoteUrl)
      Ensure-Success -Name "git remote set-url origin" -Result $setRemote
    }
    $pushRes = Invoke-Tool -Exe $git -Args @("push", "-u", "origin", "main")
    Ensure-Success -Name "git push origin main" -Result $pushRes
  }

  Write-Host ""
  Write-Host "Tamam. GitHub push bitti: https://github.com/$fullRepo" -ForegroundColor Green
  Write-Host "Render'da bu repoyu secip render.yaml ile deploy edebilirsin."
}
finally {
  Pop-Location
}
