param(
  [string]$RepoName = "airdropkralbot",
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

  $fullRepo = $RepoName
  if ($RepoName -notmatch "/") {
    $userRes = Invoke-Tool -Exe $gh -Args @("api", "user", "--jq", ".login")
    if ($userRes.Code -ne 0 -or -not $userRes.Out) {
      throw "GitHub kullanici adi alinamadi."
    }
    $owner = ($userRes.Out | Select-Object -First 1).ToString().Trim()
    $fullRepo = "$owner/$RepoName"
  }

  $visibilityFlag = if ($Visibility -eq "private") { "--private" } else { "--public" }
  $repoView = Invoke-Tool -Exe $gh -Args @("repo", "view", $fullRepo)
  if ($repoView.Code -ne 0) {
    Write-Host "Repo olusturuluyor: $fullRepo ($Visibility)"
    $createRes = Invoke-Tool -Exe $gh -Args @("repo", "create", $fullRepo, $visibilityFlag, "--source", ".", "--remote", "origin", "--push")
    if ($createRes.Code -ne 0) {
      throw "Repo olusturma/push basarisiz: $($createRes.Out -join [Environment]::NewLine)"
    }
  } else {
    Write-Host "Repo zaten var: $fullRepo"
    $remoteUrl = "https://github.com/$fullRepo.git"
    $remoteGet = Invoke-Tool -Exe $git -Args @("remote", "get-url", "origin")
    if ($remoteGet.Code -ne 0) {
      & $git remote add origin $remoteUrl
    } else {
      & $git remote set-url origin $remoteUrl
    }
    & $git push -u origin main
  }

  Write-Host ""
  Write-Host "Tamam. GitHub push bitti: https://github.com/$fullRepo" -ForegroundColor Green
  Write-Host "Render'da bu repoyu secip render.yaml ile deploy edebilirsin."
}
finally {
  Pop-Location
}
