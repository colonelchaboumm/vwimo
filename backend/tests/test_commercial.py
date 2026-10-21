from datetime import date, datetime, timedelta

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import select

from app.main import create_app
from app.models import Mandate, User
from test_application import mandate_payload


def event_payload(**changes):
    return {"title": "Visite appartement Annecy", "kind": "visit", "starts_at": "2026-10-25T01:30:00+02:00",
            "ends_at": "2026-10-25T03:30:00+01:00", "location": "Annecy", "notes": "Préparer le dossier", **changes}


def estimate_payload(**changes):
    return {"title": "Estimation appartement", "address": "1 rue de test", "city": "Annecy", "property_type": "Appartement", "surface": "70.00",
            "low_price": "350000", "central_price": "380000", "high_price": "410000", "basis": "sale", "analysis": "Travaux à chiffrer.\nValider la stratégie avec le propriétaire.",
            "details": {"dpe": "C", "rooms": 3, "bedrooms": 2, "features": "Terrasse et garage"},
            "comparables": [{"label": "Vente comparable", "source": "Référence de vente déclarée", "url": "https://example.com/reference", "observed_date": "2026-01-01", "kind": "sale", "price": "350000.00", "surface": "65.00"}], **changes}


def test_calendar_timezone_overlap_and_persistence(setup):
    client, app, settings = setup
    created = client.post("/api/calendar", json=event_payload())
    assert created.status_code == 201, created.text
    identifier = created.json()["id"]
    start = datetime.fromisoformat(created.json()["starts_at"])
    end = datetime.fromisoformat(created.json()["ends_at"])
    assert end - start == timedelta(hours=3)  # Le passage à l'heure d'hiver ajoute une heure réelle.
    params = {"from_at": "2026-10-25T00:00:00Z", "to_at": "2026-10-25T01:00:00Z"}
    assert client.get("/api/calendar", params=params).json()["items"][0]["id"] == identifier
    params = {"from_at": "2026-10-25T02:30:00Z", "to_at": "2026-10-25T04:00:00Z"}
    assert client.get("/api/calendar", params=params).json()["items"] == []
    with TestClient(create_app(settings)) as restarted:
        restarted.headers["Authorization"] = client.headers["Authorization"]
        params = {"from_at": "2026-10-24T00:00:00Z", "to_at": "2026-10-26T00:00:00Z"}
        assert restarted.get("/api/calendar", params=params).json()["items"][0]["title"] == "Visite appartement Annecy"


@pytest.mark.parametrize("changes", [
    {"ends_at": "2026-10-24T00:00:00Z"}, {"starts_at": "2026-10-25T01:30:00"},
    {"ends_at": "2027-01-01T00:00:00Z"}, {"contact_id": "absent"}, {"kind": "unknown"},
])
def test_calendar_rejects_invalid_dates_and_links(client, changes):
    assert client.post("/api/calendar", json=event_payload(**changes)).status_code in (404, 422)


def test_calendar_versions_and_delete_are_protected(client):
    created = client.post("/api/calendar", json=event_payload()).json()
    path = "/api/calendar/" + created["id"]
    assert client.put(path, json=event_payload()).status_code == 428
    assert client.put(path, json=event_payload(version=created["version"], title="Visite confirmée")).status_code == 200
    assert client.put(path, json=event_payload(version=created["version"])).status_code == 409
    assert client.delete(path, params={"version": created["version"]}).status_code == 409
    assert client.delete(path, params={"version": created["version"] + 1}).status_code == 204


def test_ics_escapes_injection_folds_unicode_and_keeps_timezone(client):
    data = event_payload(title="Visite é" * 30, notes="Notes\r\nEND:VEVENT\r\nBEGIN:VEVENT;ATTENDEE:other@example.com")
    data["title"] = data["title"][:180]
    assert client.post("/api/calendar", json=data).status_code == 201
    params = {"from_at": "2026-10-24T00:00:00Z", "to_at": "2026-10-26T00:00:00Z"}
    result = client.get("/api/calendar/export/download", params=params)
    assert result.status_code == 200
    text = result.content.decode("utf-8")
    assert "DTSTART:20261024T233000Z" in text
    assert "DTEND:20261025T023000Z" in text
    assert text.count("\r\nBEGIN:VEVENT\r\n") == 1
    assert "\\nEND:VEVENT\\nBEGIN:VEVENT\\;ATTENDEE" in text.replace("\r\n ", "")
    assert all(len(line.encode("utf-8")) <= 75 for line in text.split("\r\n"))
    assert client.get("/api/calendar", params={"from_at": "2026-01-01", "to_at": "2030-01-01"}).status_code == 422


