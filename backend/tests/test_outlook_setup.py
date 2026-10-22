from uuid import uuid4
from sqlalchemy import select
from app.models import User


def test_outlook_preparation_persists_without_claiming_connection(client):
    current = client.get("/api/outlook/config").json()
    assert not current["configured"] and not current["connected"] and not current["can_send"]
    data = {"version": current["version"], "client_id": str(uuid4()), "tenant": "common"}
    result = client.put("/api/outlook/config", json=data)
    assert result.status_code == 200, result.text
    saved = result.json()
    assert saved["configured"] and not saved["connected"] and not saved["authorization_available"]
    assert not saved["requires_client_secret"]
    assert client.get("/api/outlook/config").json()["client_id"] == data["client_id"]
    newer = client.put("/api/outlook/config", json={**data, "version": saved["version"], "tenant": "organizations"})
    assert newer.status_code == 200
    assert client.put("/api/outlook/config", json={**data, "version": saved["version"]}).status_code == 409
    assert client.put("/api/outlook/config", json={"version": newer.json()["version"], "client_id": "", "tenant": "common"}).json()["configured"] is False


def test_outlook_configuration_rejects_secrets_and_untrusted_authority(client):
    for data in ({"client_id": "not-an-application-id"}, {"tenant": "https://attacker.example"}, {"client_secret": "not-supported"}):
        assert client.put("/api/outlook/config", json=data).status_code == 422


def test_outlook_preparation_owner_only(setup):
    client, app, _ = setup
    with app.state.sessions() as db:
        account = db.scalar(select(User).limit(1))
        account.role = "advisor"
        db.commit()
    assert client.get("/api/outlook/config").status_code == 200
    assert client.put("/api/outlook/config", json={"client_id": str(uuid4())}).status_code == 403
    client.headers.pop("Authorization")
    assert client.get("/api/outlook/config").status_code == 401
