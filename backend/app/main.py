import hashlib
import io
import secrets
import re
import threading
import time
import zipfile
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm.exc import StaleDataError

from .config import Settings
from .database import connect
from .models import AuditLog, AutomationSettings, BuyerCriteria, Contact, Document, Installation, Mandate, Property, SessionToken, User, now
from .schemas import AutomationInput, ContactInput, LoginInput, LocalRegistrationInput, MandateInput
from .middleware import BodyLimitMiddleware

hasher = PasswordHasher()
bearer = HTTPBearer(auto_error=False)


def record(row):
    result = {}
    for column in row.__table__.columns:
        value = getattr(row, column.name)
        if isinstance(value, Decimal):
            value = str(value)
        elif isinstance(value, datetime):
            value = (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
        result[column.name] = value
    return result


def create_app(settings: Settings | None = None):
    settings = settings or Settings()
    settings.validate_runtime()
    engine, sessions = connect(settings.database_url)

    @asynccontextmanager
    async def lifespan(_):
        with sessions() as db:
            installation = db.get(Installation, 1)
            if not installation or installation.mode != settings.mode:
                raise RuntimeError("Base non initialisée ou mode incompatible. Exécutez python -m app.manage init.")
        yield
        engine.dispose()

    api = FastAPI(title="IMMO PILOT AI", version="0.7.0", lifespan=lifespan)
    api.state.sessions = sessions
    api.state.engine = engine
    api.add_middleware(BodyLimitMiddleware)
    api.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Authorization", "Content-Type", "If-Match", "X-Immo-Desktop-Key"])

    @api.exception_handler(StaleDataError)
    async def stale_record(_, __):
        return JSONResponse({"detail": "Ce dossier a été modifié ailleurs. Actualisez-le avant de réessayer."}, 409)

    @api.exception_handler(OperationalError)
    async def database_unavailable(_, __):
        return JSONResponse({"detail": "La base de données est momentanément indisponible."}, 503)

    @api.middleware("http")
    async def headers(request, call_next):
        if settings.mode == "local":
            if not request.client or request.client.host not in ("127.0.0.1", "::1"):
                return JSONResponse({"detail": "Cet espace est accessible uniquement sur cet ordinateur."}, 403)
            origin = request.headers.get("origin")
            if origin and origin not in settings.cors_origins:
                return JSONResponse({"detail": "Origine non autorisée."}, 403)
        if settings.desktop_key and request.method != "OPTIONS" and not secrets.compare_digest(request.headers.get("x-immo-desktop-key", ""), settings.desktop_key):
            return JSONResponse({"detail": "Accès réservé à l’application Windows."}, 401)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    def database():
        with sessions() as db:
            yield db

    def user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db=Depends(database)):
        if not credentials:
            raise HTTPException(401, "Connexion requise.")
        digest = hashlib.sha256(credentials.credentials.encode()).hexdigest()
        session = db.scalar(select(SessionToken).where(SessionToken.token_hash == digest, SessionToken.expires_at > now()))
        account = db.get(User, session.user_id) if session else None
        if not account or not account.active:
            raise HTTPException(401, "Session expirée. Reconnectez-vous.")
        return account

    def writer(account=Depends(user)):
        if account.role not in ("admin", "advisor"):
            raise HTTPException(403, "Votre compte est en lecture seule.")
        return account

    def audit(db, account, action, entity_id, details=None):
        db.add(AuditLog(actor_id=account.id, action=action, entity_id=entity_id, details=jsonable_encoder(details or {})))

    def save(db):
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Référence déjà utilisée ou lien incompatible avec une fiche existante.")

    def find(db, model, identifier):
        item = db.get(model, identifier)
        if item is None:
            raise HTTPException(404, "Dossier introuvable.")
        return item

    def contact_data(db, contact):
        result = record(contact)
        criteria = db.get(BuyerCriteria, contact.id)
        result["criteria"] = record(criteria) if criteria else None
        return result

    def mandate_data(db, mandate):
        result = record(mandate)
        result["property"] = record(db.get(Property, mandate.property_id))
        result["seller_name"] = db.get(Contact, mandate.seller_id).name
        return result

    def issue(db, account):
        if not account.active:
            raise HTTPException(403, "Ce compte est désactivé.")
        db.execute(delete(SessionToken).where(SessionToken.expires_at <= now()))
        token = secrets.token_urlsafe(48)
        db.add(SessionToken(user_id=account.id, token_hash=hashlib.sha256(token.encode()).hexdigest(), expires_at=now() + timedelta(hours=settings.session_hours)))
        audit(db, account, "auth.login", account.id)
        db.commit()
        return {"token": token, "user": {"name": account.name, "email": account.email, "role": account.role}, "mode": settings.mode}

    attempts = defaultdict(deque)
    login_lock = threading.Lock()

    @api.get("/api/health")
    def health(db=Depends(database)):
        db.execute(text("SELECT 1"))
        return {"status": "ok", "mode": settings.mode, "version": "0.7.0",
                "setup_required": settings.mode == "local" and db.scalar(select(User.id).limit(1)) is None}

    @api.post("/api/auth/register-local", status_code=201)
    def register_local(data: LocalRegistrationInput, db=Depends(database)):
        if settings.mode != "local":
            raise HTTPException(404, "Création locale indisponible dans cet environnement.")
        # Verrou SQLite interprocessus : deux premières inscriptions simultanées
        # ne doivent jamais créer deux propriétaires donnant accès aux mêmes dossiers.
        db.execute(text("BEGIN IMMEDIATE"))
        if db.scalar(select(User.id).limit(1)) is not None:
            db.rollback()
            raise HTTPException(409, "Un compte existe déjà sur cet ordinateur. Connectez-vous.")
        account = User(name=data.name, email=str(data.email).lower(), role="admin",
                       password_hash=hasher.hash(data.password))
        db.add(account)
        db.flush()
        audit(db, account, "auth.local_account_created", account.id)
        return issue(db, account)

    @api.post("/api/auth/login")
    def login(data: LoginInput, request: Request, db=Depends(database)):
        key = request.client.host if request.client else "unknown"
        with login_lock:
            cutoff = time.monotonic() - 300
            for old_key in list(attempts):
                while attempts[old_key] and attempts[old_key][0] < cutoff:
                    attempts[old_key].popleft()
                if not attempts[old_key]:
                    del attempts[old_key]
            if len(attempts[key]) >= 10:
                raise HTTPException(429, "Trop de tentatives. Réessayez dans cinq minutes.")
            attempts[key].append(time.monotonic())
        account = db.scalar(select(User).where(User.email == data.email.lower(), User.active.is_(True)))
        try:
            if not account:
                hasher.hash(data.password)
                raise HTTPException(401, "Identifiants incorrects.")
            hasher.verify(account.password_hash, data.password)
        except VerificationError:
            raise HTTPException(401, "Identifiants incorrects.")
        return issue(db, account)

    @api.post("/api/auth/demo")
    def demo_login(db=Depends(database)):
        if settings.mode != "demo":
            raise HTTPException(404, "Mode démonstration indisponible.")
        account = db.scalar(select(User).where(User.email == "demo@immopilot.example"))
        if not account:
            raise HTTPException(409, "Initialisez les données de démonstration.")
        return issue(db, account)

    @api.get("/api/auth/me")
    def me(account=Depends(user)):
        return {"name": account.name, "email": account.email, "role": account.role, "mode": settings.mode}

    @api.post("/api/auth/logout", status_code=204)
    def logout(credentials=Depends(bearer), account=Depends(user), db=Depends(database)):
        row = db.scalar(select(SessionToken).where(SessionToken.token_hash == hashlib.sha256(credentials.credentials.encode()).hexdigest()))
        db.delete(row)
        audit(db, account, "auth.logout", account.id)
        db.commit()

    @api.get("/api/contacts")
    def contacts(q: str = "", kind: str = "", account=Depends(user), db=Depends(database)):
        query = select(Contact).where(Contact.archived.is_(False))
        if q:
            query = query.where(or_(Contact.name.ilike(f"%{q[:120]}%"), Contact.email.ilike(f"%{q[:120]}%"), Contact.city.ilike(f"%{q[:120]}%")))
        if kind in ("buyer", "seller"):
            query = query.where(Contact.kind.in_([kind, "both"]))
        rows = list(db.scalars(query.order_by(Contact.name)))
        criteria_by_id = {c.contact_id: record(c) for c in db.scalars(select(BuyerCriteria).where(BuyerCriteria.contact_id.in_([r.id for r in rows])))} if rows else {}
        return [{**record(c), "criteria": criteria_by_id.get(c.id)} for c in rows]

    def apply_contact(db, row, data):
        for key, value in data.model_dump(exclude={"criteria", "version"}).items():
            setattr(row, key, value)
        db.add(row)
        db.flush()
        criteria = db.get(BuyerCriteria, row.id)
        if data.criteria:
            criteria = criteria or BuyerCriteria(contact_id=row.id)
            for key, value in data.criteria.model_dump().items():
                setattr(criteria, key, value)
            db.add(criteria)
        elif criteria:
            db.delete(criteria)

    @api.post("/api/contacts", status_code=201)
    def create_contact(data: ContactInput, account=Depends(writer), db=Depends(database)):
        row = Contact(provenance="demo" if settings.mode == "demo" else "manual")
        apply_contact(db, row, data)
        audit(db, account, "contact.create", row.id)
        save(db)
        return contact_data(db, row)

    @api.put("/api/contacts/{identifier}")
    def update_contact(identifier: str, data: ContactInput, account=Depends(writer), db=Depends(database)):
        row = find(db, Contact, identifier)
        check_version(row, data.version)
        if row.archived:
            raise HTTPException(409, "Ce contact a été archivé. Actualisez la liste.")
        if data.kind not in ("seller", "both") and db.scalar(select(Mandate.id).where(Mandate.seller_id == row.id).limit(1)):
            raise HTTPException(409, "Ce contact est le vendeur d'un mandat. Conservez son rôle vendeur.")
        row.version += 1
        apply_contact(db, row, data)
        audit(db, account, "contact.update", row.id)
        save(db)
        return contact_data(db, row)

    @api.delete("/api/contacts/{identifier}", status_code=204)
    def archive_contact(identifier: str, account=Depends(writer), db=Depends(database)):
        row = find(db, Contact, identifier)
        if db.scalar(select(Mandate.id).where(Mandate.seller_id == row.id, Mandate.status.in_(["preparation", "active", "offer", "compromise"])).limit(1)):
            raise HTTPException(409, "Ce vendeur possède encore un mandat en cours.")
        row.archived = True
        audit(db, account, "contact.archive", row.id)
        save(db)

    @api.get("/api/mandates")
    def mandates(account=Depends(user), db=Depends(database)):
        rows = db.execute(select(Mandate, Property, Contact).join(Property, Mandate.property_id == Property.id).join(Contact, Mandate.seller_id == Contact.id).order_by(Mandate.created_at.desc()))
        return [{**record(m), "property": record(p), "seller_name": c.name} for m, p, c in rows]

    def check_version(row, version):
        if version is None:
            raise HTTPException(428, "La version du dossier est requise. Actualisez l'application.")
        if row.version != version:
            raise HTTPException(409, "Ce dossier a été modifié ailleurs. Fermez-le, actualisez la liste puis rouvrez-le.")

    def apply_mandate(db, row, data):
        seller = find(db, Contact, data.seller_id)
        if seller.archived or seller.kind not in ("seller", "both"):
            raise HTTPException(422, "Sélectionnez un vendeur actif.")
        prop = db.get(Property, row.property_id) if row.property_id else Property()
        for key, value in data.property.model_dump().items():
            setattr(prop, key, value)
        db.add(prop)
        db.flush()
        row.property_id = prop.id
        for key, value in data.model_dump(exclude={"property", "version"}).items():
            setattr(row, key, value)
        db.add(row)

    @api.post("/api/mandates", status_code=201)
    def create_mandate(data: MandateInput, account=Depends(writer), db=Depends(database)):
        row = Mandate(provenance="demo" if settings.mode == "demo" else "manual")
        apply_mandate(db, row, data)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Cette référence de mandat existe déjà.")
        audit(db, account, "mandate.create", row.id, {"price": row.price, "status": row.status})
        save(db)
        return mandate_data(db, row)

    @api.put("/api/mandates/{identifier}")
    def update_mandate(identifier: str, data: MandateInput, account=Depends(writer), db=Depends(database)):
        row = find(db, Mandate, identifier)
        check_version(row, data.version)
        before = {"price": row.price, "status": row.status}
        apply_mandate(db, row, data)
        row.version += 1
        audit(db, account, "mandate.update", row.id, {"before": before, "after": {"price": row.price, "status": row.status}})
        save(db)
        return mandate_data(db, row)

    @api.get("/api/dashboard")
    def dashboard(account=Depends(user), db=Depends(database)):
        today = datetime.now(ZoneInfo("Europe/Paris")).date()
        mandates = list(db.scalars(select(Mandate)))
        active = [m for m in mandates if m.status in ("active", "offer", "compromise")]
        priorities = []
        for m in active:
            age, days = (today - m.signed_date).days, (m.end_date - today).days
            if days <= 15:
                priorities.append({"id": m.id, "reference": m.reference, "title": "Échéance du mandat", "detail": f"Échéance dépassée de {-days} jours" if days < 0 else f"Échéance dans {days} jours", "level": "urgent"})
            elif age >= 45:
                priorities.append({"id": m.id, "reference": m.reference, "title": "Faire le point avec le vendeur", "detail": f"Mandat signé depuis {age} jours", "level": "normal"})
        priorities.sort(key=lambda p: (p["level"] != "urgent", next(m.end_date if p["level"] == "urgent" else m.signed_date for m in mandates if m.id == p["id"]), p["reference"]))
        months = []
        for offset in range(5, -1, -1):
            n = today.year * 12 + today.month - 1 - offset
            year, month = divmod(n, 12)
            months.append({"month": f"{year}-{month + 1:02}", "count": sum(m.status != "preparation" and m.signed_date <= today and m.signed_date.year == year and m.signed_date.month == month + 1 for m in mandates)})
        return {
            "active": len(active),
            "exclusive": sum(m.kind == "exclusive" for m in active),
            "simple": sum(m.kind == "simple" for m in active),
            "partner": sum(m.kind == "partner" for m in active),
            "buyers": db.scalar(select(func.count()).select_from(Contact).where(Contact.archived.is_(False), Contact.kind.in_(["buyer", "both"]))),
            "sellers": db.scalar(select(func.count()).select_from(Contact).where(Contact.archived.is_(False), Contact.kind.in_(["seller", "both"]))),
            "documents": db.scalar(select(func.count()).select_from(Document)),
            "portfolio": str(sum((m.price for m in active), Decimal("0.00"))),
            "fees_potential": str(sum((m.fees for m in active), Decimal("0.00"))),
            "priorities": priorities,
            "months": months,
            "status_counts": {s: sum(m.status == s for m in mandates) for s in ("preparation", "active", "offer", "compromise", "sold", "expired", "withdrawn")},
        }

    @api.get("/api/documents")
    def documents(account=Depends(user), db=Depends(database)):
        return [{k: v for k, v in record(d).items() if k != "storage_key"} for d in db.scalars(select(Document).order_by(Document.created_at.desc()))]

    @api.post("/api/documents", status_code=201)
    def upload(file: UploadFile = File(...), category: str = Form("Autre"), contact_id: str | None = Form(None), mandate_id: str | None = Form(None), account=Depends(writer), db=Depends(database)):
        if len(category) > 80:
            raise HTTPException(422, "Catégorie trop longue.")
        if contact_id:
            find(db, Contact, contact_id)
        if mandate_id:
            find(db, Mandate, mandate_id)
        filename = re.sub(r'[\x00-\x1f<>:"|?*]', "_", Path((file.filename or "document").replace("\\", "/")).name)
        ext = Path(filename).suffix.lower()
        filename = Path(filename).stem[:200] + ext
        types = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
        content = file.file.read(15 * 1024 * 1024 + 1)
        file.file.close()
        if not content or len(content) > 15 * 1024 * 1024:
            raise HTTPException(413, "Fichier vide ou supérieur à 15 Mo.")
        valid = ext == ".pdf" and content.startswith(b"%PDF-") or ext == ".png" and content.startswith(b"\x89PNG\r\n\x1a\n") or ext in (".jpg", ".jpeg") and content.startswith(b"\xff\xd8\xff")
        if ext in (".docx", ".xlsx"):
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as archive:
                    required = "word/document.xml" if ext == ".docx" else "xl/workbook.xml"
                    valid = required in archive.namelist() and "[Content_Types].xml" in archive.namelist() and not any("vbaproject" in n.lower() for n in archive.namelist())
            except zipfile.BadZipFile:
                valid = False
        if not valid or ext not in types:
            raise HTTPException(415, "Format non pris en charge ou contenu incompatible avec l'extension.")
        key = secrets.token_hex(24) + ext
        path = settings.storage_dir / key
        path.write_bytes(content)
        row = Document(filename=filename, storage_key=key, media_type=types[ext], size=len(content), sha256=hashlib.sha256(content).hexdigest(), category=category, contact_id=contact_id or None, mandate_id=mandate_id or None, uploaded_by=account.id)
        try:
            db.add(row)
            db.flush()
            audit(db, account, "document.upload", row.id)
            save(db)
        except Exception:
            path.unlink(missing_ok=True)
            raise
        return {k: v for k, v in record(row).items() if k != "storage_key"}

    @api.get("/api/documents/{identifier}/download")
    def download(identifier: str, account=Depends(user), db=Depends(database)):
        row = find(db, Document, identifier)
        path = settings.storage_dir / row.storage_key
        if not path.is_file():
            raise HTTPException(404, "Fichier absent du stockage. Vérifiez la sauvegarde.")
        with path.open("rb") as source:
            if hashlib.file_digest(source, "sha256").hexdigest() != row.sha256:
                raise HTTPException(409, "Le document a été altéré. Restaurez une copie vérifiée avant de le télécharger.")
        audit(db, account, "document.download", row.id)
        db.commit()
        return FileResponse(path, media_type="application/octet-stream", filename=row.filename)

    @api.get("/api/audit")
    def history(account=Depends(user), db=Depends(database)):
        return [record(a) for a in db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(100))]

    @api.get("/api/settings")
    def preferences(account=Depends(user), db=Depends(database)):
        from .charlie import config_row, public_config
        ai = public_config(config_row(db), settings)
        ai_status = "verified" if ai["configured"] and ai["enabled"] and ai["tested_at"] else "configured" if ai["configured"] else "local"
        return {"mode": settings.mode, "database": engine.dialect.name, "automation": record(db.get(AutomationSettings, 1)),
                "connectors": [{"name": "Charlie / OpenAI", "status": ai_status, "can_send": False},
                               {"name": "Microsoft Outlook", "status": "not_configured", "can_send": False},
                               {"name": "Radar immobilier", "status": "local", "can_send": False}], "sending_available": False}

    @api.put("/api/settings/automation")
    def automation(data: AutomationInput, account=Depends(writer), db=Depends(database)):
        config = db.get(AutomationSettings, 1)
        config.enabled = data.enabled
        audit(db, account, "automation.enable" if data.enabled else "automation.stop", "1")
        save(db)
        return record(config)

    from .commercial import register_commercial
    register_commercial(api, database=database, user=user, writer=writer, audit=audit,
                        find=find, save=save, check_version=check_version, record=record)
    from .charlie import register_charlie
    register_charlie(api, settings=settings, database=database, user=user, writer=writer,
                     audit=audit, save=save, check_version=check_version, record=record)
    from .radar import register_radar
    register_radar(api, database=database, user=user, writer=writer, audit=audit,
                   find=find, save=save, check_version=check_version, record=record)
    from .outlook_setup import register_outlook_setup
    register_outlook_setup(api, database=database, user=user, audit=audit, save=save, check_version=check_version)
    return api
