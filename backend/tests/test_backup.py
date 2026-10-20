import hashlib
import json
import sqlite3
import zipfile

import pytest

from app.backup import backup, restore


def test_backup_restores_records_files_and_revokes_sessions(setup, tmp_path):
    client, _, settings = setup
    if not settings.database_url.startswith("sqlite"):
        pytest.skip("Sauvegarde SQLite ; PostgreSQL utilise pg_dump.")
    content = b"%PDF-1.4\nfixture\n%%EOF"
    client.post("/api/documents", files={"file": ("document.pdf", content)})
    archive = backup(settings, tmp_path / "backup.zip")
    destination = restore(archive, tmp_path / "restored")
    with sqlite3.connect(destination / "database.db") as db:
        assert db.execute("SELECT count(*) FROM contacts").fetchone()[0] == 8
        assert db.execute("SELECT count(*) FROM sessions").fetchone()[0] == 0
        key = db.execute("SELECT storage_key FROM documents").fetchone()[0]
    assert (destination / "documents" / key).read_bytes() == content
    with pytest.raises(ValueError):
        restore(archive, destination)


def test_restore_rejects_path_traversal_and_tampering(tmp_path):
    archive = tmp_path / "bad.zip"
    with zipfile.ZipFile(archive, "w") as z:
        z.writestr("../escape.txt", "bad")
    with pytest.raises(ValueError):
        restore(archive, tmp_path / "restored")
    with zipfile.ZipFile(archive, "w") as z:
        z.writestr("database.db", "corrupt")
        z.writestr("manifest.json", json.dumps({"version": 1, "mode": "demo", "sha256": {"database.db": hashlib.sha256(b"original").hexdigest()}}))
    with pytest.raises(ValueError):
        restore(archive, tmp_path / "restored")
