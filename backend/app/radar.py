"""Radar de données déclarées ; aucune collecte distante ni route d’envoi."""
import csv
import hashlib
import io
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

from fastapi import Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from .commercial import normalized, utc
from .models import AutomationSettings, Prospect, ProspectActivity, RadarListing, RadarPrice, now
from .radar_schemas import ActivityInput, CSVInput, ListingInput, ProspectInput, today

CSV_COLUMNS = ["title", "source_name", "source_url", "city", "price", "surface", "seller_type", "property_type", "address", "district", "rooms", "published_on", "observed_on", "latitude", "longitude", "description", "rights_note", "status"]


def source_key(url):
    if not url: return None
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not k.lower().startswith("utm_")]
    canonical = urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/") or "/", urlencode(sorted(query)), ""))
    return hashlib.sha256(canonical.encode()).hexdigest()


def read_csv(text):
    text = text.lstrip("\ufeff")
    first = text.splitlines()[0] if text.splitlines() else ""
    delimiter = ";" if first.count(";") >= first.count(",") else ","
    try:
        reader = csv.DictReader(io.StringIO(text, newline=""), delimiter=delimiter, strict=True)
        if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames):
            raise HTTPException(422, "Les en-têtes CSV sont manquants ou répétés.")
        if set(reader.fieldnames) - set(CSV_COLUMNS) or not {"title", "source_name", "source_url", "city", "price", "surface"}.issubset(reader.fieldnames):
            raise HTTPException(422, "Colonnes CSV invalides. Utilisez le modèle fourni (title, source_name, source_url, city, price, surface obligatoires).")
        rows, errors = [], []
        for index, row in enumerate(reader, 2):
            if index > 201: raise HTTPException(422, "Un import est limité à 200 annonces.")
            if None in row or any(v is None for v in row.values()):
                errors.append({"line": index, "message": "Nombre de colonnes incorrect."})
                continue
            values = {k: v.strip() for k, v in row.items() if v.strip()}
            for field in ("price", "surface", "latitude", "longitude"):
                if field in values: values[field] = values[field].replace(",", ".")
            try:
                item = ListingInput(**values)
                if not item.source_url: raise ValueError("Une URL source est obligatoire pour éviter les imports répétés.")
                rows.append((index, item))
            except (ValidationError, ValueError) as e:
                # Ne pas réafficher les données complètes de la ligne dans une erreur.
                message = "; ".join(f"{'.'.join(map(str, v['loc']))} : {v['msg']}" for v in e.errors()) if isinstance(e, ValidationError) else str(e)
                errors.append({"line": index, "message": message[:500]})
        if not rows and not errors: raise HTTPException(422, "Le fichier CSV ne contient aucune annonce.")
        return rows, errors
    except csv.Error:
        raise HTTPException(422, "Le format CSV est invalide : vérifiez les guillemets et les séparateurs.")


