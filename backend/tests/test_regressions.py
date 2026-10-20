import hashlib
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from argon2 import PasswordHasher
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app.models import Document, SessionToken, User, now
from test_application import mandate_payload


def test_contact_version_covers_criteria_only_and_archiving(client):
    payload = dict(name="Version test", kind="buyer", criteria={"budget_max": "300000"})
    created = client.post("/api/contacts", json=payload).json()
    url = "/api/contacts/" + created["id"]
    assert client.put(url, json=payload).status_code == 428
    payload["version"] = created["version"]
    payload["criteria"]["budget_max"] = "400000"
    updated = client.put(url, json=payload)
    assert updated.status_code == 200, updated.text
    assert updated.json()["version"] > created["version"]
    payload["criteria"]["budget_max"] = "500000"
    assert client.put(url, json=payload).status_code == 409
    saved = next(c for c in client.get("/api/contacts").json() if c["id"] == created["id"])
    assert saved["criteria"]["budget_max"] == "400000.00"
    assert client.delete(url).status_code == 204
    payload["version"] = updated.json()["version"]
    assert client.put(url, json=payload).status_code == 409


def test_mandate_stale_edit_and_duplicate_roll_back_property(client):
    payload = mandate_payload(client)
    created = client.post("/api/mandates", json=payload).json()
    url = "/api/mandates/" + created["id"]
    assert client.put(url, json=payload).status_code == 428
    payload["version"] = created["version"]
    payload["property"]["title"] = "Première modification"
    updated = client.put(url, json=payload)
    assert updated.status_code == 200, updated.text
    payload["property"]["title"] = "Modification obsolète"
    assert client.put(url, json=payload).status_code == 409
    another = client.post("/api/mandates", json=mandate_payload(client, reference="TEST-102"))
    assert another.status_code == 201
    payload.update(version=updated.json()["version"], reference="TEST-102")
    assert client.put(url, json=payload).status_code == 409
    saved = next(m for m in client.get("/api/mandates").json() if m["id"] == created["id"])
    assert saved["property"]["title"] == "Première modification"
    assert saved["reference"] == "TEST-101"
    assert saved["version"] == updated.json()["version"]


def test_dashboard_excludes_unsigned_and_future_and_orders_urgency(client):
    today = datetime.now(ZoneInfo("Europe/Paris")).date()
    before = client.get("/api/dashboard").json()
    for reference, status, signed, end in [
        ("DRAFT", "preparation", today, today + timedelta(days=90)),
        ("FUTURE", "active", today + timedelta(days=1), today + timedelta(days=90)),
        ("EXPIRED", "expired", today, today + timedelta(days=1)),
        ("WITHDRAWN", "withdrawn", today, today + timedelta(days=1)),
        ("URGENT", "active", today - timedelta(days=300), today - timedelta(days=250)),
    ]:
        result = client.post("/api/mandates", json=mandate_payload(client, reference=reference, status=status, signed_date=str(signed), end_date=str(end)))
        assert result.status_code == 201, result.text
    after = client.get("/api/dashboard").json()
    assert after["months"][-1]["count"] == before["months"][-1]["count"] + 2
    assert after["status_counts"]["expired"] == before["status_counts"]["expired"] + 1
    assert after["status_counts"]["withdrawn"] == before["status_counts"]["withdrawn"] + 1
    assert after["priorities"][0]["reference"] == "URGENT"
    assert isinstance(after["portfolio"], str)


def test_decimal_precision_and_utc_timestamps(client):
    bad = client.post("/api/contacts", json=dict(name="Surface test", kind="buyer", criteria={"min_surface": "12.345"}))
    assert bad.status_code == 422
    contacts = client.get("/api/contacts").json()
    assert datetime.fromisoformat(contacts[0]["created_at"]).utcoffset() == timedelta(0)
    assert datetime.fromisoformat(client.get("/api/audit").json()[0]["created_at"]).utcoffset() == timedelta(0)
    assert isinstance(client.get("/api/mandates").json()[0]["price"], str)


def test_password_spaces_are_preserved(setup):
    client, app, _ = setup
    with app.state.sessions() as db:
        db.add(User(name="Espaces", email="spaces@example.com", password_hash=PasswordHasher().hash("  mot de passe avec espaces  ")))
        db.commit()
    assert client.post("/api/auth/login", json={"email": "spaces@example.com", "password": "mot de passe avec espaces"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "spaces@example.com", "password": "  mot de passe avec espaces  "}).status_code == 200


def test_disabled_demo_account_cannot_issue_token(setup):
    client, app, _ = setup
    with app.state.sessions() as db:
        db.scalar(select(User).where(User.email == "demo@immopilot.example")).active = False
        db.commit()
    assert client.post("/api/auth/demo").status_code == 403


def test_expired_tokens_cleaned_on_login(setup):
    client, app, _ = setup
    token_hash = hashlib.sha256(client.headers["Authorization"].split()[1].encode()).hexdigest()
    with app.state.sessions() as db:
        db.scalar(select(SessionToken).where(SessionToken.token_hash == token_hash)).expires_at = now() - timedelta(hours=1)
        db.commit()
    assert client.post("/api/auth/demo").status_code == 200
    with app.state.sessions() as db:
        assert db.scalar(select(SessionToken).where(SessionToken.token_hash == token_hash)) is None


def test_document_integrity_and_long_filename(setup):
    client, app, settings = setup
    response = client.post("/api/documents", files={"file": ("x" * 250 + ".pdf", b"%PDF-1.4\nfixture")})
    assert response.status_code == 201, response.text
    doc = response.json()
    assert doc["filename"].endswith(".pdf")
    assert len(doc["filename"]) <= 204
    with app.state.sessions() as db:
        row = db.get(Document, doc["id"])
        (settings.storage_dir / row.storage_key).write_bytes(b"altered")
    assert client.get(f'/api/documents/{doc["id"]}/download').status_code == 409


def test_request_body_limit_without_content_length(client):
    def stream():
        for _ in range(17):
            yield b"x" * 1024 * 1024
    response = client.post("/api/documents", content=stream(), headers={"Content-Type": "application/octet-stream", "Origin": "http://127.0.0.1:1420"})
    assert response.status_code == 413
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:1420"
    assert client.get("/api/health").status_code == 200


def test_health_detects_database_outage(setup, monkeypatch):
    client, app, _ = setup
    def unavailable(*args, **kwargs):
        raise OperationalError("connection", {}, Exception("offline"))
    monkeypatch.setattr(app.state.engine, "connect", unavailable)
    response = client.get("/api/health")
    assert response.status_code == 503
    assert "indisponible" in response.json()["detail"]
