$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
& '.\.venv\Scripts\python.exe' -m pytest
if ($LASTEXITCODE -ne 0) { throw 'Tests backend en échec.' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Compilation frontend en échec.' }
npm.cmd run test:e2e
if ($LASTEXITCODE -ne 0) { throw 'Tests navigateur en échec.' }
