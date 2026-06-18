param(
  [switch]$IncludeTyphon,
  [switch]$WithoutTyphon,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendEnvFile = Join-Path $ProjectRoot ".env.backend.local"

function Import-BackendEnvironment {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $parts = $trimmed -split "=", 2
    if ($parts.Count -ne 2) {
      continue
    }

    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

function Test-ListeningPort {
  param([int]$Port)

  $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
  return $null -ne ($listeners | Where-Object { $_.Port -eq $Port } | Select-Object -First 1)
}

function Start-CodeArenaService {
  param(
    [string]$Name,
    [string]$NpmCommand,
    [int]$Port
  )

  if (Test-ListeningPort -Port $Port) {
    Write-Host "$Name is already available on port $Port. Skipping duplicate start." -ForegroundColor Yellow
    return
  }

  $escapedRoot = $ProjectRoot.Replace("'", "''")
  $escapedName = $Name.Replace("'", "''")
  $command = "& { Set-Location -LiteralPath '$escapedRoot'; `$Host.UI.RawUI.WindowTitle = '$escapedName'; $NpmCommand }"
  $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))

  Start-Process `
    -FilePath "powershell.exe" `
    -WorkingDirectory $ProjectRoot `
    -ArgumentList @("-NoLogo", "-NoProfile", "-NoExit", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedCommand)

  Write-Host "Started $Name on port $Port." -ForegroundColor Green
}

function Test-DockerEngine {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    return $false
  }

  $previousErrorAction = $ErrorActionPreference
  try {
    $ErrorActionPreference = "SilentlyContinue"
    & docker info *> $null
    return $LASTEXITCODE -eq 0
  }
  finally {
    $ErrorActionPreference = $previousErrorAction
  }
}

function Find-DockerDesktop {
  $candidates = @(
    "C:\Program Files\Docker\Docker\Docker Desktop.exe",
    (Join-Path $env:LOCALAPPDATA "Docker\Docker Desktop.exe")
  )

  return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

function Start-AndWaitForDocker {
  if (Test-DockerEngine) {
    return $true
  }

  $dockerDesktop = Find-DockerDesktop
  if (-not $dockerDesktop) {
    Write-Warning "Docker Desktop was not found. Install or start Docker before running code."
    return $false
  }

  Write-Host "Starting Docker Desktop..." -ForegroundColor Cyan
  Start-Process -FilePath $dockerDesktop -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    if (Test-DockerEngine) {
      Write-Host "Docker Desktop is ready." -ForegroundColor Green
      return $true
    }
  }

  Write-Warning "Docker Desktop did not become ready within 90 seconds."
  return $false
}

function Test-TyphonSandboxImages {
  $previousErrorAction = $ErrorActionPreference
  try {
    $ErrorActionPreference = "SilentlyContinue"
    & docker image inspect typhon-python typhon-java *> $null
    return $LASTEXITCODE -eq 0
  }
  finally {
    $ErrorActionPreference = $previousErrorAction
  }
}

Set-Location -LiteralPath $ProjectRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm was not found. Install Node.js, then run start.cmd again."
}

if (-not $SkipInstall -and -not (Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules"))) {
  Write-Host "Installing Node.js dependencies for the first launch..." -ForegroundColor Cyan
  & npm install
  if ($LASTEXITCODE -ne 0) {
    throw "npm install failed with exit code $LASTEXITCODE."
  }
}

$privilegedEnvironment = @{}
foreach ($name in @("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY")) {
  if (Test-Path -LiteralPath "Env:$name") {
    $privilegedEnvironment[$name] = (Get-Item -LiteralPath "Env:$name").Value
    Remove-Item -LiteralPath "Env:$name"
  }
}

Start-CodeArenaService -Name "CodeArena Frontend" -NpmCommand "npm start" -Port 3000

$startTyphon = $IncludeTyphon -or -not $WithoutTyphon
if ($startTyphon) {
  $dockerReady = Start-AndWaitForDocker
  if ($dockerReady -and -not (Test-TyphonSandboxImages)) {
    Write-Host "Building Typhon sandbox images for the first launch..." -ForegroundColor Cyan
    & npm run typhon:build
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Typhon sandbox images could not be built. Code execution may fail."
    }
  }
  elseif (-not $dockerReady) {
    Write-Warning "Typhon will start, but code execution needs Docker Desktop."
  }
  Start-CodeArenaService -Name "CodeArena Typhon" -NpmCommand "npm run typhon:start" -Port 8000
}

# Load privileged values only after launching non-backend services so they do
# not inherit the Supabase secret.
foreach ($name in $privilegedEnvironment.Keys) {
  [Environment]::SetEnvironmentVariable($name, $privilegedEnvironment[$name], "Process")
}
Import-BackendEnvironment -Path $BackendEnvFile
Start-CodeArenaService -Name "CodeArena Backend" -NpmCommand "npm run start:socket" -Port 4000

Write-Host ""
Write-Host "CodeArena launch complete." -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000"
Write-Host "Backend:  http://localhost:4000"
if ($startTyphon) {
  Write-Host "Typhon:   http://localhost:8000"
}
