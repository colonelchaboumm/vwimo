import sqlite3
from pathlib import Path
import sys

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.manage import initialize

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from desktop_entry import prepare


def test_desktop_startup_keeps_data_and_requires_process_key(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    settings = prepare(tmp_path / "desktop", "private-process-key")
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 401
        client.headers["X-Immo-Desktop-Key"] = "private-process-key"
        token = client.post("/api/auth/demo").json()["token"]
        client.headers["Authorization"] = "Bearer " + token
        assert client.post("/api/contacts", json={"name": "Conservé après mise à jour", "kind": "buyer"}).status_code == 201
    updated = prepare(tmp_path / "desktop", "new-process-key")
    with TestClient(create_app(updated)) as client:
        client.headers["X-Immo-Desktop-Key"] = "new-process-key"
        token = client.post("/api/auth/demo").json()["token"]
        client.headers["Authorization"] = "Bearer " + token
        assert len(client.get("/api/contacts").json()) == 9


def test_desktop_migration_backed_up(tmp_path, monkeypatch):
    migrations = Path(__file__).resolve().parents[1] / "migrations"
    monkeypatch.chdir(tmp_path)
    data_dir = tmp_path / "desktop"
    settings = Settings(_env_file=None, mode="demo", database_url="sqlite:///" + (data_dir / "demo.db").as_posix(), storage_dir=data_dir / "documents")
    settings.validate_runtime()
    config = Config()
    config.set_main_option("script_location", str(migrations))
    config.attributes["settings"] = settings
    command.upgrade(config, "d59c00624dcc")
    with sqlite3.connect(data_dir / "demo.db") as db:
        db.execute("INSERT INTO installation (id, mode) VALUES (1, 'demo')")
    prepare(data_dir, "migration-key")
    assert len(list((data_dir / "backups").glob("*.zip"))) == 1
    with sqlite3.connect(data_dir / "demo.db") as db:
        assert db.execute("SELECT version FROM contacts LIMIT 1").fetchone() == (1,)
