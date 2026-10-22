from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from pydantic import Field, model_validator
from .schemas import Input


def today():
    return datetime.now(ZoneInfo("Europe/Paris")).date()


class ListingInput(Input):
    version: int | None = Field(default=None, ge=1)
    title: str = Field(min_length=3, max_length=180)
    source_name: str = Field(min_length=2, max_length=120)
    source_url: str = Field(default="", max_length=1500)
    rights_note: str = Field(default="", max_length=500)
    city: str = Field(min_length=2, max_length=100)
    district: str = Field(default="", max_length=120)
    address: str = Field(default="", max_length=250)
    property_type: Literal["Appartement", "Maison", "Terrain", "Local", "Autre"] = "Appartement"
    seller_type: Literal["private", "professional", "unknown"] = "unknown"
    status: Literal["active", "removed", "sold"] = "active"
    price: Decimal = Field(gt=0, le=999999999, decimal_places=2)
    surface: Decimal = Field(gt=0, le=100000, decimal_places=2)
    rooms: int | None = Field(default=None, ge=1, le=100)
    published_on: date | None = None
    observed_on: date = Field(default_factory=today)
    latitude: Decimal | None = Field(default=None, ge=-85, le=85, decimal_places=6)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180, decimal_places=6)
    description: str = Field(default="", max_length=10000)
    observation_note: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def consistent(self):
        if self.source_url:
            try:
                parts = urlsplit(self.source_url)
                if any(char.isspace() for char in self.source_url) or parts.scheme not in ("https", "http") or not parts.hostname or parts.username or parts.password or parts.port not in (None, 80, 443):
                    raise ValueError()
            except ValueError:
                raise ValueError("L’URL source doit être une adresse HTTP(S) sans identifiants ni port particulier.")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Renseignez ensemble latitude et longitude, ou laissez les deux vides.")
        if self.observed_on > today() or (self.published_on and self.published_on > self.observed_on):
            raise ValueError("La publication ne doit pas suivre l’observation, et l’observation ne peut pas être future.")
        return self


class CSVInput(Input):
    text: str = Field(min_length=1, max_length=250000)
    rights_confirmed: bool = False


class ProspectInput(Input):
    version: int | None = Field(default=None, ge=1)
    listing_id: str = Field(min_length=1, max_length=36)
    permission: Literal["unknown", "declared", "refused"] = "unknown"
    permission_note: str = Field(default="", max_length=1000)
    opposed: bool = False
    notes: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def reason(self):
        if self.permission == "declared" and len(self.permission_note) < 10:
            raise ValueError("Précisez la justification de l’autorisation déclarée (10 caractères minimum).")
        return self


class ActivityInput(Input):
    version: int = Field(ge=1)
    request_id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    kind: Literal["initial", "followup", "reply", "refusal", "appointment", "estimate", "mandate", "note"]
    channel: Literal["phone", "email", "portal", "meeting", "other"] = "other"
    occurred_at: datetime
    message: str = Field(min_length=3, max_length=5000)
    evidence: str = Field(default="", max_length=1000)

    @model_validator(mode="after")
    def aware(self):
        if self.occurred_at.utcoffset() is None:
            raise ValueError("La date d’activité doit inclure son fuseau horaire.")
        return self