def register_radar(api, *, database, user, writer, audit, find, save, check_version, record):
    first_price = select(RadarPrice.price).where(RadarPrice.listing_id == RadarListing.id).order_by(RadarPrice.created_at, RadarPrice.id).limit(1).correlate(RadarListing).scalar_subquery()

    def flush(db):
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Cette URL ou cette annonce est déjà enregistrée. Actualisez le radar avant de réessayer.")

    def listing_data(row, original=None):
        value = record(row)
        value.pop("source_key", None)
        value.pop("search_text", None)
        value["price_per_m2"] = str((row.price / row.surface).quantize(Decimal("0.01")))
        value["first_price"] = str(original) if original is not None else str(row.price)
        value["price_drop"] = bool(original is not None and row.price < original)
        value["age_days"] = (today()-row.published_on).days if row.published_on else None
        return value

    def apply(db, row, data, provenance=None):
        values = data.model_dump(exclude={"version", "observation_note"})
        if row.observed_on and data.observed_on < row.observed_on:
            raise HTTPException(422, "L’observation ne peut pas précéder la dernière observation enregistrée.")
        price_changed = row.price is None or row.price != data.price
        for name, value in values.items(): setattr(row, name, value)
        row.source_key = source_key(data.source_url)
        row.search_text = normalized(" ".join([row.title, row.city, row.district, row.address, row.source_name]))
        if provenance: row.provenance = provenance
        db.add(row)
        flush(db)
        if price_changed:
            db.add(RadarPrice(listing_id=row.id, price=row.price, observed_on=row.observed_on, note=data.observation_note or "Prix déclaré"))

    def filters(q, seller_type, status):
        result = []
        if q: result.append(RadarListing.search_text.contains(normalized(q), autoescape=True))
        if seller_type: result.append(RadarListing.seller_type == seller_type)
        if status: result.append(RadarListing.status == status)
        return result

    @api.get("/api/radar")
    def listings(q: str = Query(default="", max_length=120), seller_type: str = Query(default="", pattern=r"^(private|professional|unknown)?$"),
                 status: str = Query(default="", pattern=r"^(active|removed|sold)?$"), offset: int = Query(default=0, ge=0, le=100000),
                 limit: int = Query(default=40, ge=1, le=100), account=Depends(user), db=Depends(database)):
        conditions = filters(q, seller_type, status)
        total = db.scalar(select(func.count()).select_from(RadarListing).where(*conditions))
        rows = db.execute(select(RadarListing, first_price).where(*conditions).order_by(RadarListing.created_at.desc(), RadarListing.id).offset(offset).limit(limit)).all()
        return {"items": [listing_data(row, original) for row, original in rows], "total": total, "offset": offset, "limit": limit, "collection_available": False}

    @api.get("/api/radar/map")
    def map_points(q: str = Query(default="", max_length=120), account=Depends(user), db=Depends(database)):
        conditions = filters(q, "", "active")
        located = [*conditions, RadarListing.latitude.is_not(None), RadarListing.longitude.is_not(None)]
        total = db.scalar(select(func.count()).select_from(RadarListing).where(*located))
        rows = db.scalars(select(RadarListing).where(*located).order_by(RadarListing.id).limit(1000))
        missing = db.scalar(select(func.count()).select_from(RadarListing).where(*conditions, RadarListing.latitude.is_(None)))
        return {"items": [{key: value for key, value in listing_data(row).items() if key in ("id", "title", "city", "source_name", "price", "latitude", "longitude")} for row in rows], "total": total, "missing_coordinates": missing, "limited": total > 1000}

    @api.get("/api/radar/template/download")
    def template(account=Depends(user)):
        out = io.StringIO(newline="")
        csv.writer(out, delimiter=";", lineterminator="\r\n").writerow(CSV_COLUMNS)
        return Response("\ufeff"+out.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="modele-radar.csv"'})

    def preview(db, data):
        rows, errors = read_csv(data.text)
        keys = [source_key(item.source_url) for _, item in rows]
        existing = set(db.scalars(select(RadarListing.source_key).where(RadarListing.source_key.in_(keys)))) if keys else set()
        seen, result = set(), []
        for line, item in rows:
            key = source_key(item.source_url)
            duplicate = key in existing or key in seen
            result.append({"line": line, "item": item.model_dump(mode="json"), "duplicate": duplicate})
            seen.add(key)
        return {"rows": result, "errors": errors, "new_count": sum(not r["duplicate"] for r in result), "duplicate_count": sum(r["duplicate"] for r in result)}

    @api.post("/api/radar/import/preview")
    def preview_csv(data: CSVInput, account=Depends(user), db=Depends(database)):
        return preview(db, data)

    @api.post("/api/radar/import", status_code=201)
    def import_csv(data: CSVInput, account=Depends(writer), db=Depends(database)):
        if not data.rights_confirmed: raise HTTPException(422, "Confirmez que vous disposez des droits d’importation de ces données.")
        result = preview(db, data)
        if result["errors"]: raise HTTPException(422, "Corrigez toutes les lignes invalides avant l’import. Aucune ligne n’a été enregistrée.")
        for value in result["rows"]:
            if not value["duplicate"]:
                row = RadarListing()
                apply(db, row, ListingInput(**value["item"]), "csv")
                audit(db, account, "radar.import", row.id)
        save(db)
        return {"created": result["new_count"], "duplicates_ignored": result["duplicate_count"], "updated": 0}

    @api.post("/api/radar", status_code=201)
    def create_listing(data: ListingInput, account=Depends(writer), db=Depends(database)):
        row = RadarListing()
        apply(db, row, data, "manual")
        audit(db, account, "radar.create", row.id)
        save(db)
        return listing_data(row)

    @api.get("/api/radar/{identifier}")
    def detail(identifier: str, account=Depends(user), db=Depends(database)):
        row = find(db, RadarListing, identifier)
        prices = list(db.scalars(select(RadarPrice).where(RadarPrice.listing_id == row.id).order_by(RadarPrice.created_at, RadarPrice.id)))
        # Similitude déclarée, jamais une fusion : même commune/type, surface à ±5 %.
        candidates = db.scalars(select(RadarListing).where(RadarListing.id != row.id, func.lower(RadarListing.city) == row.city.lower(),
            RadarListing.property_type == row.property_type, RadarListing.surface.between(row.surface*Decimal(".95"), row.surface*Decimal("1.05")))
            .order_by(RadarListing.created_at.desc(), RadarListing.id).limit(20))
        return {**listing_data(row, prices[0].price if prices else None), "prices": [record(p) for p in prices],
                "possible_duplicates": [listing_data(p) for p in candidates]}

    @api.put("/api/radar/{identifier}")
    def update_listing(identifier: str, data: ListingInput, account=Depends(writer), db=Depends(database)):
        row = find(db, RadarListing, identifier)
        check_version(row, data.version)
        previous = {"price": str(row.price), "status": row.status}
        row.version += 1
        apply(db, row, data)
        audit(db, account, "radar.update", row.id, {"before": previous, "after": {"price": str(row.price), "status": row.status}})
        save(db)
        return listing_data(row)

    def activities(db, row):
        return list(db.scalars(select(ProspectActivity).where(ProspectActivity.prospect_id == row.id).order_by(ProspectActivity.occurred_at, ProspectActivity.id)))

    def prospect_data(db, row, listing, *, events=None, include_history=True, config=None):
        if events is None:
            events = db.execute(select(ProspectActivity.id, ProspectActivity.kind, ProspectActivity.occurred_at).where(ProspectActivity.prospect_id == row.id).order_by(ProspectActivity.occurred_at, ProspectActivity.id)).all()
        initial = next((e for e in events if e.kind == "initial"), None)
        stopped = row.opposed or row.permission == "refused" or any(e.kind in ("reply", "refusal", "appointment", "estimate", "mandate") for e in events)
        config = config or db.get(AutomationSettings, 1)
        due = utc(initial.occurred_at) + timedelta(days=config.followup_days) if initial else None
        available = bool(config.enabled and config.followups and initial and not stopped and not any(e.kind == "followup" for e in events) and listing.seller_type == "private" and listing.status == "active" and row.permission == "declared")
        history = list(db.scalars(select(ProspectActivity).where(ProspectActivity.prospect_id == row.id).order_by(ProspectActivity.occurred_at.desc(), ProspectActivity.id.desc()).limit(200))) if include_history else []
        return {**record(row), "listing": listing_data(listing), "activities": [record(e) for e in reversed(history)], "activity_count": len(events), "history_limited": len(events) > 200,
                "followup_due": due if available else None, "followup_ready": available and due <= now(),
                "sending_available": False}

    @api.get("/api/prospects")
    def prospects(offset: int = Query(default=0, ge=0, le=100000), limit: int = Query(default=40, ge=1, le=100), account=Depends(user), db=Depends(database)):
        rows = db.execute(select(Prospect, RadarListing).join(RadarListing, Prospect.listing_id == RadarListing.id)
                          .order_by(Prospect.created_at.desc(), Prospect.id).offset(offset).limit(limit)).all()
        total = db.scalar(select(func.count()).select_from(Prospect))
        start = datetime.combine(today(), datetime.min.time(), ZoneInfo("Europe/Paris")).astimezone(timezone.utc)
        end = datetime.combine(today()+timedelta(days=1), datetime.min.time(), ZoneInfo("Europe/Paris")).astimezone(timezone.utc)
        contacts_today = db.scalar(select(func.count()).select_from(ProspectActivity).where(ProspectActivity.kind.in_(["initial", "followup"]), ProspectActivity.occurred_at >= start, ProspectActivity.occurred_at < end))
        counts = {stage: count for stage, count in db.execute(select(Prospect.stage, func.count()).group_by(Prospect.stage))}
        config = db.get(AutomationSettings, 1)
        grouped = defaultdict(list)
        ids = [p.id for p, _ in rows]
        if ids:
            for event in db.execute(select(ProspectActivity.prospect_id, ProspectActivity.id, ProspectActivity.kind, ProspectActivity.occurred_at).where(ProspectActivity.prospect_id.in_(ids)).order_by(ProspectActivity.occurred_at, ProspectActivity.id)):
                grouped[event.prospect_id].append(event)
        outcomes = {kind: count for kind, count in db.execute(select(ProspectActivity.kind, func.count(func.distinct(ProspectActivity.prospect_id))).where(ProspectActivity.kind.in_(["appointment", "estimate", "mandate"])).group_by(ProspectActivity.kind))}
        return {"items": [prospect_data(db, p, listing, events=grouped[p.id], include_history=False, config=config) for p, listing in rows], "total": total, "offset": offset, "limit": limit,
                "contacts_declared_today": contacts_today, "daily_limit": config.daily_limit, "remaining_target": max(0, config.daily_limit-contacts_today),
                "stages": counts, "outcomes": outcomes, "sending_available": False, "automation_enabled": config.enabled}

    @api.get("/api/prospects/{identifier}")
    def prospect_detail(identifier: str, account=Depends(user), db=Depends(database)):
        row = find(db, Prospect, identifier)
        return prospect_data(db, row, find(db, RadarListing, row.listing_id))

    @api.post("/api/prospects", status_code=201)
    def create_prospect(data: ProspectInput, account=Depends(writer), db=Depends(database)):
        listing = find(db, RadarListing, data.listing_id)
        if listing.seller_type != "private" or listing.status != "active":
            raise HTTPException(422, "Seules les annonces actives de particuliers peuvent entrer en prospection vendeurs.")
        row = Prospect(**data.model_dump(exclude={"version"}))
        db.add(row)
        flush(db)
        audit(db, account, "prospect.create", row.id)
        save(db)
        return prospect_data(db, row, listing)

    @api.put("/api/prospects/{identifier}")
    def update_prospect(identifier: str, data: ProspectInput, account=Depends(writer), db=Depends(database)):
        row = find(db, Prospect, identifier)
        check_version(row, data.version)
        if data.listing_id != row.listing_id: raise HTTPException(422, "L’annonce d’un prospect ne peut pas être remplacée.")
        for key, value in data.model_dump(exclude={"version"}).items(): setattr(row, key, value)
        row.version += 1
        audit(db, account, "prospect.update", row.id, {"opposed": row.opposed, "permission": row.permission})
        save(db)
        return prospect_data(db, row, find(db, RadarListing, row.listing_id))

    @api.post("/api/prospects/{identifier}/activities")
    def activity(identifier: str, data: ActivityInput, account=Depends(writer), db=Depends(database)):
        row = find(db, Prospect, identifier)
        old = db.get(ProspectActivity, data.request_id)
        if old:
            if old.prospect_id != row.id or old.kind != data.kind or old.channel != data.channel or old.message != data.message or old.evidence != data.evidence or utc(old.occurred_at) != utc(data.occurred_at):
                raise HTTPException(409, "Cet identifiant est déjà utilisé par une autre activité.")
            return prospect_data(db, row, find(db, RadarListing, row.listing_id))
        check_version(row, data.version)
        if utc(data.occurred_at) > now()+timedelta(minutes=5): raise HTTPException(422, "Une activité déclarée ne peut pas être future.")
        events = activities(db, row)
        listing = find(db, RadarListing, row.listing_id)
        if data.kind in ("initial", "followup"):
            if listing.seller_type != "private" or listing.status != "active" or row.opposed or row.permission != "declared":
                raise HTTPException(422, "Contact bloqué : vérifiez particulier, annonce active, opposition et justification d’autorisation.")
            if not data.evidence: raise HTTPException(422, "Décrivez la preuve ou référence de cette action effectuée hors de l’outil.")
            if any(e.kind in ("reply", "refusal", "appointment", "estimate", "mandate") for e in events):
                raise HTTPException(422, "La séquence est arrêtée après une réponse ou un résultat. Ajoutez une note de suivi.")
            if data.kind == "initial" and any(e.kind == "initial" for e in events): raise HTTPException(409, "Le premier contact est déjà déclaré.")
            if data.kind == "followup":
                initial = next((e for e in events if e.kind == "initial"), None)
                config = db.get(AutomationSettings, 1)
                if not initial or any(e.kind == "followup" for e in events) or utc(data.occurred_at) < utc(initial.occurred_at)+timedelta(days=config.followup_days):
                    raise HTTPException(422, f"Une seule relance, au moins {config.followup_days} jours après le premier contact, est admise.")
        if data.kind == "refusal": row.opposed, row.permission = True, "refused"
        stages = {"initial": "contacted", "reply": "replied", "refusal": "excluded", "appointment": "appointment", "estimate": "estimate", "mandate": "won"}
        if data.kind in stages: row.stage = stages[data.kind]
        row.version += 1
        db.add(ProspectActivity(id=data.request_id, prospect_id=row.id, **data.model_dump(exclude={"version", "request_id"})))
        audit(db, account, "prospect.activity.declared", row.id, {"kind": data.kind, "channel": data.channel, "request_id": data.request_id})
        save(db)
        return prospect_data(db, row, listing)
