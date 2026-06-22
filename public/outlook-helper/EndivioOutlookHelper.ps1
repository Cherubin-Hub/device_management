param(
  [int]$Port = 57991,
  [string]$ConfigPath = (Join-Path $PSScriptRoot "EndivioOutlookHelper.config.json")
)

$ErrorActionPreference = "Stop"
$prefix = "http://127.0.0.1:$Port/"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)

function Get-HelperConfig {
  $defaultLogPath = Join-Path $env:LOCALAPPDATA "Endivio\OutlookHelper\mail-helper.log"
  $config = [ordered]@{
    Token = "endivio-outlook-helper-v1"
    AllowedOrigins = @("http://127.0.0.1:5173", "http://localhost:5173")
    LogPath = $defaultLogPath
  }

  if (Test-Path -LiteralPath $ConfigPath) {
    $fileConfig = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
    if ($fileConfig.Token) { $config.Token = [string]$fileConfig.Token }
    if ($fileConfig.AllowedOrigins) { $config.AllowedOrigins = @($fileConfig.AllowedOrigins) }
    if ($fileConfig.LogPath) { $config.LogPath = [System.Environment]::ExpandEnvironmentVariables([string]$fileConfig.LogPath) }
  }

  return [pscustomobject]$config
}

$helperConfig = Get-HelperConfig

function Write-HelperLog {
  param(
    [string]$Level,
    [string]$Message,
    [hashtable]$Data = @{}
  )

  try {
    $logDirectory = Split-Path -Parent $helperConfig.LogPath
    if (-not (Test-Path -LiteralPath $logDirectory)) {
      New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    }

    $entry = @{
      timestamp = (Get-Date).ToString("o")
      level = $Level
      message = $Message
      data = $Data
    } | ConvertTo-Json -Depth 6 -Compress
    Add-Content -LiteralPath $helperConfig.LogPath -Value $entry
  } catch {
    Write-Warning "Failed to write helper log: $($_.Exception.Message)"
  }
}

function Test-OriginAllowed {
  param([System.Net.HttpListenerRequest]$Request)

  $origin = $Request.Headers["Origin"]
  if ([string]::IsNullOrWhiteSpace($origin)) {
    return $true
  }

  return @($helperConfig.AllowedOrigins) -contains $origin
}

function Add-CorsHeaders {
  param(
    [System.Net.HttpListenerRequest]$Request,
    [System.Net.HttpListenerResponse]$Response
  )

  $origin = $Request.Headers["Origin"]
  if (-not [string]::IsNullOrWhiteSpace($origin) -and (Test-OriginAllowed $Request)) {
    $Response.Headers.Add("Access-Control-Allow-Origin", $origin)
    $Response.Headers.Add("Vary", "Origin")
  }
  $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, X-Endivio-Outlook-Token")
  $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
}

function Write-JsonResponse {
  param(
    [System.Net.HttpListenerRequest]$Request,
    [System.Net.HttpListenerResponse]$Response,
    [int]$StatusCode,
    [hashtable]$Payload
  )

  $Response.StatusCode = $StatusCode
  Add-CorsHeaders -Request $Request -Response $Response
  $Response.ContentType = "application/json; charset=utf-8"

  $json = $Payload | ConvertTo-Json -Depth 6
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Response.OutputStream.Close()
}

function Test-AuthorizedRequest {
  param([System.Net.HttpListenerRequest]$Request)

  if (-not (Test-OriginAllowed $Request)) {
    return $false
  }

  $token = $Request.Headers["X-Endivio-Outlook-Token"]
  return $token -eq $helperConfig.Token
}

function Split-Recipients {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return @()
  }

  return $Value -split "[;,]" |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_.Length -gt 0 }
}

function Send-OutlookMail {
  param($Payload)

  $toRecipients = @(Split-Recipients $Payload.to)
  if ($toRecipients.Count -eq 0) {
    throw "The email has no To recipient."
  }

  $outlook = New-Object -ComObject Outlook.Application
  $mail = $outlook.CreateItem(0)

  foreach ($recipient in $toRecipients) {
    [void]$mail.Recipients.Add($recipient)
  }

  foreach ($recipient in (Split-Recipients $Payload.cc)) {
    $ccRecipient = $mail.Recipients.Add($recipient)
    $ccRecipient.Type = 2
  }

  $mail.Subject = [string]$Payload.subject
  $mail.Body = [string]$Payload.body

  if (-not $mail.Recipients.ResolveAll()) {
    throw "One or more Outlook recipients could not be resolved."
  }

  $mail.Send()
}

try {
  $listener.Start()
  Write-Host "Endivio Outlook mail helper listening at $prefix"
  Write-Host "Allowed origins: $(@($helperConfig.AllowedOrigins) -join ', ')"
  Write-Host "Log path: $($helperConfig.LogPath)"
  Write-Host "Keep this window running while using Register/Unregister Device."
  Write-HelperLog -Level "info" -Message "Helper started" -Data @{ port = $Port; allowedOrigins = @($helperConfig.AllowedOrigins) }

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    if (-not (Test-OriginAllowed $request)) {
      Write-HelperLog -Level "warn" -Message "Blocked request from disallowed origin" -Data @{ origin = $request.Headers["Origin"]; path = $request.Url.AbsolutePath }
      Write-JsonResponse -Request $request -Response $response -StatusCode 403 -Payload @{ ok = $false; error = "Origin is not allowed." }
      continue
    }

    if ($request.HttpMethod -eq "OPTIONS") {
      Write-JsonResponse -Request $request -Response $response -StatusCode 204 -Payload @{ ok = $true }
      continue
    }

    if ($request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/health") {
      Write-JsonResponse -Request $request -Response $response -StatusCode 200 -Payload @{ ok = $true; service = "Endivio Outlook mail helper" }
      continue
    }

    if ($request.HttpMethod -ne "POST" -or $request.Url.AbsolutePath -ne "/send") {
      Write-JsonResponse -Request $request -Response $response -StatusCode 404 -Payload @{ ok = $false; error = "Not found." }
      continue
    }

    if (-not (Test-AuthorizedRequest $request)) {
      Write-HelperLog -Level "warn" -Message "Blocked unauthorized send request" -Data @{ origin = $request.Headers["Origin"] }
      Write-JsonResponse -Request $request -Response $response -StatusCode 401 -Payload @{ ok = $false; error = "Unauthorized request." }
      continue
    }

    try {
      $reader = [System.IO.StreamReader]::new($request.InputStream, $request.ContentEncoding)
      $body = $reader.ReadToEnd()
      $reader.Close()

      $payload = $body | ConvertFrom-Json
      Send-OutlookMail -Payload $payload
      Write-HelperLog -Level "info" -Message "Email sent" -Data @{ origin = $request.Headers["Origin"]; to = [string]$payload.to; cc = [string]$payload.cc; subject = [string]$payload.subject }
      Write-JsonResponse -Request $request -Response $response -StatusCode 200 -Payload @{ ok = $true }
    } catch {
      Write-HelperLog -Level "error" -Message "Email send failed" -Data @{ origin = $request.Headers["Origin"]; error = $_.Exception.Message }
      Write-JsonResponse -Request $request -Response $response -StatusCode 500 -Payload @{ ok = $false; error = $_.Exception.Message }
    }
  }
} finally {
  Write-HelperLog -Level "info" -Message "Helper stopped"
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
