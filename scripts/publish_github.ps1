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
    [string[]]$CommandArgs
  )
  $output = & $Exe @CommandArgs 2>&1
  $code = $LASTEXITCODE
  return @{
    Code = $code
    Out = $output
  }
}

function Invoke-GhSafe {
  param(
    [string]$GhExe,
    [string[]]$CommandArgs,
    [switch]$Silent
  )
  $prevPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    if ($Silent) {
      $output = & $GhExe @CommandArgs 2>$null
    } else {
      $output = & $GhExe @CommandArgs 2>&1
    }
    return @{
      Code = $LASTEXITCODE
      Out = $output
    }
  }
  finally {
    $ErrorActionPreference = $prevPreference
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

  $res = Invoke-GhSafe -GhExe $GhExe -CommandArgs @("api", "user", "-q", ".login") -Silent
  if ($res.Code -ne 0 -or -not $res.Out) {
    throw "gh api user basarisiz. gh auth login -w ile tekrar giris yap."
  }
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

  $authCheck = Invoke-GhSafe -GhExe $gh -CommandArgs @("auth", "status") -Silent
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
  $repoView = Invoke-GhSafe -GhExe $gh -CommandArgs @("repo", "view", $fullRepo, "--json", "nameWithOwner") -Silent
  $repoExists = ($repoView.Code -eq 0)
  if (-not $repoExists) {
    Write-Host "Repo olusturuluyor: $fullRepo ($Visibility)"
    $createRes = Invoke-GhSafe -GhExe $gh -CommandArgs @("repo", "create", $fullRepo, $visibilityFlag)
    if ($createRes.Code -ne 0) {
      $detail = ($createRes.Out | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
      throw "gh repo create basarisiz.`n$detail"
    }
  } else {
    Write-Host "Repo zaten var: $fullRepo"
  }

  $remoteUrl = "https://github.com/$fullRepo.git"
  $originUrl = & $git remote get-url origin 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $originUrl) {
    & $git remote add origin $remoteUrl
    if ($LASTEXITCODE -ne 0) {
      throw "git remote add origin basarisiz."
    }
  } else {
    & $git remote set-url origin $remoteUrl
    if ($LASTEXITCODE -ne 0) {
      throw "git remote set-url origin basarisiz."
    }
  }
  & $git push -u origin main
  if ($LASTEXITCODE -ne 0) {
    throw "git push origin main basarisiz."
  }

  Write-Host ""
  Write-Host "Tamam. GitHub push bitti: https://github.com/$fullRepo" -ForegroundColor Green
  Write-Host "Render'da bu repoyu secip render.yaml ile deploy edebilirsin."
}
finally {
  Pop-Location
}
