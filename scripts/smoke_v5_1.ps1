$ErrorActionPreference = "Stop"

function Read-EnvMap {
  param([string]$Path)
  $map = @{}
  foreach ($line in Get-Content -Path $Path) {
    $trim = $line.Trim()
    if (-not $trim -or $trim.StartsWith("#")) {
      continue
    }
    $idx = $trim.IndexOf("=")
    if ($idx -lt 1) {
      continue
    }
    $k = $trim.Substring(0, $idx).Trim()
    $v = $trim.Substring($idx + 1)
    $map[$k] = $v
  }
  return $map
}

function New-HmacSig {
  param(
    [string]$Uid,
    [string]$Ts,
    [string]$Secret
  )
  $hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($Secret))
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes("$Uid.$Ts")
    $hash = $hmac.ComputeHash($bytes)
    return (($hash | ForEach-Object { $_.ToString("x2") }) -join "")
  }
  finally {
    $hmac.Dispose()
  }
}

function Invoke-WebRequestCompat {
  param(
    [string]$Uri,
    [string]$Method = "GET",
    [int]$TimeoutSec = 20,
    [hashtable]$Headers = @{},
    [string]$Body = "",
    [string]$ContentType = ""
  )
  $params = @{
    Uri = $Uri
    Method = $Method
    TimeoutSec = $TimeoutSec
  }
  if ((Get-Command Invoke-WebRequest).Parameters.ContainsKey("UseBasicParsing")) {
    $params.UseBasicParsing = $true
  }
  if ($Headers -and $Headers.Count -gt 0) {
    $params.Headers = $Headers
  }
  if (-not [string]::IsNullOrWhiteSpace($Body)) {
    $params.Body = $Body
  }
  if (-not [string]::IsNullOrWhiteSpace($ContentType)) {
    $params.ContentType = $ContentType
  }
  return Invoke-WebRequest @params
}

function Invoke-V2Get {
  param(
    [string]$Path,
    [string]$Uid,
    [string]$Secret
  )
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
  $sig = New-HmacSig -Uid $Uid -Ts $ts -Secret $Secret
  $join = if ($Path.Contains("?")) { "&" } else { "?" }
  $url = "http://127.0.0.1:4000$Path${join}uid=$Uid&ts=$ts&sig=$sig"
  try {
    $resp = Invoke-WebRequestCompat -Uri $url -Method "GET" -TimeoutSec 20
    return [pscustomobject]@{
      StatusCode = [int]$resp.StatusCode
      Body = ($resp.Content | ConvertFrom-Json)
    }
  }
  catch {
    $statusCode = 500
    $content = ""
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $content = [string]$_.ErrorDetails.Message
    } elseif ($_.Exception.Response) {
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        try {
          $content = $reader.ReadToEnd()
        }
        finally {
          $reader.Dispose()
        }
      }
      catch {
      }
    }
    $parsedBody = $null
    if (-not [string]::IsNullOrWhiteSpace($content)) {
      try {
        $parsedBody = $content | ConvertFrom-Json
      }
      catch {
        $parsedBody = $content
      }
    }
    return [pscustomobject]@{
      StatusCode = $statusCode
      Body = $parsedBody
    }
  }
}

function Invoke-V2Post {
  param(
    [string]$Path,
    [hashtable]$Body,
    [string]$Uid,
    [string]$Secret
  )
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
  $sig = New-HmacSig -Uid $Uid -Ts $ts -Secret $Secret
  $payload = @{
    uid = $Uid
    ts = $ts
    sig = $sig
  }
  foreach ($k in $Body.Keys) {
    $payload[$k] = $Body[$k]
  }
  try {
    $resp = Invoke-WebRequestCompat -Uri "http://127.0.0.1:4000$Path" -Method "POST" -TimeoutSec 20 -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 8)
    return [pscustomobject]@{
      StatusCode = [int]$resp.StatusCode
      Body = ($resp.Content | ConvertFrom-Json)
    }
  }
  catch {
    $statusCode = 500
    $content = ""
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $content = [string]$_.ErrorDetails.Message
    } elseif ($_.Exception.Response) {
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        try {
          $content = $reader.ReadToEnd()
        }
        finally {
          $reader.Dispose()
        }
      }
      catch {
      }
    }
    $parsedBody = $null
    if (-not [string]::IsNullOrWhiteSpace($content)) {
      try {
        $parsedBody = $content | ConvertFrom-Json
      }
      catch {
        $parsedBody = $content
      }
    }
    return [pscustomobject]@{
      StatusCode = $statusCode
      Body = $parsedBody
    }
  }
}

