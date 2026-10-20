$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
& '.\.venv\Scripts\python.exe' -m PyInstaller --noconfirm --distpath 'apps/desktop/src-tauri/resources' --workpath '.local/pyinstaller' 'backend/desktop.spec'
if ($LASTEXITCODE -ne 0) { throw 'Compilation du backend embarqué échouée.' }
