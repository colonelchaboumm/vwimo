from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app.models import Contact, Mandate, ProspectActivity, RadarListing, User
from app.radar_schemas import today


def listing(**changes):
    return {"title": "Appartement déclaré à Annecy", "source_name": "Fiche fournie", "source_url": "https://example.org/annonce/123",
            "city": "Annecy", "price": "350000.00", "surface": "70.00", "seller_type": "private", "latitude": "45.900000", "longitude": "6.120000", **changes}


def create(client, **changes):
    result = client.post("/api/radar", json=listing(**changes))
    assert result.status_code == 201, result.text
    return result.json()


def prospect(client, row):
    result = client.post("/api/prospects", json={"listing_id": row["id"], "permission": "declared", "permission_note": "Autorisation documentée pour le canal déclaré."})
    assert result.status_code == 201, result.text
    return result.json()


def event(client, row, **changes):
    return {"version": row["version"], "request_id": str(uuid4()), "kind": "initial", "channel": "phone",
            "occurred_at": (datetime.now(timezone.utc)-timedelta(days=8)).isoformat(), "message": "Entretien effectué à la demande du vendeur", "evidence": "Compte rendu personnel de l’entretien", **changes}


def test_radar_history_conflicts_and_separate_portfolio(setup):
    client, app, settings = setup
    with app.state.sessions() as db:
        before = [db.scalar(select(func.count()).select_from(model)) for model in (Contact, Mandate)]
    row = create(client, published_on=(today()-timedelta(days=45)).isoformat())
    update = listing(version=row["version"], price="325000.00", published_on=(today()-timedelta(days=45)).isoformat(), observation_note="Nouvelle fiche transmise")
    assert client.put("/api/radar/"+row["id"], json=update).status_code == 200
    assert client.put("/api/radar/"+row["id"], json=update).status_code == 409
    value = client.get("/api/radar/"+row["id"]).json()
    assert [p["price"] for p in value["prices"]] == ["350000.00", "325000.00"]
    assert value["price_drop"] and value["age_days"] == 45
    assert value["price_per_m2"] == "4642.86"
    with app.state.sessions() as db:
        assert [db.scalar(select(func.count()).select_from(model)) for model in (Contact, Mandate)] == before


def test_radar_duplicate_url_normalization_and_possible_duplicates(client):
    first = create(client, source_url="https://EXAMPLE.org/annonce/123/?b=2&a=1&utm_source=foo#top")
    assert client.post("/api/radar", json=listing(source_url="https://example.org/annonce/123?a=1&b=2")).status_code == 409
    second = create(client, source_url="https://another.example/456", surface="72.00")
    candidates = client.get("/api/radar/"+first["id"]).json()["possible_duplicates"]
    assert [r["id"] for r in candidates] == [second["id"]]
    assert client.get("/api/radar?q=annecy&limit=1").json()["total"] == 2
    assert len(client.get("/api/radar?offset=1&limit=1").json()["items"]) == 1


def test_radar_csv_preview_atomicity_and_idempotent_reimport(client):
    text = "title;source_name;source_url;city;price;surface\r\nAppartement test;Dossier fourni;https://example.org/1;Annecy;350000,50;70\r\n"
    preview = client.post("/api/radar/import/preview", json={"text": text}).json()
    assert preview["new_count"] == 1 and not preview["errors"]
    assert client.get("/api/radar").json()["total"] == 0
    assert client.post("/api/radar/import", json={"text": text}).status_code == 422
    invalid = text + "Autre annonce;Fichier;https://example.org/2;Annecy;-1;50\r\n"
    assert client.post("/api/radar/import", json={"text": invalid, "rights_confirmed": True}).status_code == 422
    assert client.get("/api/radar").json()["total"] == 0
    result = client.post("/api/radar/import", json={"text": text, "rights_confirmed": True}).json()
    assert result == {"created": 1, "duplicates_ignored": 0, "updated": 0}
    again = client.post("/api/radar/import", json={"text": text.replace("350000,50", "320000"), "rights_confirmed": True}).json()
    assert again == {"created": 0, "duplicates_ignored": 1, "updated": 0}
    assert client.get("/api/radar").json()["items"][0]["price"] == "350000.50"
    assert "source_url" in client.get("/api/radar/template/download").text


def test_csv_limits_malformed_headers_and_source_required(client):
    for text in ("title;title\na;b", "unknown\na", "title;source_name;source_url;city;price;surface\nA;B;;Annecy;300000;50"):
        response = client.post("/api/radar/import/preview", json={"text": text})
        assert response.status_code == 422 or response.json()["errors"]
    header = "title;source_name;source_url;city;price;surface\n"
    assert client.post("/api/radar/import/preview", json={"text": header+"".join(f"Annonce {i};Fichier;https://example.org/{i};Annecy;300000;50\n" for i in range(201))}).status_code == 422


def test_radar_validations_map_and_normalized_search(client):
    for changes in ({"source_url": "javascript:alert(1)"}, {"source_url": "https://user:password@example.org/a"}, {"latitude": "90"}, {"longitude": None}, {"surface": "NaN"}, {"price": "-1"}, {"published_on": (today()+timedelta(days=1)).isoformat()}):
        assert client.post("/api/radar", json=listing(**changes)).status_code == 422
    create(client, title="Maison à Sévrier", city="Sévrier")
    assert client.get("/api/radar?q=sevrier").json()["total"] == 1
    assert client.get("/api/radar?q=%25").json()["total"] == 0
    create(client, source_url="", latitude=None, longitude=None)
    value = client.get("/api/radar/map").json()
    assert len(value["items"]) == 1 and value["missing_coordinates"] == 1
    assert value["items"][0]["latitude"] == "45.900000"


