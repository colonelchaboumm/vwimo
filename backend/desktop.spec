from pathlib import Path
from PyInstaller.utils.hooks import collect_all

root = Path(SPECPATH)
datas, binaries, hiddenimports = [], [], []
for package in ("uvicorn", "alembic", "tzdata", "email_validator"):
    package_data, package_bins, package_imports = collect_all(package)
    datas += package_data
    binaries += package_bins
    hiddenimports += package_imports
datas.append((str(root / "migrations"), "migrations"))
a = Analysis([str(root / "desktop_entry.py")], pathex=[str(root)],
    binaries=binaries, datas=datas, hiddenimports=hiddenimports,
    excludes=["pytest", "playwright", "tkinter"], noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="immo-backend", console=True, upx=False)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="backend")
