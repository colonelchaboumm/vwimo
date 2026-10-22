from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
from threading import Event
from uuid import uuid4

from argon2 import PasswordHasher
from fastapi.testclient import TestClient
import httpx
from pydantic import SecretStr
import pytest
from sqlalchemy import select

from app import charlie_provider, secret_store
from app.charlie_provider import ProviderError
from app.main import create_app
from app.models import AIConversation, AISettings, AITurn, CalendarEvent, User
from test_application import mandate_payload


def new_chat(client):
    result = client.post("/api/charlie/conversations", json={})
    assert result.status_code == 201, result.text
    return result.json()


def payload(client, conversation, **changes):
    kind, identifier = changes.get("context_kind", "briefing"), changes.get("context_id")
    preview = client.get("/api/charlie/context", params={"kind": kind, **({"identifier": identifier} if identifier else {})})
    assert preview.status_code == 200, preview.text
    return {"request_id": str(uuid4()), "version": conversation["version"], "question": "Prépare mon briefing", "engine": "local",
            "context_kind": kind, "context_id": identifier, "context_digest": preview.json()["digest"], **changes}


def fake_config(setup):
    client, app, settings = setup
    settings.openai_api_key = SecretStr("sk-fictional-test-key-never-live")
    with app.state.sessions() as db:
        db.add(AISettings(id=1, enabled=True, model="gpt-5-mini", max_output_tokens=2048))
        db.commit()
    return client, app, settings


def test_local_briefing_and_conversation_persist_and_replay(setup):
    client, app, settings = setup
    app.state.charlie_generate = lambda **kwargs: pytest.fail("Le mode local ne doit jamais appeler OpenAI")
    chat = new_chat(client)
    data = payload(client, chat)
    path = "/api/charlie/conversations/" + chat["id"] + "/messages"
    result = client.post(path, json=data)
    assert result.status_code == 200, result.text
    value = result.json()
    assert value["turns"][0]["status"] == "completed"
    assert "MODE LOCAL" in value["turns"][0]["answer"]
    assert value["pending_request_id"] is None
    assert value["version"] > chat["version"]
    assert client.post(path, json=data).json()["turns"] == value["turns"]
    assert client.post(path, json={**data, "question": "Autre demande"}).status_code == 409
    with TestClient(create_app(settings)) as restarted:
        restarted.headers["Authorization"] = client.headers["Authorization"]
        assert len(restarted.get("/api/charlie/conversations/" + chat["id"]).json()["turns"]) == 1
    assert client.delete("/api/charlie/conversations/" + chat["id"], params={"version": chat["version"]}).status_code == 409
    assert client.delete("/api/charlie/conversations/" + chat["id"], params={"version": value["version"]}).status_code == 204
    with app.state.sessions() as db:
        assert db.get(AITurn, data["request_id"]) is None


def test_dossier_context_excludes_contact_coordinates_and_detects_changes(client):
    created = client.post("/api/contacts", json={"name": "Contact confidentiel", "kind": "buyer", "email": "private@example.com", "phone": "+33600000000", "city": "Annecy", "notes": "Note libre"}).json()
    context = client.get("/api/charlie/context", params={"kind": "contact", "identifier": created["id"]}).json()
    text = json.dumps(context)
    assert "private@example.com" not in text and "+33600000000" not in text
    chat = new_chat(client)
    data = payload(client, chat, context_kind="contact", context_id=created["id"])
    assert client.put("/api/contacts/" + created["id"], json={"name": "Dossier modifié", "kind": "buyer", "version": created["version"]}).status_code == 200
    assert client.post("/api/charlie/conversations/" + chat["id"] + "/messages", json=data).status_code == 409
    assert client.get("/api/charlie/conversations/" + chat["id"]).json()["turns"] == []


def test_local_draft_uses_recorded_fields_without_sending(client):
    mandate = client.post("/api/mandates", json=mandate_payload(client)).json()
    chat = new_chat(client)
    path = "/api/charlie/conversations/" + chat["id"] + "/messages"
    data = payload(client, chat, context_kind="mandate", context_id=mandate["id"], question="Prépare un brouillon d’annonce")
    value = client.post(path, json=data).json()
    answer = value["turns"][-1]["answer"]
    assert "BROUILLON" in answer and "TEST-101" in answer and "420 000" in answer
    assert "Aucune annonce n’a été publiée" in answer
    data = payload(client, value, context_kind="mandate", context_id=mandate["id"], question="Envoie cet e-mail")
    answer = client.post(path, json=data).json()["turns"][-1]["answer"]
    assert "Aucun message n’a été envoyé" in answer