function Get-ResponseNote {
  param(
    [object]$Body,
    [string]$Fallback = ""
  )
  if ($null -eq $Body) {
    return $Fallback
  }
  if ($Body -is [string]) {
    return [string]$Body
  }
  if ($Body.error) {
    return [string]$Body.error
  }
  if ($Body.message) {
    return [string]$Body.message
  }
  if ($Body.statusCode -and $Body.code) {
    return "$($Body.code): $($Body.statusCode)"
  }
  if ($Body.data -and $Body.data.error) {
    return [string]$Body.data.error
  }
  return $Fallback
}

function Invoke-NodeJson {
  param([string[]]$NodeArgs)
  $raw = & node @NodeArgs
  if ($LASTEXITCODE -ne 0) {
    throw ("node command failed: " + ($NodeArgs -join " "))
  }
  $text = ($raw | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($text)) {
    return $null
  }
  return ($text | ConvertFrom-Json)
}

function Assert-SmokeResult {
  param(
    [System.Collections.Generic.List[string]]$Failures,
    [array]$Results,
    [string]$Endpoint,
    [int[]]$ExpectedStatus,
    [Nullable[bool]]$ExpectedSuccess = $null
  )
  $row = $Results | Where-Object { $_.endpoint -eq $Endpoint } | Select-Object -First 1
  if (-not $row) {
    $Failures.Add("missing_result:$Endpoint")
    return
  }
  $actualStatus = [int]($row.status)
  if ($ExpectedStatus -and ($ExpectedStatus -notcontains $actualStatus)) {
    $Failures.Add("status_mismatch:$Endpoint expected=$($ExpectedStatus -join ',') actual=$actualStatus note=$($row.note)")
  }
  if ($null -ne $ExpectedSuccess) {
    $actualSuccess = [bool]$row.success
    if ($actualSuccess -ne [bool]$ExpectedSuccess) {
      $Failures.Add("success_mismatch:$Endpoint expected=$ExpectedSuccess actual=$actualSuccess note=$($row.note)")
    }
  }
}

function Assert-ObjectHasKeys {
  param(
    [System.Collections.Generic.List[string]]$Failures,
    [object]$Object,
    [string[]]$Keys,
    [string]$Context
  )
  if ($null -eq $Object) {
    $Failures.Add("missing_object:$Context")
    return
  }
  foreach ($key in $Keys) {
    $exists = $false
    if ($Object -is [hashtable]) {
      $exists = $Object.ContainsKey($key)
    }
    else {
      $exists = $null -ne $Object.PSObject.Properties[$key]
    }
    if (-not $exists) {
      $Failures.Add("missing_key:$Context.$key")
    }
  }
}

$envMap = Read-EnvMap -Path ".env"
$uid = [string]$envMap["ADMIN_TELEGRAM_ID"]
$secret = [string]$envMap["WEBAPP_HMAC_SECRET"]
if (-not $uid -or -not $secret) {
  throw "ADMIN_TELEGRAM_ID or WEBAPP_HMAC_SECRET missing in .env"
}

