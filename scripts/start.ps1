param([switch]$Desktop)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Exécutez d’abord scripts\setup.ps1.' }
$env:PYTHONPATH = Join-Path $projectRoot 'backend'
$backendProcess = $null
try {
    New-Item -ItemType Directory -Force '.local' | Out-Null
    try { $health = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 2 } catch { $health = $null }
    if ($health) { throw 'Le port 8000 est déjà utilisé. Arrêtez le serveur existant avant de lancer cette commande.' }
    $backendProcess = Start-Process -FilePath $pythonPath -ArgumentList '-m app.serve' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput '.local\backend.log' -RedirectStandardError '.local\backend-error.log'
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        if ($backendProcess.HasExited) { throw 'Le backend a échoué. Consultez .local\backend-error.log.' }
        try { $health = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 1; $ready = $true; break } catch { }
    }
    if (-not $ready) { throw 'Le backend ne répond pas. Consultez les journaux dans .local.' }
    Write-Host "Backend prêt ($($health.mode)). Interface : http://127.0.0.1:1420"
    if ($Desktop) { npm.cmd run desktop } else { npm.cmd run dev }
    if ($LASTEXITCODE -ne 0) { throw "Le client s’est arrêté avec le code $LASTEXITCODE." }
} finally {
    if ($backendProcess -and -not $backendProcess.HasExited) { Stop-Process -Id $backendProcess.Id }
}