def test_conversation_owner_isolation_and_roles(setup):
    client, app, _ = setup
    chat = new_chat(client)
    with app.state.sessions() as db:
        db.add(User(email="other@example.com", name="Autre conseiller", role="advisor", password_hash=PasswordHasher().hash("Other test password")))
        db.commit()
    original = client.headers["Authorization"]
    token = client.post("/api/auth/login", json={"email": "other@example.com", "password": "Other test password"}).json()["token"]
    client.headers["Authorization"] = "Bearer " + token
    assert client.get("/api/charlie/conversations").json()["items"] == []
    assert client.get("/api/charlie/conversations/" + chat["id"]).status_code == 404
    assert client.delete("/api/charlie/conversations/" + chat["id"], params={"version": 1}).status_code == 404
    assert client.put("/api/charlie/config", json={"enabled": False, "model": "gpt-5-mini"}).status_code == 403
    assert client.post("/api/charlie/test").status_code == 403
    with app.state.sessions() as db:
        db.scalar(select(User).where(User.email == "other@example.com")).role = "reader"
        db.commit()
    assert client.post("/api/charlie/conversations", json={}).status_code == 403
    assert client.get("/api/charlie/context").status_code == 200
    client.headers["Authorization"] = original
    client.headers.pop("Authorization")
    assert client.get("/api/charlie/config").status_code == 401
    assert client.get("/api/charlie/conversations").status_code == 401


def test_openai_requires_confirmation_and_never_transmits_history(setup):
    client, app, _ = fake_config(setup)
    sent = []
    app.state.charlie_generate = lambda **kwargs: sent.append(kwargs) or "Réponse externe de test"
    chat = new_chat(client)
    path = "/api/charlie/conversations/" + chat["id"] + "/messages"
    old = payload(client, chat, question="ANCIEN_SECRET_DE_CONVERSATION")
    value = client.post(path, json=old).json()
    data = payload(client, value, question="Résume uniquement ce briefing", engine="openai")
    assert client.post(path, json=data).status_code == 422 and sent == []
    data["allow_external"] = True
    result = client.post(path, json=data)
    assert result.status_code == 200, result.text
    assert result.json()["turns"][-1]["answer"] == "Réponse externe de test"
    transmitted = json.dumps(sent[0]["messages"], ensure_ascii=False)
    assert "ANCIEN_SECRET_DE_CONVERSATION" not in transmitted
    assert len(sent[0]["messages"]) == 1 and "Résume uniquement ce briefing" in transmitted
    assert "sk-fictional" not in transmitted
    assert client.post(path, json=data).status_code == 200
    assert len(sent) == 1


def test_provider_failure_is_recorded_without_local_fallback(setup):
    client, app, _ = fake_config(setup)
    calls = []
    def failed(**kwargs):
        calls.append(True)
        raise ProviderError("Quota atteint pour le test")
    app.state.charlie_generate = failed
    chat = new_chat(client)
    data = payload(client, chat, engine="openai", allow_external=True)
    path = "/api/charlie/conversations/" + chat["id"] + "/messages"
    value = client.post(path, json=data).json()
    assert value["turns"][-1]["status"] == "failed"
    assert value["turns"][-1]["answer"] == ""
    assert "Quota" in value["turns"][-1]["error"]
    assert value["pending_request_id"] is None
    assert client.post(path, json=data).json()["turns"] == value["turns"]
    assert len(calls) == 1


def test_concurrent_messages_reserve_one_provider_call(setup):
    client, app, _ = fake_config(setup)
    started, release = Event(), Event()
    calls = []
    def provider(**kwargs):
        calls.append(True); started.set()
        assert release.wait(10)
        return "Réponse confirmée"
    app.state.charlie_generate = provider
    chat = new_chat(client)
    first = payload(client, chat, engine="openai", allow_external=True)
    second = {**first, "request_id": str(uuid4())}
    path = "/api/charlie/conversations/" + chat["id"] + "/messages"
    with ThreadPoolExecutor(max_workers=2) as pool:
        future = pool.submit(client.post, path, json=first)
        try:
            assert started.wait(10)
            assert client.post(path, json=second).status_code == 409
            assert client.post(path, json=first).status_code == 409
            current = client.get("/api/charlie/conversations/" + chat["id"]).json()
            assert client.delete("/api/charlie/conversations/" + chat["id"], params={"version": current["version"]}).status_code == 409
        finally: release.set()
        assert future.result().status_code == 200
    assert len(calls) == 1


