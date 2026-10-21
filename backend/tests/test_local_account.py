from concurrent.futures import ThreadPoolExecutor
import sqlite3

from argon2 import PasswordHasher
from fastapi.testclient import TestClient
import pytest

from app.main import create_app
from app.backup import backup, restore
from test_desktop import prepare

ACCOUNT = {"name": "Valentin", "email": "Valentin@example.com", "password": " Mon secret local 2026! ", "password_confirmation": " Mon secret local 2026! "}


def local_client(settings):
    return TestClient(create_app(settings), client=("127.0.0.1", 50000), headers={"X-Immo-Desktop-Key": "local-test-key"})


def test_local_account_persists_without_demo_access(tmp_path):
    folder = tmp_path / "personal"
    settings = prepare(folder, "local-test-key")
    with local_client(settings) as client:
        assert client.get("/api/health").json()["setup_required"] is True
        assert client.get("/api/contacts").status_code == 401
        created = client.post("/api/auth/register-local", json=ACCOUNT)
        assert created.status_code == 201
        assert created.json()["user"]["email"] == "valentin@example.com"
        assert created.json()["mode"] == "local"
        client.headers["Authorization"] = "Bearer " + created.json()["token"]
        assert client.get("/api/contacts").json() == []
        assert client.post("/api/contacts", json={"name": "Mon dossier privé", "kind": "buyer"}).status_code == 201
        assert client.post("/api/auth/demo").status_code == 404
        assert client.post("/api/auth/logout").status_code == 204
        assert client.get("/api/contacts").status_code == 401
    settings = prepare(folder, "local-test-key")
    with local_client(settings) as client:
        assert client.get("/api/health").json()["setup_required"] is False
        assert client.post("/api/auth/register-local", json=ACCOUNT).status_code == 409
        wrong = {"email": ACCOUNT["email"], "password": ACCOUNT["password"].strip()}
        assert client.post("/api/auth/login", json=wrong).status_code == 401
        logged = client.post("/api/auth/login", json={"email": ACCOUNT["email"].upper(), "password": ACCOUNT["password"]})
        assert logged.status_code == 200
        client.headers["Authorization"] = "Bearer " + logged.json()["token"]
        assert client.get("/api/contacts").json()[0]["name"] == "Mon dossier privé"
    with sqlite3.connect(folder / "local.db") as db:
        password_hash = db.execute("SELECT password_hash FROM users").fetchone()[0]
        assert password_hash.startswith("$argon2id$")
        assert PasswordHasher().verify(password_hash, ACCOUNT["password"])
        assert ACCOUNT["password"] not in str(db.execute("SELECT details FROM audit_logs").fetchall())


@pytest.mark.parametrize("changes", [
    {"email": "pas-un-email"}, {"password": "court", "password_confirmation": "court"},
    {"password_confirmation": "Autre mot de passe"}, {"name": "  "},
    {"password": " " * 12, "password_confirmation": " " * 12}, {"role": "admin"},
])
def test_registration_validation(tmp_path, changes):
    settings = prepare(tmp_path / "personal", "local-test-key")
    with local_client(settings) as client:
        assert client.post("/api/auth/register-local", json={**ACCOUNT, **changes}).status_code == 422
        assert client.get("/api/health").json()["setup_required"] is True


def test_registration_rejects_external_origins_and_network(tmp_path):
    settings = prepare(tmp_path / "personal", "local-test-key")
    with local_client(settings) as client:
        assert client.post("/api/auth/register-local", json=ACCOUNT, headers={"Origin": "https://other.example"}).status_code == 403
        assert client.get("/api/health").json()["setup_required"] is True
    with TestClient(create_app(settings), client=("192.168.1.25", 50000)) as client:
        assert client.post("/api/auth/register-local", json=ACCOUNT).status_code == 403


def test_only_one_owner_under_concurrent_registration(tmp_path):
    settings = prepare(tmp_path / "personal", "local-test-key")
    with local_client(settings) as first, local_client(settings) as second:
        with ThreadPoolExecutor(max_workers=2) as pool:
            requests = [pool.submit(c.post, "/api/auth/register-local", json={**ACCOUNT, "email": email})
                        for c, email in [(first, "one@example.com"), (second, "two@example.com")]]
            assert sorted(r.result().status_code for r in requests) == [201, 409]


def test_local_backup_keeps_account_revokes_sessions_and_preserves_demo(tmp_path):
    folder = tmp_path / "desktop"
    old = prepare(folder, "local-test-key", mode="demo")
    demo_bytes = (folder / "demo.db").read_bytes()
    settings = prepare(folder, "local-test-key")
    with local_client(settings) as client:
        assert client.post("/api/auth/register-local", json=ACCOUNT).status_code == 201
    restored = restore(backup(settings, tmp_path / "local.zip"), tmp_path / "restored")
    assert (folder / "demo.db").read_bytes() == demo_bytes
    assert (old.storage_dir / ".installation-mode").read_text() == "demo"
    assert (restored / "documents" / ".installation-mode").read_text() == "local"
    with sqlite3.connect(restored / "database.db") as db:
        assert db.execute("SELECT count(*) FROM sessions").fetchone()[0] == 0
        assert db.execute("SELECT email FROM users").fetchone()[0] == "valentin@example.com"


def test_demo_cannot_create_local_owner(client):
    assert client.post("/api/auth/register-local", json=ACCOUNT).status_code == 404