def test_prospect_private_only_and_no_implicit_contacts(client):
    for seller in ("professional", "unknown"):
        row = create(client, source_url="https://example.org/"+seller, seller_type=seller)
        assert client.post("/api/prospects", json={"listing_id": row["id"]}).status_code == 422
    row = create(client)
    p = prospect(client, row)
    assert client.post("/api/prospects", json={"listing_id": row["id"]}).status_code == 409
    assert not p["activities"] and not p["sending_available"]
    assert client.post("/api/prospects", json={"listing_id": row["id"], "permission": "declared"}).status_code == 422


def test_prospect_followup_replay_and_stop_after_reply(setup):
    client, app, settings = setup
    p = prospect(client, create(client))
    data = event(client, p)
    path = "/api/prospects/"+p["id"]+"/activities"
    response = client.post(path, json=data)
    assert response.status_code == 200, response.text
    p = response.json()
    assert p["stage"] == "contacted" and p["followup_ready"]
    assert client.post(path, json=data).json()["activities"] == p["activities"]
    assert client.post(path, json={**data, "message": "Message différent"}).status_code == 409
    early = event(client, p, kind="followup", occurred_at=(datetime.now(timezone.utc)-timedelta(days=7)).isoformat())
    assert client.post(path, json=early).status_code == 422
    reply = event(client, p, kind="reply", occurred_at=datetime.now(timezone.utc).isoformat())
    p = client.post(path, json=reply).json()
    assert not p["followup_due"] and p["stage"] == "replied"
    assert client.post(path, json=event(client, p, kind="followup", occurred_at=datetime.now(timezone.utc).isoformat())).status_code == 422
    with app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(ProspectActivity)) == 2


def test_one_followup_and_refusal_blocks_sequence(client):
    p = prospect(client, create(client))
    path = "/api/prospects/"+p["id"]+"/activities"
    p = client.post(path, json=event(client, p)).json()
    p = client.post(path, json=event(client, p, kind="followup", occurred_at=datetime.now(timezone.utc).isoformat())).json()
    assert not p["followup_due"]
    assert client.post(path, json=event(client, p, kind="followup", occurred_at=datetime.now(timezone.utc).isoformat())).status_code == 422
    p = client.post(path, json=event(client, p, kind="refusal", occurred_at=datetime.now(timezone.utc).isoformat())).json()
    assert p["opposed"] and p["permission"] == "refused" and p["stage"] == "excluded"


def test_contact_declaration_requires_permission_and_evidence(client):
    row = create(client)
    p = client.post("/api/prospects", json={"listing_id": row["id"]}).json()
    path = "/api/prospects/"+p["id"]+"/activities"
    assert client.post(path, json=event(client, p)).status_code == 422
    assert client.post(path, json=event(client, p, kind="note", occurred_at="2026-10-22T10:00")).status_code == 422
    assert client.post(path, json=event(client, p, kind="note", occurred_at=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat())).status_code == 422
    p = client.put("/api/prospects/"+p["id"], json={"listing_id": row["id"], "version": p["version"], "permission": "declared", "permission_note": "Justification détaillée du canal"}).json()
    assert client.post(path, json=event(client, p, evidence="")).status_code == 422


def test_radar_and_prospect_reader_permissions(setup):
    client, app, settings = setup
    row = create(client)
    p = prospect(client, row)
    with app.state.sessions() as db:
        user = db.scalar(select(User).where(User.email == "camille@demo.local"))
        if user is None: user = db.scalar(select(User).limit(1))
        user.role = "reader"
        db.commit()
    for path in ("/api/radar", "/api/radar/map", "/api/prospects", "/api/radar/"+row["id"]):
        assert client.get(path).status_code == 200
    assert client.post("/api/radar", json=listing()).status_code == 403
    assert client.put("/api/radar/"+row["id"], json=listing(version=row["version"])).status_code == 403
    assert client.post("/api/prospects", json={"listing_id": row["id"]}).status_code == 403
    assert client.post("/api/prospects/"+p["id"]+"/activities", json=event(client, p)).status_code == 403


def test_concurrent_listing_updates_create_only_one_observation(setup):
    client, app, settings = setup
    row = create(client)
    data = listing(version=row["version"], price="340000.00")
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: client.put("/api/radar/"+row["id"], json=data).status_code, range(2)))
    assert sorted(results) == [200, 409]
    assert len(client.get("/api/radar/"+row["id"]).json()["prices"]) == 2


def test_prospect_summary_counts_paris_day_and_deduplicated_outcomes(setup):
    client, app, settings = setup
    p = prospect(client, create(client))
    start = datetime.combine(today(), datetime.min.time(), ZoneInfo("Europe/Paris")).astimezone(timezone.utc)
    with app.state.sessions() as db:
        for kind, timestamp in (("initial", start-timedelta(minutes=1)), ("followup", start+timedelta(minutes=1)), ("appointment", start), ("appointment", start)):
            db.add(ProspectActivity(prospect_id=p["id"], occurred_at=timestamp, kind=kind, channel="phone", message="Déclaration de test", evidence="Test"))
        db.commit()
    value = client.get("/api/prospects").json()
    assert value["contacts_declared_today"] == 1 and value["outcomes"]["appointment"] == 1
    assert value["items"][0]["activity_count"] == 4 and value["items"][0]["activities"] == []
    assert len(client.get("/api/prospects/"+p["id"]).json()["activities"]) == 4


def test_automation_stop_removes_followup_suggestion(client):
    p = prospect(client, create(client))
    p = client.post("/api/prospects/"+p["id"]+"/activities", json=event(client, p)).json()
    assert p["followup_ready"]
    assert client.put("/api/settings/automation", json={"enabled": False}).status_code == 200
    assert client.get("/api/prospects/"+p["id"]).json()["followup_due"] is None
