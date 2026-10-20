param([switch]$Real)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Impossible de créer l’environnement Python.' }
}
& '.\.venv\Scripts\python.exe' -m pip install -r backend\requirements.lock.txt
if ($LASTEXITCODE -ne 0) { throw 'Installation Python interrompue.' }
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Installation npm interrompue.' }
$env:PYTHONPATH = 'backend'
& '.\.venv\Scripts\python.exe' -m alembic -c backend\alembic.ini upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Migration échouée.' }
if ($Real) { & '.\.venv\Scripts\python.exe' -m app.manage init } else { & '.\.venv\Scripts\python.exe' -m app.manage init --demo }
if ($LASTEXITCODE -ne 0) { throw 'Initialisation échouée. Vérifiez le mode et la base de données.' }
Write-Host 'Prêt. Lancez .\scripts\start.ps1, puis ouvrez http://127.0.0.1:1420.'