@pytest.mark.skipif(not secret_store.supported(), reason="DPAPI exige Windows")
def test_key_is_encrypted_not_returned_and_corruption_is_reported(setup):
    client, app, settings = setup
    settings.openai_api_key = SecretStr("")
    key = "sk-fictional-dpapi-key-for-tests"
    configured = client.put("/api/charlie/config", json={"enabled": True, "model": "gpt-5-mini", "api_key": key})
    assert configured.status_code == 200, configured.text
    assert configured.json()["configured"] and key not in configured.text
    assert client.get("/api/charlie/config").json()["key_source"] == "windows"
    with app.state.sessions() as db:
        row = db.get(AISettings, 1)
        assert key not in row.key_cipher
        assert secret_store.unprotect(row.key_cipher) == key
        row.key_cipher = "corrupt"
        db.commit()
    assert client.get("/api/charlie/config").json()["key_error"]
    assert key not in str(client.get("/api/audit").json())
    assert client.delete("/api/charlie/config").status_code == 200
    assert not client.get("/api/charlie/config").json()["configured"]


def test_connection_test_requires_success_and_transmits_no_dossier(setup):
    client, app, _ = fake_config(setup)
    sent = []
    app.state.charlie_generate = lambda **kwargs: sent.append(kwargs) or "connexion confirmée"
    assert client.post("/api/charlie/test").json()["status"] == "confirmed"
    assert client.get("/api/charlie/config").json()["tested_at"]
    assert len(sent[0]["messages"]) == 1
    assert "CONTEXTE" not in sent[0]["messages"][0]["content"]
    def failed(**kwargs): raise ProviderError("Échec simulé")
    app.state.charlie_generate = failed
    assert client.post("/api/charlie/test").status_code == 502
    assert client.get("/api/charlie/config").json()["tested_at"] is None


def test_briefing_dates_are_utc_and_include_paris_midnight(setup):
    from zoneinfo import ZoneInfo
    client, app, _ = setup
    today = datetime.now(ZoneInfo("Europe/Paris")).date()
    start = datetime.combine(today, datetime.min.time(), ZoneInfo("Europe/Paris")).astimezone(timezone.utc)
    with app.state.sessions() as db:
        db.add(CalendarEvent(title="Rendez-vous de minuit", kind="other", starts_at=start+timedelta(minutes=30), ends_at=start+timedelta(hours=1)))
        db.commit()
    context = client.get("/api/charlie/context").json()
    assert context["data"]["appointments"][0]["title"] == "Rendez-vous de minuit"
    assert context["data"]["appointments"][0]["starts_at"].endswith("+00:00")


def test_provider_http_contract_and_output_parser(monkeypatch):
    sent = []
    original = httpx.Client
    def handle(request):
        sent.append(json.loads(request.content))
        assert request.url == "https://api.openai.com/v1/responses"
        assert request.headers["authorization"] == "Bearer sk-test-provider"
        return httpx.Response(200, json={"status":"completed", "output":[{"type":"reasoning","summary":[]},{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Brouillon confirmé"}]}]})
    monkeypatch.setattr(charlie_provider.httpx, "Client", lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs))
    answer = charlie_provider.generate_openai(key="sk-test-provider", model="gpt-5-mini", max_output_tokens=2048, messages=[{"role":"user","content":"Contexte de test"}])
    assert answer == "Brouillon confirmé"
    assert sent[0]["store"] is False and "tools" not in sent[0]
    assert "sk-test-provider" not in json.dumps(sent[0])


@pytest.mark.parametrize("status,body", [(401,{"error":"sk-should-not-echo"}), (429,{}), (200,{"status":"incomplete","output":[]}), (200,{"status":"completed","output":[]}), (200,[])])
def test_provider_errors_never_leak_raw_response(monkeypatch, status, body):
    original = httpx.Client
    monkeypatch.setattr(charlie_provider.httpx, "Client", lambda **kwargs: original(transport=httpx.MockTransport(lambda request:httpx.Response(status,json=body)), **kwargs))
    with pytest.raises(ProviderError) as error:
        charlie_provider.generate_openai(key="sk-private-test",model="gpt-5-mini",max_output_tokens=2048,messages=[])
    assert "sk-" not in str(error.value)
