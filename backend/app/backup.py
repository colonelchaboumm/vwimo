"""Sauvegarde et restauration isolée du mode de démonstration SQLite."""
import argparse
import hashlib
import json
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from sqlalchemy.engine import make_url

from .config import Settings


def backup(settings: Settings, destination: Path):
    url = make_url(settings.database_url)
    if url.drivername != "sqlite" or settings.mode != "demo":
        raise ValueError("Pour PostgreSQL, utilisez la procédure pg_dump et stockage décrite dans docs/OPERATIONS.md.")
    source = Path(url.database).resolve()
    if not source.is_file():
        raise ValueError("Base source introuvable.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        snapshot = Path(temporary) / "database.db"
        with closing(sqlite3.connect(source)) as connection, closing(sqlite3.connect(snapshot)) as target:
            connection.backup(target)
            mode = target.execute("SELECT mode FROM installation WHERE id=1").fetchone()
            if mode != ("demo",):
                raise ValueError("La base source n'est pas une base de démonstration.")
            # Une restauration ne réactive jamais les anciennes sessions.
            target.execute("DELETE FROM sessions")
            documents = target.execute("SELECT storage_key, sha256 FROM documents").fetchall()
            target.commit()
        checksums = {"database.db": hashlib.sha256(snapshot.read_bytes()).hexdigest()}
        for key, expected in documents:
            path = settings.storage_dir / key
            if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                raise ValueError(f"Document absent ou altéré : {key}")
            checksums[f"documents/{key}"] = expected
        with zipfile.ZipFile(destination, "x", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(snapshot, "database.db")
            for key, _ in documents:
                archive.write(settings.storage_dir / key, f"documents/{key}")
            archive.writestr("manifest.json", json.dumps({"version": 1, "mode": "demo", "created_at": datetime.now(timezone.utc).isoformat(), "sha256": checksums}))
    return destination


def restore(archive_path: Path, destination: Path):
    if destination.exists():
        raise ValueError("La restauration exige un nouveau dossier vide, qui n'existe pas encore.")
    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        if len(set(names)) != len(names) or sum(x.file_size for x in archive.infolist()) > 2 * 1024**3:
            raise ValueError("Archive invalide ou supérieure à 2 Go.")
        for name in names:
            path = PurePosixPath(name)
            if path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name:
                raise ValueError("Chemin dangereux dans l'archive.")
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("version") != 1 or manifest.get("mode") != "demo" or set(names) != set(manifest["sha256"]) | {"manifest.json"}:
            raise ValueError("Format de sauvegarde incompatible.")
        for name, checksum in manifest["sha256"].items():
            if hashlib.sha256(archive.read(name)).hexdigest() != checksum:
                raise ValueError(f"Intégrité invalide : {name}")
        destination.mkdir(parents=True)
        archive.extractall(destination)
    (destination / "documents").mkdir(exist_ok=True)
    (destination / "documents" / ".installation-mode").write_text("demo", encoding="utf-8")
    with closing(sqlite3.connect(destination / "database.db")) as connection:
        if connection.execute("PRAGMA integrity_check").fetchone() != ("ok",):
            raise ValueError("La base restaurée est endommagée.")
        if connection.execute("SELECT mode FROM installation WHERE id=1").fetchone() != ("demo",):
            raise ValueError("Mode de la base restaurée incompatible.")
        connection.execute("DELETE FROM sessions")
        connection.commit()
    return destination


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["create", "restore"])
    parser.add_argument("path", type=Path)
    parser.add_argument("--destination", type=Path)
    args = parser.parse_args()
    if args.operation == "create":
        print(backup(Settings(), args.path))
    else:
        if not args.destination:
            parser.error("--destination est obligatoire")
        print(restore(args.path, args.destination))


if __name__ == "__main__":
    main()
