"""Fonctions métier locales ; aucune requête vers un service tiers."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import re
import unicodedata

from fastapi import Depends, HTTPException, Query, Response
from sqlalchemy import select
from zoneinfo import ZoneInfo

from .models import BuyerCriteria, CalendarEvent, Contact, Estimate, Mandate, Property
from .commercial_schemas import EstimateInput, EventInput


def normalized(value):
    return " ".join("".join(c for c in unicodedata.normalize("NFKD", value.casefold())
                            if not unicodedata.combining(c)).replace("-", " ").split())


def matches_for(buyer, criteria, mandate, prop):
    checks, unknown, failures = [], [], []
    if not criteria:
        unknown.append("Aucun critère de recherche renseigné")
    else:
        if criteria.budget_max > 0:
            if criteria.budget_min <= mandate.price <= criteria.budget_max:
                checks.append("Prix dans la fourchette de budget")
            else:
                failures.append("Prix hors de la fourchette de budget")
        else:
            unknown.append("Budget maximum non renseigné")
        if criteria.min_surface > 0:
            (checks if prop.surface >= criteria.min_surface else failures).append(
                "Surface minimum respectée" if prop.surface >= criteria.min_surface else "Surface inférieure au minimum")
        else:
            unknown.append("Surface minimum non renseignée")
        if criteria.sectors.strip():
            sectors = {normalized(s) for s in re.split(r"[,;\n]", criteria.sectors) if s.strip()}
            (checks if normalized(prop.city) in sectors else failures).append(
                "Commune dans les secteurs demandés" if normalized(prop.city) in sectors else "Commune absente des secteurs demandés")
        else:
            unknown.append("Secteurs non renseignés")
        if criteria.bedrooms:
            unknown.append(f"{criteria.bedrooms} chambre(s) demandée(s) : nombre de chambres du bien à vérifier (les pièces ne sont pas des chambres)")
        if criteria.mandatory.strip():
            unknown.append("Critères impératifs à vérifier : " + criteria.mandatory)
        unknown.append("Financement à confirmer : " + criteria.financing)
    # Ce pourcentage décrit uniquement les trois contrôles structurés, pas une probabilité de vente.
    return {"buyer_id": buyer.id, "buyer_name": buyer.name, "mandate_id": mandate.id,
            "reference": mandate.reference, "title": prop.title, "city": prop.city,
            "price": str(mandate.price), "score": round(len(checks) * 100 / 3),
            "compatible": not failures and bool(checks), "checks": checks,
            "failures": failures, "to_verify": unknown}


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def ics_text(value):
    return value.replace("\\", "\\\\").replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n").replace(";", "\\;").replace(",", "\\,")


def fold_ics(line):
    """RFC 5545 : lignes de 75 octets au maximum, sans couper un caractère UTF-8."""
    result, part = [], ""
    for char in line:
        if len((part + char).encode("utf-8")) > 75:
            result.append(part)
            part = " "
        part += char
    result.append(part)
    return "\r\n".join(result)


def register_commercial(api, *, database, user, writer, audit, find, save, check_version, record):
    def links(db, data):
        if data.contact_id:
            contact = find(db, Contact, data.contact_id)
            if contact.archived:
                raise HTTPException(422, "Ce contact est archivé. Choisissez un contact actif.")
        if getattr(data, "mandate_id", None):
            find(db, Mandate, data.mandate_id)

    @api.get("/api/matches")
    def matches(buyer_id: str | None = None, mandate_id: str | None = None,
                account=Depends(user), db=Depends(database)):
        buyers_query = select(Contact, BuyerCriteria).outerjoin(BuyerCriteria, BuyerCriteria.contact_id == Contact.id).where(
            Contact.archived.is_(False), Contact.kind.in_(["buyer", "both"]))
        if buyer_id:
            buyers_query = buyers_query.where(Contact.id == buyer_id)
        today = datetime.now(ZoneInfo("Europe/Paris")).date()
        mandates_query = select(Mandate, Property).join(Property, Mandate.property_id == Property.id).where(
            Mandate.status.in_(["active", "offer"]), Mandate.end_date >= today,
            (Mandate.kind != "partner") | Mandate.commercialization_authorized.is_(True))
        if mandate_id:
            mandates_query = mandates_query.where(Mandate.id == mandate_id)
        buyers = db.execute(buyers_query.order_by(Contact.id).limit(501)).all()
        mandates = db.execute(mandates_query.order_by(Mandate.id).limit(501)).all()
        if len(buyers) > 500 or len(mandates) > 500 or len(buyers) * len(mandates) > 25000:
            raise HTTPException(422, "Sélectionnez un acquéreur ou un mandat pour limiter l’analyse.")
        results = [matches_for(b, c, m, p) for b, c in buyers for m, p in mandates if b.id != m.seller_id]
        results.sort(key=lambda r: (not r["compatible"], -r["score"], r["buyer_name"], r["reference"]))
        return {"items": results[:500], "total": len(results), "limited": len(results) > 500}

    def interval(from_at, to_at):
        start = from_at or datetime.now(timezone.utc) - timedelta(days=30)
        end = to_at or datetime.now(timezone.utc) + timedelta(days=365)
        if start.utcoffset() is None or end.utcoffset() is None or not timedelta(0) < end - start <= timedelta(days=400):
            raise HTTPException(422, "Choisissez une période avec fuseau horaire, de 400 jours maximum.")
        return start.astimezone(timezone.utc), end.astimezone(timezone.utc)

    def events_in(db, start, end):
        return list(db.scalars(select(CalendarEvent).where(CalendarEvent.starts_at < end, CalendarEvent.ends_at > start)
                               .order_by(CalendarEvent.starts_at, CalendarEvent.id).limit(1001)))

    @api.get("/api/calendar")
    def calendar(from_at: datetime | None = None, to_at: datetime | None = None, account=Depends(user), db=Depends(database)):
        rows = events_in(db, *interval(from_at, to_at))
        return {"items": [record(e) for e in rows[:1000]], "limited": len(rows) > 1000}

    @api.post("/api/calendar", status_code=201)
    def create_event(data: EventInput, account=Depends(writer), db=Depends(database)):
        links(db, data)
        row = CalendarEvent(**data.model_dump(exclude={"version"}))
        db.add(row)
        db.flush()
        audit(db, account, "calendar.create", row.id)
        save(db)
        return record(row)

    @api.put("/api/calendar/{identifier}")
    def update_event(identifier: str, data: EventInput, account=Depends(writer), db=Depends(database)):
        row = find(db, CalendarEvent, identifier)
        check_version(row, data.version)
        links(db, data)
        for key, value in data.model_dump(exclude={"version"}).items():
            setattr(row, key, value)
        row.version += 1
        audit(db, account, "calendar.update", row.id)
        save(db)
        return record(row)

    @api.delete("/api/calendar/{identifier}", status_code=204)
    def delete_event(identifier: str, version: int = Query(ge=1), account=Depends(writer), db=Depends(database)):
        row = find(db, CalendarEvent, identifier)
        check_version(row, version)
        db.delete(row)
        audit(db, account, "calendar.delete", row.id)
        save(db)

    @api.get("/api/calendar/export/download")
    def calendar_export(from_at: datetime | None = None, to_at: datetime | None = None, account=Depends(user), db=Depends(database)):
        rows = events_in(db, *interval(from_at, to_at))
        if len(rows) > 1000:
            raise HTTPException(422, "Réduisez la période pour exporter au maximum 1 000 rendez-vous.")
        lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//IMMO PILOT AI//Agenda local//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        for e in rows:
            lines.extend(["BEGIN:VEVENT", f"UID:{e.id}@immopilot.local", f"DTSTAMP:{stamp}",
                "DTSTART:" + utc(e.starts_at).strftime("%Y%m%dT%H%M%SZ"),
                "DTEND:" + utc(e.ends_at).strftime("%Y%m%dT%H%M%SZ"),
                "SUMMARY:" + ics_text(e.title), "LOCATION:" + ics_text(e.location),
                "DESCRIPTION:" + ics_text(e.notes), "END:VEVENT"])
        lines.append("END:VCALENDAR")
        return Response("\r\n".join(fold_ics(line) for line in lines) + "\r\n", media_type="text/calendar; charset=utf-8",
                        headers={"Content-Disposition": 'attachment; filename="agenda-immo-pilot.ics"'})

    @api.get("/api/estimates")
    def estimates(account=Depends(user), db=Depends(database)):
        rows = list(db.scalars(select(Estimate).order_by(Estimate.created_at.desc(), Estimate.id).limit(1001)))
        return {"items": [record(e) for e in rows[:1000]], "limited": len(rows) > 1000}

    def apply_estimate(db, row, data):
        links(db, data)
        values = data.model_dump(exclude={"version", "details", "comparables"})
        for key, value in values.items():
            setattr(row, key, value)
        row.details = data.details.model_dump(mode="json")
        row.comparables = [c.model_dump(mode="json") for c in data.comparables]
        db.add(row)

    @api.post("/api/estimates", status_code=201)
    def create_estimate(data: EstimateInput, account=Depends(writer), db=Depends(database)):
        row = Estimate()
        apply_estimate(db, row, data)
        db.flush()
        audit(db, account, "estimate.create", row.id)
        save(db)
        return record(row)

    @api.put("/api/estimates/{identifier}")
    def update_estimate(identifier: str, data: EstimateInput, account=Depends(writer), db=Depends(database)):
        row = find(db, Estimate, identifier)
        check_version(row, data.version)
        apply_estimate(db, row, data)
        row.version += 1
        audit(db, account, "estimate.update", row.id)
        save(db)
        return record(row)

    @api.get("/api/estimates/{identifier}/download")
    def estimate_report(identifier: str, account=Depends(user), db=Depends(database)):
        from .estimate_pdf import render_estimate
        row = find(db, Estimate, identifier)
        content = render_estimate(row, account.name)
        audit(db, account, "estimate.report", row.id)
        save(db)
        return Response(content, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="estimation-{row.id}.pdf"'})
