$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $projectRoot "tools\holder-harvester\server.js"
$logDirectory = Join-Path $projectRoot "tools\holder-harvester\logs"
$logPath = Join-Path $logDirectory "snapshot-server.log"
$nodePath = (Get-Command node -ErrorAction Stop).Source

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

while ($true) {
  $startedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $logPath -Value "[$startedAt] Starting Flamingos Snapshot server."

  & $nodePath $serverPath *>> $logPath

  $stoppedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $logPath -Value "[$stoppedAt] Snapshot server stopped. Restarting in 3 seconds."
  Start-Sleep -Seconds 3
}
