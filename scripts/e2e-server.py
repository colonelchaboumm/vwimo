"""Serveur de test isolé, jamais la base de démonstration de l'utilisateur."""
import os
import sys
from pathlib import Path
from uuid import uuid4

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "backend"))
os.chdir(root)
folder = root / ".local" / ("e2e-" + uuid4().hex)
folder.mkdir(parents=True)
os.environ["IMMO_MODE"] = "demo"
os.environ["IMMO_DATABASE_URL"] = "sqlite:///" + (folder / "e2e.db").as_posix()
os.environ["IMMO_STORAGE_DIR"] = str(folder / "documents")
os.environ["IMMO_CORS_ORIGINS"] = '["http://127.0.0.1:1421", "http://tauri.localhost", "tauri://localhost"]'

from alembic import command
from alembic.config import Config
from app.config import Settings
from app.manage import initialize
import uvicorn

command.upgrade(Config("backend/alembic.ini"), "head")
initialize(Settings(), demo=True)
uvicorn.run("app.main:create_app", factory=True, host="127.0.0.1", port=int(os.environ.get("IMMO_E2E_PORT", "8011")), loop="asyncio:SelectorEventLoop")
