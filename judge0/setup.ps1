$ErrorActionPreference = "Stop"

$judge0Directory = $PSScriptRoot
$examplePath = Join-Path $judge0Directory "judge0.conf.example"
$configPath = Join-Path $judge0Directory "judge0.conf"

if (Test-Path -LiteralPath $configPath) {
  Write-Output "judge0/judge0.conf already exists."
  exit 0
}

$redisPassword = [Guid]::NewGuid().ToString("N")
$postgresPassword = [Guid]::NewGuid().ToString("N")

$config = Get-Content -LiteralPath $examplePath -Raw
$config = $config.Replace("CHANGE_ME_REDIS", $redisPassword)
$config = $config.Replace("CHANGE_ME_POSTGRES", $postgresPassword)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($configPath, $config, $utf8NoBom)

Write-Output "Created judge0/judge0.conf with generated local passwords."
