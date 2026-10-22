"""Lectures structurées et bornées des dossiers ; aucun accès arbitraire à SQL ou aux fichiers."""
import hashlib
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, select

from .commercial import matches_for, normalized
from .models import BuyerCriteria, CalendarEvent, Contact, Estimate, Mandate, Property


def make_context(db, kind, identifier=None):
    today = datetime.now(ZoneInfo("Europe/Paris")).date()
    sources = []
    def source(entity, row, label):
        sources.append({"kind": entity, "id": row.id, "label": label})
    def required(model):
        row = db.get(model, identifier) if identifier else None
        if not row or getattr(row, "archived", False):
            raise HTTPException(404, "Le dossier de contexte est introuvable ou archivé.")
        return row
    if kind == "briefing":
        start = datetime.combine(today, datetime.min.time(), ZoneInfo("Europe/Paris")).astimezone(timezone.utc)
        upcoming = list(db.scalars(select(CalendarEvent).where(CalendarEvent.starts_at >= start,
            CalendarEvent.starts_at < start + timedelta(days=7)).order_by(CalendarEvent.starts_at).limit(10)))
        follow = list(db.scalars(select(Mandate).where(Mandate.status.in_(["active", "offer", "compromise"]),
            (Mandate.end_date <= today + timedelta(days=15)) | (Mandate.signed_date <= today - timedelta(days=45)))
            .order_by(Mandate.end_date).limit(10)))
        data = {"date": str(today), "timezone": "Europe/Paris", "active_mandates": db.scalar(select(func.count()).select_from(Mandate).where(Mandate.status.in_(["active", "offer", "compromise"]))),
            "buyers": db.scalar(select(func.count()).select_from(Contact).where(Contact.archived.is_(False), Contact.kind.in_(["buyer", "both"]))),
            "draft_estimates": db.scalar(select(func.count()).select_from(Estimate).where(Estimate.status == "draft")),
            "appointments": [{"id": e.id, "title": e.title, "starts_at": e.starts_at, "location": e.location} for e in upcoming],
            "mandates_to_review": [{"id": m.id, "reference": m.reference, "end_date": m.end_date, "age_days": (today-m.signed_date).days} for m in follow],
            "limits": "Au maximum 10 rendez-vous et 10 mandats à suivre. Aucun e-mail, document ou flux externe consulté."}
        for e in upcoming: source("calendar", e, e.title)
        for m in follow: source("mandate", m, m.reference)
    elif kind in ("contact", "matching"):
        c = required(Contact)
        criteria = db.get(BuyerCriteria, c.id)
        source("contact", c, c.name)
        data = {"id": c.id, "name": c.name, "kind": c.kind, "city": c.city, "notes": c.notes[:3000], "provenance": c.provenance,
            "criteria": {"budget_min": criteria.budget_min, "budget_max": criteria.budget_max, "min_surface": criteria.min_surface,
                "bedrooms": criteria.bedrooms, "sectors": criteria.sectors, "financing": criteria.financing, "mandatory": criteria.mandatory[:2000]} if criteria else None}
        if kind == "matching":
            if c.kind not in ("buyer", "both"):
                raise HTTPException(422, "Sélectionnez un contact acquéreur pour les rapprochements.")
            rows = db.execute(select(Mandate, Property).join(Property, Mandate.property_id == Property.id).where(
                Mandate.status.in_(["active", "offer"]), Mandate.end_date >= today,
                (Mandate.kind != "partner") | Mandate.commercialization_authorized.is_(True)).order_by(Mandate.id).limit(201)).all()
            if len(rows) > 200:
                raise HTTPException(422, "Utilisez la page Rapprochements pour analyser ce portefeuille de plus de 200 mandats.")
            results = [matches_for(c, criteria, m, p) for m, p in rows if m.seller_id != c.id]
            results = [r for r in results if r["compatible"]]
            results.sort(key=lambda r: (-r["score"], r["reference"]))
            data["matches"] = results[:5]
            data["matching_limit"] = "5 pistes maximum ; chambres, financement et critères libres à vérifier. Aucun message envoyé."
            for match in data["matches"]:
                sources.append({"kind": "mandate", "id": match["mandate_id"], "label": match["reference"]})
    elif kind == "mandate":
        m = required(Mandate)
        p = db.get(Property, m.property_id)
        source("mandate", m, m.reference)
        data = {"id": m.id, "reference": m.reference, "status": m.status, "kind": m.kind, "price": m.price, "fees": m.fees,
            "signed_date": m.signed_date, "end_date": m.end_date, "notes": m.notes[:3000], "partner_terms": m.partner_terms[:1000],
            "commercializable": m.status in ("active", "offer") and m.end_date >= today and (m.kind != "partner" or m.commercialization_authorized),
            "property": {"title": p.title, "address": p.address, "city": p.city, "type": p.property_type, "surface": p.surface, "rooms": p.rooms, "dpe": p.dpe}}
    elif kind == "estimate":
        e = required(Estimate)
        source("estimate", e, e.title)
        data = {"id": e.id, "title": e.title, "address": e.address, "city": e.city, "surface": e.surface, "status": e.status,
            "low_price": e.low_price, "central_price": e.central_price, "high_price": e.high_price, "basis": e.basis,
            "details": e.details, "comparables": e.comparables[:15], "analysis": e.analysis[:4000],
            "limits": "Données déclarées, non vérifiées automatiquement. Au maximum 15 comparables transmis. Aucun prix de marché collecté."}
    else:
        raise HTTPException(422, "Type de contexte inconnu.")
    # Les Decimal sont des chaînes pour préserver les montants et les comparaisons entre moteurs.
    def encode(value):
        if isinstance(value, Decimal): return str(value)
        if isinstance(value, datetime):
            return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()
        if isinstance(value, dict): return {key: encode(v) for key, v in value.items()}
        if isinstance(value, list): return [encode(v) for v in value]
        return jsonable_encoder(value)
    snapshot = {"kind": kind, "id": identifier, "data": encode(data), "sources": sources}
    canonical = json.dumps(snapshot, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    if len(canonical) > 25000:
        raise HTTPException(422, "Ce dossier est trop volumineux pour ce contexte. Choisissez un autre dossier ou réduisez ses notes.")
    return {**snapshot, "digest": hashlib.sha256(canonical.encode()).hexdigest()}


def local_answer(question, context):
    q, data, kind = normalized(question), context["data"], context["kind"]
    def money(value):
        return f"{Decimal(str(value)):,.2f}".replace(",", " ").replace(".", ",") + " €"
    prefix = "MODE LOCAL · réponse préparée par règles métier, sans modèle d’IA.\n\n"
    if any(word in q for word in ("envoie", "envoyer", "supprime", "efface", "modifie", "execute")):
        return prefix + "Charlie est en lecture seule. Aucun message n’a été envoyé et aucun dossier n’a été modifié. Demandez un résumé ou un brouillon à relire."
    if kind == "briefing":
        lines = [f"Briefing du {data['date']} · Europe/Paris", f"{data['active_mandates']} mandat(s) en portefeuille, {data['buyers']} acquéreur(s), {data['draft_estimates']} estimation(s) en brouillon.", "\nRendez-vous enregistrés sur les 7 prochains jours :"]
        for event in data["appointments"]:
            date = datetime.fromisoformat(event["starts_at"])
            if date.tzinfo is None: date = date.replace(tzinfo=ZoneInfo("UTC"))
            lines.append(f"• {date.astimezone(ZoneInfo('Europe/Paris')).strftime('%d/%m à %H:%M')} : {event['title']} · {event['location'] or 'lieu non renseigné'}")
        if not data["appointments"]: lines.append("Aucun rendez-vous enregistré sur cette période.")
        lines.append("\nMandats à suivre :")
        lines.extend(f"• {m['reference']} : échéance {m['end_date']}, signé depuis {m['age_days']} jours." for m in data["mandates_to_review"])
        if not data["mandates_to_review"]: lines.append("Aucun mandat dans les seuils de suivi.")
        lines.append("\n" + data["limits"])
        return prefix + "\n".join(lines)
    if kind == "mandate":
        p = data["property"]
        if "annonce" in q or "commerciale" in q:
            if not data["commercializable"]:
                return prefix + f"Le mandat {data['reference']} n’est pas commercialisable selon son état, sa date ou son autorisation. Vérifiez le dossier avant de préparer une annonce."
            return prefix + f"BROUILLON D’ANNONCE · {data['reference']}\n\n{p['title']}\n{p['type']} à {p['city']}, {p['surface']} m², {p['rooms']} pièce(s).\nPrix affiché : {money(data['price'])}. DPE déclaré : {p['dpe']}.\n\n[Compléter les prestations vérifiées, les mentions obligatoires et les conditions d’honoraires avant publication.]\nAucune annonce n’a été publiée."
        if "mail" in q or "message" in q:
            return prefix + f"BROUILLON D’E-MAIL · présentation du mandat {data['reference']}\n\nObjet : Un bien à découvrir à {p['city']}\n\nBonjour [Prénom],\n\nJe vous propose d’échanger au sujet de ce {p['type'].lower()} de {p['surface']} m² à {p['city']}, proposé à {money(data['price'])}. Nous vérifierons ensemble qu’il correspond à votre projet et à vos critères.\n\nSeriez-vous disponible pour en discuter ?\n\n[Votre signature]\n\nÀ relire et compléter. Aucun e-mail envoyé."
        return prefix + f"Mandat {data['reference']} · {p['title']}\n{p['city']} · {p['surface']} m² · {p['rooms']} pièce(s) · DPE {p['dpe']}.\nPrix : {money(data['price'])}. Honoraires enregistrés : {money(data['fees'])}.\nStatut : {data['status']}. Échéance : {data['end_date']}.\nCommercialisable : {'oui selon les champs enregistrés' if data['commercializable'] else 'non, dossier à vérifier'}.\n\nCompte rendu à préparer : faire confirmer au vendeur l’actualité du prix, les documents, les visites et les prochaines actions. Les statistiques de diffusion et de visites ne sont pas disponibles dans ce contexte."
    if kind == "matching":
        lines = [f"Rapprochements pour {data['name']}"]
        for match in data.get("matches", []):
            lines += [f"\n• {match['reference']} · {match['city']} · {money(match['price'])}", "; ".join(match["checks"]), "À vérifier : " + "; ".join(match["to_verify"])]
        if not data.get("matches"): lines.append("Aucune piste satisfaisant les contrôles renseignés. Vérifiez les critères et les mandats commercialisables.")
        return prefix + "\n".join(lines) + "\n\n" + data["matching_limit"]
    if kind == "estimate":
        return prefix + f"Estimation {data['title']} · {data['city']} · {data['surface']} m²\nFourchette enregistrée : {money(data['low_price'])} à {money(data['high_price'])}, centrale {money(data['central_price'])}.\nBase : {data['basis']}. {len(data['comparables'])} référence(s) dans ce contexte.\n\nAnalyse enregistrée (non vérifiée automatiquement) :\n{data['analysis'] or 'Non renseignée.'}\n\nCes montants sont déclarés par le conseiller. Ils ne constituent pas un prix de vente garanti ni une vérification du marché."
    c = data.get("criteria")
    lines = [f"Contact : {data['name']} · {data['city'] or 'commune non renseignée'}", f"Profil enregistré : {data['kind']}. Origine : {data['provenance']}."]
    if c: lines += [f"Budget : {money(c['budget_min'])} à {money(c['budget_max'])} (0 = non renseigné).", f"Surface minimum : {c['min_surface']} m². Chambres : {c['bedrooms']}. Secteurs : {c['sectors'] or 'non renseignés'}.", f"Financement déclaré : {c['financing']}, à confirmer. Critères impératifs : {c['mandatory'] or 'non renseignés'}."]
    lines.append("Prochaine préparation possible : confirmer les critères et le calendrier du projet avec ce contact. Aucun échange externe n’a été consulté.")
    return prefix + "\n".join(lines)
