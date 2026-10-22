import sqlite3
from pathlib import Path
import sys
import pytest

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
    settings = prepare(tmp_path / "desktop", "private-process-key", mode="demo")
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 401
        client.headers["X-Immo-Desktop-Key"] = "private-process-key"
        token = client.post("/api/auth/demo").json()["token"]
        client.headers["Authorization"] = "Bearer " + token
        assert client.post("/api/contacts", json={"name": "Conservé après mise à jour", "kind": "buyer"}).status_code == 201
    updated = prepare(tmp_path / "desktop", "new-process-key", mode="demo")
    with TestClient(create_app(updated)) as client:
        client.headers["X-Immo-Desktop-Key"] = "new-process-key"
        token = client.post("/api/auth/demo").json()["token"]
        client.headers["Authorization"] = "Bearer " + token
        assert len(client.get("/api/contacts").json()) == 9


@pytest.mark.parametrize("mode", ["demo", "local"])
def test_desktop_migration_backed_up(tmp_path, monkeypatch, mode):
    migrations = Path(__file__).resolve().parents[1] / "migrations"
    monkeypatch.chdir(tmp_path)
    data_dir = tmp_path / "desktop"
    database = data_dir / f"{mode}.db"
    settings = Settings(_env_file=None, mode=mode, database_url="sqlite:///" + database.as_posix(), storage_dir=data_dir / ("local-documents" if mode == "local" else "documents"))
    settings.validate_runtime()
    config = Config()
    config.set_main_option("script_location", str(migrations))
    config.attributes["settings"] = settings
    command.upgrade(config, "d59c00624dcc")
    with sqlite3.connect(database) as db:
        db.execute("INSERT INTO installation (id, mode) VALUES (1, ?)", (mode,))
    prepare(data_dir, "migration-key", mode=mode)
    assert len(list((data_dir / "backups").glob("*.zip"))) == 1
    with sqlite3.connect(database) as db:
        assert "version" in [row[1] for row in db.execute("PRAGMA table_info(contacts)")]
        assert db.execute("SELECT mode FROM installation").fetchone() == (mode,)


def test_financial_records_survive_partner_migration(tmp_path, monkeypatch):
    migrations = Path(__file__).resolve().parents[1] / "migrations"
    monkeypatch.chdir(tmp_path)
    data_dir = tmp_path / "desktop"
    database = data_dir / "local.db"
    settings = Settings(_env_file=None, mode='local', database_url='sqlite:///'+database.as_posix(), storage_dir=data_dir/'local-documents')
    settings.validate_runtime()
    config = Config()
    config.set_main_option('script_location',str(migrations))
    config.attributes['settings']=settings
    command.upgrade(config,'20261022_finance')
    with sqlite3.connect(database) as db:
        db.execute("INSERT INTO installation (id,mode) VALUES (1,'local')")
        db.execute("""INSERT INTO incomes (id,created_at,reference,title,category,partner,base_amount,fixed_amount,adjustment,adjustment_reason,amount_basis,amount,expected_on,earned_on,status,calculation,justification,notes,version)
            VALUES ('income-before','2026-01-01','REV-AVANT','Revenu antérieur','broker','Partenaire déclaré',0,100.01,0,'','contract',100.01,'2026-01-01','2026-01-01','acquired','{}','Justification existante','',1)""")
        db.execute("INSERT INTO income_payments (id,created_at,income_id,paid_on,amount,reference) VALUES ('payment-before','2026-01-01','income-before','2026-01-01',20.01,'Versement antérieur')")
    prepare(data_dir,'migration-key')
    assert len(list((data_dir/'backups').glob('*.zip')))==1
    with sqlite3.connect(database) as db:
        assert db.execute('SELECT reference,amount,referral_id FROM incomes').fetchone()==('REV-AVANT',100.01,None)
        assert db.execute('SELECT income_id,amount FROM income_payments').fetchone()==('income-before',20.01)
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
        assert 'ix_incomes_referral_id' in [row[1] for row in db.execute('PRAGMA index_list(incomes)')]