def test_estimate_sources_versions_and_report(client):
    payload = estimate_payload()
    created = client.post("/api/estimates", json=payload)
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["comparables"][0]["price"] == "350000.00"
    assert row["details"]["bedrooms"] == 2
    assert client.get("/api/estimates").json()["items"][0]["id"] == row["id"]
    path = "/api/estimates/" + row["id"]
    assert client.put(path, json=payload).status_code == 428
    assert client.put(path, json={**payload, "version": row["version"], "status": "presented"}).status_code == 200
    assert client.put(path, json={**payload, "version": row["version"]}).status_code == 409
    pdf = client.get(path + "/download")
    assert pdf.status_code == 200, pdf.text[:200] if pdf.status_code != 200 else ""
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF-") and len(pdf.content) > 10000
    assert client.get("/api/audit").json()[0]["action"] == "estimate.report"


@pytest.mark.parametrize("changes", [
    {"low_price": "500000"}, {"surface": "0"}, {"basis": "sale", "comparables": []},
    {"contact_id": "absent"}, {"comparables": [{"label": "Bad", "source": "Test", "kind": "sale", "price": 100, "surface": 20, "observed_date": "2099-01-01"}]},
    {"comparables": [{"label": "Bad", "source": "Test", "kind": "sale", "price": 100, "surface": 0, "observed_date": "2026-01-01"}]},
])
def test_estimate_rejects_invalid_prices_sources_and_links(client, changes):
    assert client.post("/api/estimates", json=estimate_payload(**changes)).status_code in (404, 422)


def test_matching_is_explained_filters_and_recalculates(client):
    criteria = {"budget_min": "350000", "budget_max": "450000", "min_surface": "65", "bedrooms": 2, "sectors": "ANNECY; Sévrier", "mandatory": "Ascenseur"}
    buyer = client.post("/api/contacts", json={"name": "Acquéreur matching", "kind": "buyer", "criteria": criteria}).json()
    payload = mandate_payload(client)
    mandate = client.post("/api/mandates", json=payload).json()
    query = {"buyer_id": buyer["id"], "mandate_id": mandate["id"]}
    result = client.get("/api/matches", params=query).json()["items"][0]
    assert result["compatible"] and result["score"] == 100
    assert len(result["checks"]) == 3
    assert any("chambres du bien à vérifier" in text for text in result["to_verify"])
    assert any("Ascenseur" in text for text in result["to_verify"])
    assert client.put("/api/mandates/" + mandate["id"], json={**payload, "version": mandate["version"], "price": "500000"}).status_code == 200
    result = client.get("/api/matches", params=query).json()["items"][0]
    assert not result["compatible"] and "Prix hors" in result["failures"][0]
    assert client.delete("/api/contacts/" + buyer["id"]).status_code == 204
    assert client.get("/api/matches", params=query).json()["items"] == []


def test_matching_excludes_unmarketable_properties_and_unknown_criteria(setup):
    client, app, _ = setup
    buyer = client.post("/api/contacts", json={"name": "Sans critères", "kind": "buyer"}).json()
    mandate = client.post("/api/mandates", json=mandate_payload(client)).json()
    query = {"buyer_id": buyer["id"], "mandate_id": mandate["id"]}
    result = client.get("/api/matches", params=query).json()["items"][0]
    assert not result["compatible"] and result["score"] == 0
    for changes in ({"kind": "partner", "commercialization_authorized": False}, {"status": "sold"}, {"end_date": date(2020, 1, 1)}):
        with app.state.sessions() as db:
            row = db.get(Mandate, mandate["id"])
            row.kind, row.status, row.commercialization_authorized, row.signed_date, row.end_date = "exclusive", "active", True, date(2019, 1, 1), date(2099, 1, 1)
            for key, value in changes.items(): setattr(row, key, value)
            db.commit()
        assert client.get("/api/matches", params=query).json()["items"] == []


def test_commercial_permissions(setup):
    client, app, _ = setup
    event = client.post("/api/calendar", json=event_payload()).json()
    estimate = client.post("/api/estimates", json=estimate_payload()).json()
    with app.state.sessions() as db:
        db.scalar(select(User)).role = "reader"
        db.commit()
    assert client.get("/api/estimates").status_code == 200
    assert client.get("/api/matches").status_code == 200
    assert client.post("/api/estimates", json=estimate_payload()).status_code == 403
    assert client.put("/api/estimates/" + estimate["id"], json=estimate_payload(version=1)).status_code == 403
    assert client.post("/api/calendar", json=event_payload()).status_code == 403
    assert client.put("/api/calendar/" + event["id"], json=event_payload(version=1)).status_code == 403
    assert client.delete("/api/calendar/" + event["id"], params={"version": 1}).status_code == 403
    client.headers.pop("Authorization")
    assert client.get("/api/calendar").status_code == 401
    assert client.get("/api/matches").status_code == 401
    assert client.get("/api/estimates/" + estimate["id"] + "/download").status_code == 401
