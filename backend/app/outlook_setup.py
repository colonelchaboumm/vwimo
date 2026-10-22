"""Préparation locale d’un client Microsoft public, sans authentification ni envoi."""
from uuid import UUID

from fastapi import Depends, HTTPException
from pydantic import Field, field_validator

from .models import OutlookSettings
from .schemas import Input


class OutlookInput(Input):
    version: int | None = Field(default=None, ge=1)
    client_id: str = Field(default="", max_length=36)
    tenant: str = Field(default="common", min_length=1, max_length=36)

    @field_validator("client_id")
    @classmethod
    def application_id(cls, value):
        if not value: return ""
        try: return str(UUID(value))
        except ValueError: raise ValueError("Le client ID est l’identifiant UUID de l’application, pas un secret client.")

    @field_validator("tenant")
    @classmethod
    def authority(cls, value):
        if value in ("common", "organizations", "consumers"): return value
        try: return str(UUID(value))
        except ValueError: raise ValueError("Choisissez common, organizations, consumers ou un identifiant UUID de locataire.")


def register_outlook_setup(api, *, database, user, audit, save, check_version):
    def data(row):
        return {"client_id": row.client_id, "tenant": row.tenant, "version": row.version,
                "configured": bool(row.client_id), "connected": False, "can_send": False,
                "authorization_available": False, "requires_client_secret": False}

    @api.get("/api/outlook/config")
    def configuration(account=Depends(user), db=Depends(database)):
        return data(db.get(OutlookSettings, 1) or OutlookSettings(id=1, client_id="", tenant="common", version=1))

    @api.put("/api/outlook/config")
    def configure(values: OutlookInput, account=Depends(user), db=Depends(database)):
        if account.role != "admin": raise HTTPException(403, "Seul le propriétaire ou un administrateur peut préparer la connexion Microsoft.")
        row = db.get(OutlookSettings, 1)
        if row:
            check_version(row, values.version)
            row.version += 1
        else:
            row = OutlookSettings(id=1)
        row.client_id, row.tenant = values.client_id, values.tenant
        db.add(row)
        audit(db, account, "outlook.configuration.prepared", "1", {"configured": bool(row.client_id), "tenant": row.tenant})
        save(db)
        return data(row)
