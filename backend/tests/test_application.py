import hashlib
from datetime import timedelta

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.main import create_app
from app.manage import initialize
from app.models import Installation, SessionToken, User, now


def seller(client):
    return next(c for c in client.get("/api/contacts").json() if c["kind"] == "seller")


def mandate_payload(client, **changes):
    data = dict(reference="TEST-101", seller_id=seller(client)["id"], kind="exclusive", status="active", signed_date="2026-10-01", end_date="2027-01-01", price="420000.00", fees="15000.00", property=dict(title="Appartement de test", address="1 rue de test", city="Annecy", property_type="Appartement", surface="72.00", rooms=3, dpe="C"))
    data.update(changes)
    return data


def test_authentication_required_and_revocation(client):
    headers = dict(client.headers)
    client.headers.pop("Authorization")
    assert client.get("/api/contacts").status_code == 401
    client.headers.update(headers)
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/contacts").status_code == 401


def test_create_update_archive_buyer_and_persistence(setup):
    client, app, settings = setup
    payload = dict(name="Client de test", kind="buyer", email="test@example.com", criteria=dict(budget_min="200000", budget_max="450000", min_surface="60", bedrooms=2))
    response = client.post("/api/contacts", json=payload)
    assert response.status_code == 201, response.text
    identifier = response.json()["id"]
    payload["version"] = response.json()["version"]
    payload["name"] = "Client modifié"
    assert client.put(f"/api/contacts/{identifier}", json=payload).status_code == 200
    with TestClient(create_app(settings)) as restarted:
        restarted.headers["Authorization"] = client.headers["Authorization"]
        assert any(c["name"] == "Client modifié" for c in restarted.get("/api/contacts").json())
    assert client.delete(f"/api/contacts/{identifier}").status_code == 204
    assert not any(c["id"] == identifier for c in client.get("/api/contacts").json())


@pytest.mark.parametrize("changes", [dict(email="bad-mail"), dict(name=" "), dict(criteria=dict(budget_min=500000, budget_max=100000)), dict(phone="javascript:alert(1)")])
def test_invalid_contacts(client, changes):
    assert client.post("/api/contacts", json={"name": "Client test", "kind": "buyer", **changes}).status_code == 422


def test_mandate_creates_property_and_updates_dashboard(client):
    before = client.get("/api/dashboard").json()
    r = client.post("/api/mandates", json=mandate_payload(client))
    assert r.status_code == 201, r.text
    after = client.get("/api/dashboard").json()
    assert after["active"] == before["active"] + 1
    assert float(after["portfolio"]) - float(before["portfolio"]) == 420000
    assert client.post("/api/mandates", json=mandate_payload(client)).status_code == 409
    assert client.delete(f'/api/contacts/{r.json()["seller_id"]}').status_code == 409


@pytest.mark.parametrize("changes", [dict(price=-1), dict(end_date="2020-01-01"), dict(fees=999999), dict(status="invented"), dict(kind="partner", partner_name="Agence", partner_terms="50 %", commercialization_authorized=False)])
def test_mandate_business_rules(client, changes):
    assert client.post("/api/mandates", json=mandate_payload(client, **changes)).status_code == 422


def test_partner_authorization_and_price_audit(client):
    payload = mandate_payload(client, kind="partner", partner_name="Agence de test", partner_terms="Partage 50 %", commercialization_authorized=True)
    result = client.post("/api/mandates", json=payload)
    assert result.status_code == 201
    payload["price"] = "400000.00"
    payload["version"] = result.json()["version"]
    assert client.put('/api/mandates/' + result.json()["id"], json=payload).status_code == 200
    audit = client.get("/api/audit").json()[0]
    assert audit["action"] == "mandate.update"
    assert float(audit["details"]["before"]["price"]) == 420000
    assert float(audit["details"]["after"]["price"]) == 400000


def test_documents_round_trip_and_association(client):
    content = b"%PDF-1.4\nTest fixture only\n%%EOF"
    response = client.post("/api/documents", files={"file": ("../../test.pdf", content, "application/pdf")}, data={"contact_id": seller(client)["id"], "category": "Mandat"})
    assert response.status_code == 201, response.text
    doc = response.json()
    assert doc["filename"] == "test.pdf"
    assert "storage_key" not in doc
    response = client.get(f'/api/documents/{doc["id"]}/download')
    assert response.content == content
    assert "attachment" in response.headers["content-disposition"]
    assert response.headers["x-content-type-options"] == "nosniff"


def test_document_rejections(client):
    assert client.post("/api/documents", files={"file": ("evil.pdf", b"<script>alert(1)</script>")}).status_code == 415
    assert client.post("/api/documents", files={"file": ("macro.docx", b"PK-broken")}).status_code == 415
    assert client.post("/api/documents", files={"file": ("empty.pdf", b"")}).status_code == 413
    assert client.post("/api/documents", files={"file": ("huge.pdf", b"%PDF-" + b"x" * (15 * 1024 * 1024))}).status_code == 413
    assert client.get("/api/documents/nonexistent/download").status_code == 404


def test_reader_cannot_mutate(setup):
    client, app, _ = setup
    with app.state.sessions() as db:
        account = db.scalar(select(User))
        account.role = "reader"
        db.commit()
    assert client.get("/api/contacts").status_code == 200
    assert client.post("/api/contacts", json={"name": "Refusé", "kind": "seller"}).status_code == 403
    assert client.put("/api/settings/automation", json={"enabled": False}).status_code == 403


def test_automation_defaults_and_kill_switch(client):
    data = client.get("/api/settings").json()
    assert data["automation"]["enabled"] is True
    assert data["automation"]["daily_limit"] == 17
    assert data["automation"]["followup_days"] == 7
    assert data["sending_available"] is False
    assert all(not c["can_send"] for c in data["connectors"])
    assert client.put("/api/settings/automation", json={"enabled": False}).status_code == 200
    assert not client.get("/api/settings").json()["automation"]["enabled"]


def test_mode_isolation(setup):
    client, app, settings = setup
    initialize(settings, demo=True)
    assert len(client.get("/api/contacts").json()) == 8
    with app.state.sessions() as db:
        db.get(Installation, 1).mode = "real"
        db.commit()
    with pytest.raises(RuntimeError):
        initialize(settings, demo=True)
    with pytest.raises(RuntimeError):
        with TestClient(create_app(settings)):
            pass
    with pytest.raises(ValueError):
        Settings(mode="real", database_url="sqlite:///").validate_runtime()


def test_expired_session(setup):
    client, app, _ = setup
    token = client.headers["Authorization"].split()[1]
    with app.state.sessions() as db:
        session = db.scalar(select(SessionToken).where(SessionToken.token_hash == hashlib.sha256(token.encode()).hexdigest()))
        session.expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/mandates").status_code == 401


def test_password_login_and_rate_limit(setup):
    client, app, _ = setup
    with app.state.sessions() as db:
        db.add(User(name="Test conseiller", email="login@example.com", password_hash=PasswordHasher().hash("a-long-test-password")))
        db.commit()
    assert client.post("/api/auth/login", json={"email": "login@example.com", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "LOGIN@example.com", "password": "a-long-test-password"}).status_code == 200
    for _ in range(8):
        client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "wrong"})
    assert client.post("/api/auth/login", json={"email": "login@example.com", "password": "a-long-test-password"}).status_code == 429


def test_cors_and_missing_resource(client):
    result = client.options("/api/contacts", headers={"Origin": "https://unknown.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in result.headers
    assert client.put("/api/contacts/missing", json={"name": "Test", "kind": "seller"}).status_code == 404
