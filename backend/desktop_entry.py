"""Point d’entrée embarqué ; aucune donnée dans le dossier d’installation."""
import argparse
import os
import sys
import logging
import threading
from logging.handlers import RotatingFileHandler
from pathlib import Path
from datetime import datetime, timezone

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
import uvicorn

from app.config import Settings
from app.backup import backup
from app.manage import initialize
from app.main import create_app


def prepare(data_dir: Path, key: str, mode: str = "local"):
    data_dir.mkdir(parents=True, exist_ok=True)
    settings = Settings(_env_file=None, mode=mode,
        database_url="sqlite:///" + (data_dir / ("local.db" if mode == "local" else "demo.db")).as_posix(),
        storage_dir=data_dir / ("local-documents" if mode == "local" else "documents"), desktop_key=key,
        cors_origins=["http://tauri.localhost", "tauri://localhost"])
    settings.validate_runtime()
    config = Config()
    root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    config.set_main_option("script_location", str(root / "migrations"))
    config.attributes["settings"] = settings
    head = ScriptDirectory.from_config(config).get_current_head()
    engine = create_engine(settings.database_url)
    try:
        with engine.connect() as connection:
            current = MigrationContext.configure(connection).get_current_revision()
    finally:
        engine.dispose()
    if current and current != head:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
        backup(settings, data_dir / "backups" / f"before-migration-{stamp}.zip")
    command.upgrade(config, "head")
    initialize(settings, demo=mode == "demo")
    return settings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--parent-pid", type=int)
    args = parser.parse_args()
    if args.parent_pid and sys.platform == "win32":
        def watch_parent():
            import ctypes
            from ctypes import wintypes
            kernel = ctypes.WinDLL("kernel32", use_last_error=True)
            kernel.OpenProcess.restype = wintypes.HANDLE
            kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
            kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
            handle = kernel.OpenProcess(0x00100000, False, args.parent_pid)
            if handle:
                kernel.WaitForSingleObject(handle, 0xFFFFFFFF)
                os._exit(0)
        threading.Thread(target=watch_parent, daemon=True).start()
    args.data_dir = args.data_dir.resolve()
    args.data_dir.mkdir(parents=True, exist_ok=True)
    os.chdir(args.data_dir)
    handler = RotatingFileHandler(args.data_dir / "backend.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    logging.basicConfig(handlers=[handler], level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    key = os.environ.pop("IMMO_DESKTOP_KEY", "")
    if not key:
        raise RuntimeError("Clé du processus parent absente.")
    try:
        settings = prepare(args.data_dir, key)
        uvicorn.run(create_app(settings), host="127.0.0.1", port=args.port,
                    loop="asyncio:SelectorEventLoop", log_config=None)
    except Exception:
        logging.exception("Démarrage interrompu ; les données sont conservées.")
        raise


if __name__ == "__main__":
    main()
