param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

function Convert-ScalarOutput {
  param([object]$Value)
  if ($null -eq $Value) {
    return ""
  }
  if ($Value -is [System.Array]) {
    if ($Value.Length -eq 0) {
      return ""
    }
    return ($Value -join "`n").Trim()
  }
  return "$Value".Trim()
}

function Load-EnvIfNeeded {
  if (-not $DatabaseUrl -and (Test-Path ".env")) {
    Get-Content ".env" | ForEach-Object {
      if ($_ -match "^\s*#") { return }
      if ($_ -match "^\s*$") { return }
      $parts = $_ -split "=", 2
      if ($parts.Length -eq 2) {
        $name = $parts[0].Trim()
        $value = $parts[1].Trim()
        if ($name -and $value) {
          Set-Item -Path "Env:$name" -Value $value
        }
      }
    }
    $script:DatabaseUrl = $env:DATABASE_URL
  }
}

Load-EnvIfNeeded

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is required"
  exit 1
}

$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
$psqlPath = $null

if (-not $psqlCmd) {
  if ($env:PGBIN) {
    $candidate = Join-Path $env:PGBIN "psql.exe"
    if (Test-Path $candidate) {
      $psqlPath = $candidate
    }
  }

  if (-not $psqlPath -and (Test-Path "C:\Program Files\PostgreSQL")) {
    $pgDir = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory | Sort-Object Name -Descending | Select-Object -First 1
    if ($pgDir) {
      $candidate = Join-Path $pgDir.FullName "bin\psql.exe"
      if (Test-Path $candidate) {
        $psqlPath = $candidate
      }
    }
  }
}

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
$dockerComposeCmd = Get-Command docker-compose -ErrorAction SilentlyContinue

$mode = $null
$psqlExec = $null
if ($psqlCmd) {
  $mode = "local"
  $psqlExec = $psqlCmd.Source
} elseif ($psqlPath) {
  $mode = "local"
  $psqlExec = $psqlPath
} elseif ($dockerCmd) {
  $mode = "docker"
} elseif ($dockerComposeCmd) {
  $mode = "docker-compose"
} else {
  Write-Error "Neither psql nor docker compose is available. Install Postgres or Docker."
  exit 1
}

function Invoke-DbSql {
  param(
    [string]$Sql,
    [switch]$Scalar
  )

  if ($mode -eq "local") {
    if ($Scalar) {
      return Convert-ScalarOutput (& $psqlExec $DatabaseUrl -t -A -v ON_ERROR_STOP=1 -c $Sql)
    }
    & $psqlExec $DatabaseUrl -v ON_ERROR_STOP=1 -c $Sql | Out-Null
    return ""
  }

  if ($mode -eq "docker") {
    $args = @("compose", "exec", "-T", "postgres", "psql", $DatabaseUrl, "-v", "ON_ERROR_STOP=1")
    if ($Scalar) {
      $args += @("-t", "-A", "-c", $Sql)
      return Convert-ScalarOutput (& docker @args)
    }
    $args += @("-c", $Sql)
    & docker @args | Out-Null
    return ""
  }

  $composeArgs = @("exec", "-T", "postgres", "psql", $DatabaseUrl, "-v", "ON_ERROR_STOP=1")
  if ($Scalar) {
    $composeArgs += @("-t", "-A", "-c", $Sql)
    return Convert-ScalarOutput (& docker-compose @composeArgs)
  }
  $composeArgs += @("-c", $Sql)
  & docker-compose @composeArgs | Out-Null
  return ""
}

function Invoke-DbFile {
  param([string]$FilePath)

  if ($mode -eq "local") {
    & $psqlExec $DatabaseUrl -v ON_ERROR_STOP=1 -f $FilePath | Out-Null
    return
  }

  if ($mode -eq "docker") {
    $args = @("compose", "exec", "-T", "postgres", "psql", $DatabaseUrl, "-v", "ON_ERROR_STOP=1")
    Get-Content $FilePath -Raw | docker @args | Out-Null
    return
  }

  Get-Content $FilePath -Raw | docker-compose exec -T postgres psql $DatabaseUrl -v ON_ERROR_STOP=1 | Out-Null
}

Invoke-DbSql "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());"

$existingRows = Invoke-DbSql -Sql "SELECT count(*) FROM schema_migrations;" -Scalar
$schemaEmpty = [int]$existingRows -eq 0

if ($schemaEmpty) {
  $hasUsersTable = Invoke-DbSql -Sql "SELECT CASE WHEN to_regclass('public.users') IS NULL THEN '0' ELSE '1' END;" -Scalar
  if ($hasUsersTable -eq "1") {
    $baseline = @("V001__init.sql", "V002__indexes.sql", "V003__constraints.sql")
    foreach ($name in $baseline) {
      $safe = $name.Replace("'", "''")
      Invoke-DbSql -Sql "INSERT INTO schema_migrations (filename) VALUES ('$safe') ON CONFLICT DO NOTHING;"
      Write-Host "Baselined $name"
    }
  }
}

$files = Get-ChildItem -Path "db/migrations" -Filter "*.sql" | Sort-Object Name

foreach ($file in $files) {
  $safeName = $file.Name.Replace("'", "''")
  $exists = Invoke-DbSql -Sql "SELECT 1 FROM schema_migrations WHERE filename = '$safeName' LIMIT 1;" -Scalar

  if ($exists -eq "1") {
    Write-Host "Skipping $($file.Name) (already applied)"
    continue
  }

  Write-Host "Applying $($file.Name)"
  Invoke-DbFile -FilePath $file.FullName
  Invoke-DbSql "INSERT INTO schema_migrations (filename) VALUES ('$safeName');"
}