$started = $false
$proc = $null
$fixtureRequestId = 0
$fixtureKycUserId = 0
try {
  $healthy = $false
  try {
    $hz = Invoke-WebRequestCompat -Uri "http://127.0.0.1:4000/healthz" -Method "GET" -TimeoutSec 2
    if ($hz.StatusCode -eq 200) {
      $healthy = $true
    }
  }
  catch {
  }

  if (-not $healthy) {
    $outLog = Join-Path $PWD "tmp.admin-api.out.log"
    $errLog = Join-Path $PWD "tmp.admin-api.err.log"
    if (Test-Path $outLog) { Remove-Item $outLog -Force }
    if (Test-Path $errLog) { Remove-Item $errLog -Force }
    $proc = Start-Process -FilePath "node" -ArgumentList "apps/admin-api/src/index.js" -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    $started = $true
    for ($i = 0; $i -lt 30; $i++) {
      Start-Sleep -Milliseconds 500
      try {
        $hz = Invoke-WebRequestCompat -Uri "http://127.0.0.1:4000/healthz" -Method "GET" -TimeoutSec 2
        if ($hz.StatusCode -eq 200) {
          $healthy = $true
          break
        }
      }
      catch {
      }
    }
  }

  if (-not $healthy) {
    throw "admin-api did not become healthy on :4000"
  }

  $results = @()
  $fixture = Invoke-NodeJson -NodeArgs @("scripts/smoke_v5_1_fixture.mjs", "setup")
  if ($fixture -and $fixture.ok -and [int]$fixture.request_id -gt 0) {
    $fixtureRequestId = [int]$fixture.request_id
  }
  if ($fixture -and [int]$fixture.kyc_user_id -gt 0) {
    $fixtureKycUserId = [int]$fixture.kyc_user_id
  }
  if ($fixtureRequestId -le 0) {
    throw "fixture seed failed for queue action smoke"
  }
  $results += [pscustomobject]@{
    endpoint = "FIXTURE setup"
    status = 200
    success = [bool]$fixture.ok
    api_version = "local"
    note = ("request_id=" + $fixtureRequestId + " kyc_user_id=" + $fixtureKycUserId + " admin_user_id=" + [int]($fixture.admin_user_id))
  }

  $boot = Invoke-V2Get -Path "/webapp/api/v2/bootstrap?lang=tr" -Uid $uid -Secret $secret
  $results += [pscustomobject]@{
    endpoint = "GET /webapp/api/v2/bootstrap"
    status = $boot.StatusCode
    success = [bool]$boot.Body.success
    api_version = [string]$boot.Body.data.api_version
    note = Get-ResponseNote -Body $boot.Body
  }

  $catalog = Invoke-V2Get -Path "/webapp/api/v2/commands/catalog?lang=tr&include_admin=1&include_non_primary=0" -Uid $uid -Secret $secret
  $catalogCount = 0
  if ($catalog.Body.data -and $catalog.Body.data.commands) {
    $catalogCount = @($catalog.Body.data.commands).Count
  }
  $results += [pscustomobject]@{
    endpoint = "GET /webapp/api/v2/commands/catalog"
    status = $catalog.StatusCode
    success = [bool]$catalog.Body.success
    api_version = [string]$catalog.Body.data.api_version
    note = "commands=$catalogCount"
  }

  $monoCatalog = Invoke-V2Get -Path "/webapp/api/v2/monetization/catalog?lang=tr" -Uid $uid -Secret $secret
  $monoPassCount = 0
  $monoEnabled = $false
  if ($monoCatalog.Body.data -and $monoCatalog.Body.data.pass_catalog) {
    $monoPassCount = @($monoCatalog.Body.data.pass_catalog).Count
  }
  if ($monoCatalog.Body.data) {
    $monoEnabled = [bool]$monoCatalog.Body.data.enabled
  }
  $results += [pscustomobject]@{
    endpoint = "GET /webapp/api/v2/monetization/catalog"
    status = $monoCatalog.StatusCode
    success = [bool]$monoCatalog.Body.success
    api_version = [string]$monoCatalog.Body.data.api_version
    note = "enabled=$monoEnabled pass_catalog=$monoPassCount"
  }

  $monoStatus = Invoke-V2Get -Path "/webapp/api/v2/monetization/status?lang=tr" -Uid $uid -Secret $secret
  $monoActivePass = 0
  $monoOwnedCosmetics = 0
  if ($monoStatus.Body.data -and $monoStatus.Body.data.monetization) {
    if ($monoStatus.Body.data.monetization.active_passes) {
      $monoActivePass = @($monoStatus.Body.data.monetization.active_passes).Count
    }
    if ($monoStatus.Body.data.monetization.cosmetics) {
      $monoOwnedCosmetics = [int]$monoStatus.Body.data.monetization.cosmetics.owned_count
    }
  }
  $results += [pscustomobject]@{
    endpoint = "GET /webapp/api/v2/monetization/status"
    status = $monoStatus.StatusCode
    success = [bool]$monoStatus.Body.success
    api_version = [string]$monoStatus.Body.data.api_version
    note = "active_pass=$monoActivePass cosmetics=$monoOwnedCosmetics"
  }

  $payout = Invoke-V2Get -Path "/webapp/api/v2/payout/status" -Uid $uid -Secret $secret
  $results += [pscustomobject]@{
    endpoint = "GET /webapp/api/v2/payout/status"
    status = $payout.StatusCode
    success = [bool]$payout.Body.success
    api_version = [string]$payout.Body.data.api_version
    note = Get-ResponseNote -Body $payout.Body
  }

  $pvp = Invoke-V2Get -Path "/webapp/api/v2/pvp/progression" -Uid $uid -Secret $secret
  $hasModel = $false
  if ($pvp.Body.data -and $pvp.Body.data.read_model) {
    $hasModel = $true
  }
  $results += [pscustomobject]@{
    endpoint = "GET /webapp/api/v2/pvp/progression"
    status = $pvp.StatusCode
    success = [bool]$pvp.Body.success
    api_version = [string]$pvp.Body.data.api_version
    note = "read_model=$hasModel"
  }

  $wallet = Invoke-V2Get -Path "/webapp/api/v2/wallet/session" -Uid $uid -Secret $secret
  $walletActive = $false
  $walletEnabled = $false
  if ($wallet.Body.data -and $wallet.Body.data.wallet_session) {
    $walletActive = [bool]$wallet.Body.data.wallet_session.active
  }
  if ($wallet.Body.data -and $wallet.Body.data.wallet_capabilities) {
    $walletEnabled = [bool]$wallet.Body.data.wallet_capabilities.enabled
  }
  $results += [pscustomobject]@{
    endpoint = "GET /webapp/api/v2/wallet/session"
    status = $wallet.StatusCode
    success = [bool]$wallet.Body.success
    api_version = [string]$wallet.Body.data.api_version
    note = "wallet_enabled=$walletEnabled wallet_active=$walletActive"
  }

  if ($walletEnabled) {
    $walletAddress = "0x000000000000000000000000000000000000dEaD"
    $walletChallenge = Invoke-V2Post -Path "/webapp/api/v2/wallet/challenge" -Body @{
      chain = "eth"
      address = $walletAddress
      statement = "smoke wallet challenge"
    } -Uid $uid -Secret $secret
    $challengeRef = ""
    $challengeMessage = ""
    if ($walletChallenge.Body -and $walletChallenge.Body.data -and $walletChallenge.Body.data.challenge) {
      $challengeRef = [string]$walletChallenge.Body.data.challenge.challenge_ref
      $challengeMessage = [string]$walletChallenge.Body.data.challenge.challenge_text
    }
    $results += [pscustomobject]@{
      endpoint = "POST /webapp/api/v2/wallet/challenge"
      status = $walletChallenge.StatusCode
      success = [bool]$walletChallenge.Body.success
      api_version = [string]$walletChallenge.Body.data.api_version
      note = ("challenge_ref=" + [bool](-not [string]::IsNullOrWhiteSpace($challengeRef)))
    }

    if (-not [string]::IsNullOrWhiteSpace($challengeRef) -and -not [string]::IsNullOrWhiteSpace($challengeMessage)) {
      $walletVerify = Invoke-V2Post -Path "/webapp/api/v2/wallet/verify" -Body @{
        challenge_ref = $challengeRef
        chain = "eth"
        address = $walletAddress
        message = $challengeMessage
        signature = ("0x" + ("a" * 130))
      } -Uid $uid -Secret $secret
      $walletVerifyActive = $false
      if ($walletVerify.Body -and $walletVerify.Body.data -and $walletVerify.Body.data.wallet_session) {
        $walletVerifyActive = [bool]$walletVerify.Body.data.wallet_session.active
      }
      $results += [pscustomobject]@{
        endpoint = "POST /webapp/api/v2/wallet/verify"
        status = $walletVerify.StatusCode
        success = [bool]$walletVerify.Body.success
        api_version = [string]$walletVerify.Body.data.api_version
        note = "wallet_active_after_verify=$walletVerifyActive"
      }

      $walletUnlink = Invoke-V2Post -Path "/webapp/api/v2/wallet/unlink" -Body @{
        chain = "eth"
        address = $walletAddress
        reason = "smoke_cleanup"
      } -Uid $uid -Secret $secret
      $results += [pscustomobject]@{
        endpoint = "POST /webapp/api/v2/wallet/unlink"
        status = $walletUnlink.StatusCode
        success = [bool]$walletUnlink.Body.success
        api_version = [string]$walletUnlink.Body.data.api_version
        note = ("unlinked=" + [int]($walletUnlink.Body.data.unlinked_count))
      }
    }
  }

  $queue = Invoke-V2Get -Path "/webapp/api/v2/admin/queue/unified" -Uid $uid -Secret $secret
  $qCount = 0
  if ($queue.Body.data -and $queue.Body.data.items) {
    $qCount = @($queue.Body.data.items).Count
  }
  $results += [pscustomobject]@{
    endpoint = "GET /webapp/api/v2/admin/queue/unified"
    status = $queue.StatusCode
    success = [bool]$queue.Body.success
    api_version = [string]$queue.Body.data.api_version
    note = "items=$qCount"
  }

  # Dry smoke: 2-step confirmation + cooldown rails for unified queue action.
  $queueActionStep1 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
    action_key = "payout_reject"
    kind = "payout_request"
    request_id = $fixtureRequestId
    reason = "smoke_probe"
  } -Uid $uid -Secret $secret
  $confirmToken1 = ""
  if ($queueActionStep1.Body -and $queueActionStep1.Body.data -and $queueActionStep1.Body.data.confirm_token) {
    $confirmToken1 = [string]$queueActionStep1.Body.data.confirm_token
  }
  $results += [pscustomobject]@{
    endpoint = "POST /webapp/api/v2/admin/queue/action (confirm-1)"
    status = $queueActionStep1.StatusCode
    success = [bool]$queueActionStep1.Body.success
    api_version = [string]$queueActionStep1.Body.data.api_version
    note = Get-ResponseNote -Body $queueActionStep1.Body -Fallback ("confirm_token=" + [bool](-not [string]::IsNullOrWhiteSpace($confirmToken1)))
  }

  $queueActionStep2 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
    action_key = "payout_reject"
    kind = "payout_request"
    request_id = $fixtureRequestId
    reason = "smoke_probe"
    confirm_token = $confirmToken1
  } -Uid $uid -Secret $secret
  $results += [pscustomobject]@{
    endpoint = "POST /webapp/api/v2/admin/queue/action (confirm-2)"
    status = $queueActionStep2.StatusCode
    success = [bool]$queueActionStep2.Body.success
    api_version = [string]$queueActionStep2.Body.data.api_version
    note = Get-ResponseNote -Body $queueActionStep2.Body
  }

  $queueActionStep3 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
    action_key = "payout_reject"
    kind = "payout_request"
    request_id = $fixtureRequestId
    reason = "smoke_probe"
  } -Uid $uid -Secret $secret
  $confirmToken2 = ""
  if ($queueActionStep3.Body -and $queueActionStep3.Body.data -and $queueActionStep3.Body.data.confirm_token) {
    $confirmToken2 = [string]$queueActionStep3.Body.data.confirm_token
  }
  $results += [pscustomobject]@{
    endpoint = "POST /webapp/api/v2/admin/queue/action (confirm-3)"
    status = $queueActionStep3.StatusCode
    success = [bool]$queueActionStep3.Body.success
    api_version = [string]$queueActionStep3.Body.data.api_version
    note = Get-ResponseNote -Body $queueActionStep3.Body -Fallback ("confirm_token=" + [bool](-not [string]::IsNullOrWhiteSpace($confirmToken2)))
  }

  $queueActionStep4 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
    action_key = "payout_reject"
    kind = "payout_request"
    request_id = $fixtureRequestId
    reason = "smoke_probe"
    confirm_token = $confirmToken2
  } -Uid $uid -Secret $secret
  $results += [pscustomobject]@{
    endpoint = "POST /webapp/api/v2/admin/queue/action (cooldown)"
    status = $queueActionStep4.StatusCode
    success = [bool]$queueActionStep4.Body.success
    api_version = [string]$queueActionStep4.Body.data.api_version
    note = Get-ResponseNote -Body $queueActionStep4.Body
  }

  if ($fixtureKycUserId -gt 0) {
    $kycActionStep1 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
      action_key = "kyc_approve"
      kind = "kyc_manual_review"
      request_id = $fixtureKycUserId
      reason = "smoke_kyc_probe"
    } -Uid $uid -Secret $secret
    $kycConfirmToken1 = ""
    if ($kycActionStep1.Body -and $kycActionStep1.Body.data -and $kycActionStep1.Body.data.confirm_token) {
      $kycConfirmToken1 = [string]$kycActionStep1.Body.data.confirm_token
    }
    $results += [pscustomobject]@{
      endpoint = "POST /webapp/api/v2/admin/queue/action (kyc-confirm-1)"
      status = $kycActionStep1.StatusCode
      success = [bool]$kycActionStep1.Body.success
      api_version = [string]$kycActionStep1.Body.data.api_version
      note = Get-ResponseNote -Body $kycActionStep1.Body -Fallback ("confirm_token=" + [bool](-not [string]::IsNullOrWhiteSpace($kycConfirmToken1)))
    }

    $kycActionStep2 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
      action_key = "kyc_approve"
      kind = "kyc_manual_review"
      request_id = $fixtureKycUserId
      reason = "smoke_kyc_probe"
      confirm_token = $kycConfirmToken1
    } -Uid $uid -Secret $secret
    $results += [pscustomobject]@{
      endpoint = "POST /webapp/api/v2/admin/queue/action (kyc-confirm-2)"
      status = $kycActionStep2.StatusCode
      success = [bool]$kycActionStep2.Body.success
      api_version = [string]$kycActionStep2.Body.data.api_version
      note = Get-ResponseNote -Body $kycActionStep2.Body
    }

    $kycActionStep3 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
      action_key = "kyc_approve"
      kind = "kyc_manual_review"
      request_id = $fixtureKycUserId
      reason = "smoke_kyc_probe"
    } -Uid $uid -Secret $secret
    $kycConfirmToken2 = ""
    if ($kycActionStep3.Body -and $kycActionStep3.Body.data -and $kycActionStep3.Body.data.confirm_token) {
      $kycConfirmToken2 = [string]$kycActionStep3.Body.data.confirm_token
    }
    $results += [pscustomobject]@{
      endpoint = "POST /webapp/api/v2/admin/queue/action (kyc-confirm-3)"
      status = $kycActionStep3.StatusCode
      success = [bool]$kycActionStep3.Body.success
      api_version = [string]$kycActionStep3.Body.data.api_version
      note = Get-ResponseNote -Body $kycActionStep3.Body -Fallback ("confirm_token=" + [bool](-not [string]::IsNullOrWhiteSpace($kycConfirmToken2)))
    }

    $kycActionStep4 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
      action_key = "kyc_approve"
      kind = "kyc_manual_review"
      request_id = $fixtureKycUserId
      reason = "smoke_kyc_probe"
      confirm_token = $kycConfirmToken2
    } -Uid $uid -Secret $secret
    $results += [pscustomobject]@{
      endpoint = "POST /webapp/api/v2/admin/queue/action (kyc-cooldown)"
      status = $kycActionStep4.StatusCode
      success = [bool]$kycActionStep4.Body.success
      api_version = [string]$kycActionStep4.Body.data.api_version
      note = Get-ResponseNote -Body $kycActionStep4.Body
    }

    $kycRejectStep1 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
      action_key = "kyc_reject"
      kind = "kyc_manual_review"
      request_id = $fixtureKycUserId
      reason = "smoke_kyc_reject"
    } -Uid $uid -Secret $secret
    $kycRejectToken1 = ""
    if ($kycRejectStep1.Body -and $kycRejectStep1.Body.data -and $kycRejectStep1.Body.data.confirm_token) {
      $kycRejectToken1 = [string]$kycRejectStep1.Body.data.confirm_token
    }
    $results += [pscustomobject]@{
      endpoint = "POST /webapp/api/v2/admin/queue/action (kyc-reject-confirm-1)"
      status = $kycRejectStep1.StatusCode
      success = [bool]$kycRejectStep1.Body.success
      api_version = [string]$kycRejectStep1.Body.data.api_version
      note = Get-ResponseNote -Body $kycRejectStep1.Body -Fallback ("confirm_token=" + [bool](-not [string]::IsNullOrWhiteSpace($kycRejectToken1)))
    }

    $kycRejectStep2 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
      action_key = "kyc_reject"
      kind = "kyc_manual_review"
      request_id = $fixtureKycUserId
      reason = "smoke_kyc_reject"
      confirm_token = $kycRejectToken1
    } -Uid $uid -Secret $secret
    $results += [pscustomobject]@{
      endpoint = "POST /webapp/api/v2/admin/queue/action (kyc-reject-confirm-2)"
      status = $kycRejectStep2.StatusCode
      success = [bool]$kycRejectStep2.Body.success
      api_version = [string]$kycRejectStep2.Body.data.api_version
      note = Get-ResponseNote -Body $kycRejectStep2.Body
    }

    $kycBlockStep1 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
      action_key = "kyc_block"
      kind = "kyc_manual_review"
      request_id = $fixtureKycUserId
      reason = "smoke_kyc_block"
    } -Uid $uid -Secret $secret
    $kycBlockToken1 = ""
    if ($kycBlockStep1.Body -and $kycBlockStep1.Body.data -and $kycBlockStep1.Body.data.confirm_token) {
      $kycBlockToken1 = [string]$kycBlockStep1.Body.data.confirm_token
    }
    $results += [pscustomobject]@{
      endpoint = "POST /webapp/api/v2/admin/queue/action (kyc-block-confirm-1)"
      status = $kycBlockStep1.StatusCode
      success = [bool]$kycBlockStep1.Body.success
      api_version = [string]$kycBlockStep1.Body.data.api_version
      note = Get-ResponseNote -Body $kycBlockStep1.Body -Fallback ("confirm_token=" + [bool](-not [string]::IsNullOrWhiteSpace($kycBlockToken1)))
    }

    $kycBlockStep2 = Invoke-V2Post -Path "/webapp/api/v2/admin/queue/action" -Body @{
      action_key = "kyc_block"
      kind = "kyc_manual_review"
      request_id = $fixtureKycUserId
      reason = "smoke_kyc_block"
      confirm_token = $kycBlockToken1
    } -Uid $uid -Secret $secret
    $results += [pscustomobject]@{
      endpoint = "POST /webapp/api/v2/admin/queue/action (kyc-block-confirm-2)"
      status = $kycBlockStep2.StatusCode
      success = [bool]$kycBlockStep2.Body.success
      api_version = [string]$kycBlockStep2.Body.data.api_version
      note = Get-ResponseNote -Body $kycBlockStep2.Body
    }
  } else {
    $results += [pscustomobject]@{
      endpoint = "POST /webapp/api/v2/admin/queue/action (kyc)"
      status = 0
      success = $false
      api_version = ""
      note = "skipped:kyc_fixture_unavailable"
    }
  }

  $assertFailures = New-Object 'System.Collections.Generic.List[string]'
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "GET /webapp/api/v2/bootstrap" -ExpectedStatus @(200) -ExpectedSuccess $true
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "GET /webapp/api/v2/commands/catalog" -ExpectedStatus @(200) -ExpectedSuccess $true
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "GET /webapp/api/v2/monetization/catalog" -ExpectedStatus @(200) -ExpectedSuccess $true
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "GET /webapp/api/v2/monetization/status" -ExpectedStatus @(200) -ExpectedSuccess $true
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "GET /webapp/api/v2/payout/status" -ExpectedStatus @(200) -ExpectedSuccess $true
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "GET /webapp/api/v2/pvp/progression" -ExpectedStatus @(200) -ExpectedSuccess $true
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "GET /webapp/api/v2/wallet/session" -ExpectedStatus @(200) -ExpectedSuccess $true
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "GET /webapp/api/v2/admin/queue/unified" -ExpectedStatus @(200) -ExpectedSuccess $true
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (confirm-1)" -ExpectedStatus @(409) -ExpectedSuccess $false
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (confirm-2)" -ExpectedStatus @(200) -ExpectedSuccess $true
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (confirm-3)" -ExpectedStatus @(409) -ExpectedSuccess $false
  Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (cooldown)" -ExpectedStatus @(429) -ExpectedSuccess $false

  if ($walletEnabled) {
    Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/wallet/challenge" -ExpectedStatus @(200) -ExpectedSuccess $true
    Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/wallet/verify" -ExpectedStatus @(200) -ExpectedSuccess $true
    Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/wallet/unlink" -ExpectedStatus @(200) -ExpectedSuccess $true
  }
  if ($fixtureKycUserId -gt 0) {
    Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (kyc-confirm-1)" -ExpectedStatus @(409) -ExpectedSuccess $false
    Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (kyc-confirm-2)" -ExpectedStatus @(200) -ExpectedSuccess $true
    Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (kyc-confirm-3)" -ExpectedStatus @(409) -ExpectedSuccess $false
    Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (kyc-cooldown)" -ExpectedStatus @(429) -ExpectedSuccess $false
    Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (kyc-reject-confirm-1)" -ExpectedStatus @(409) -ExpectedSuccess $false
    Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (kyc-reject-confirm-2)" -ExpectedStatus @(200) -ExpectedSuccess $true
    Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (kyc-block-confirm-1)" -ExpectedStatus @(409) -ExpectedSuccess $false
    Assert-SmokeResult -Failures $assertFailures -Results $results -Endpoint "POST /webapp/api/v2/admin/queue/action (kyc-block-confirm-2)" -ExpectedStatus @(200) -ExpectedSuccess $true
  }

  $bootData = $boot.Body.data
  Assert-ObjectHasKeys -Failures $assertFailures -Object $bootData -Context "bootstrap.data" -Keys @(
    "api_version",
    "ux",
    "payout_lock",
    "pvp_content",
    "command_catalog",
    "runtime_flags_effective",
    "wallet_capabilities"
  )

  if ($bootData -and $bootData.command_catalog) {
    $bootCatalog = @($bootData.command_catalog)
    if ($bootCatalog.Count -lt 1) {
      $assertFailures.Add("empty_catalog:bootstrap.data.command_catalog")
    }
    else {
      $bootCommand = $bootCatalog[0]
      Assert-ObjectHasKeys -Failures $assertFailures -Object $bootCommand -Context "bootstrap.command_catalog[0]" -Keys @(
        "key",
        "description_tr",
        "description_en",
        "scenarios",
        "outcomes"
      )
    }
  }

  $catalogData = $catalog.Body.data
  Assert-ObjectHasKeys -Failures $assertFailures -Object $catalogData -Context "commands_catalog.data" -Keys @("commands", "api_version")
  if ($catalogData -and $catalogData.commands) {
    $catalogItems = @($catalogData.commands)
    if ($catalogItems.Count -lt 1) {
      $assertFailures.Add("empty_catalog:commands_catalog.data.commands")
    }
    else {
      $catalogCommand = $catalogItems[0]
      Assert-ObjectHasKeys -Failures $assertFailures -Object $catalogCommand -Context "commands_catalog.commands[0]" -Keys @(
        "key",
        "description",
        "description_tr",
        "description_en",
        "intents",
        "scenarios",
        "outcomes",
        "aliases",
        "adminOnly",
        "min_role"
      )
    }
  }

  $queueData = $queue.Body.data
  Assert-ObjectHasKeys -Failures $assertFailures -Object $queueData -Context "admin_queue.data" -Keys @("items", "api_version")
  if ($queueData -and $queueData.items) {
    $queueItems = @($queueData.items)
    if ($queueItems.Count -lt 1) {
      $assertFailures.Add("empty_queue:admin_queue.data.items")
    }
    else {
      $queueItem = $queueItems[0]
      Assert-ObjectHasKeys -Failures $assertFailures -Object $queueItem -Context "admin_queue.items[0]" -Keys @(
        "kind",
        "request_id",
        "status",
        "priority",
        "queue_age_sec",
        "policy_reason_code",
        "policy_reason_text",
        "action_policy"
      )
    }
  }

  $results | Format-Table -AutoSize
  if ($assertFailures.Count -gt 0) {
    Write-Host ""
    Write-Host "Smoke assertion failures:" -ForegroundColor Red
    foreach ($failure in $assertFailures) {
      Write-Host (" - " + $failure) -ForegroundColor Red
    }
    throw ("smoke assertions failed: " + $assertFailures.Count)
  }
}
finally {
  if ($fixtureRequestId -gt 0 -or $fixtureKycUserId -gt 0) {
    try {
      $cleanupArgs = @("scripts/smoke_v5_1_fixture.mjs", "cleanup")
      if ($fixtureRequestId -gt 0) {
        $cleanupArgs += @("--request-id", "$fixtureRequestId")
      }
      if ($fixtureKycUserId -gt 0) {
        $cleanupArgs += @("--kyc-user-id", "$fixtureKycUserId")
      }
      $null = Invoke-NodeJson -NodeArgs $cleanupArgs
    }
    catch {
      Write-Host ("[warn] fixture cleanup failed for request_id=" + $fixtureRequestId + " kyc_user_id=" + $fixtureKycUserId) -ForegroundColor Yellow
    }
  }
  if ($started -and $proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
  }
}
