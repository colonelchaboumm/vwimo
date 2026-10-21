from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field, HttpUrl, model_validator
from .schemas import Input


class EventInput(Input):
    version: int | None = Field(default=None, ge=1)
    title: str = Field(min_length=2, max_length=180)
    kind: Literal["visit", "estimate", "seller", "buyer", "signing", "other"] = "other"
    starts_at: datetime
    ends_at: datetime
    location: str = Field(default="", max_length=300)
    notes: str = Field(default="", max_length=10000)
    contact_id: str | None = Field(default=None, max_length=36)
    mandate_id: str | None = Field(default=None, max_length=36)

    @model_validator(mode="after")
    def dates(self):
        if self.starts_at.utcoffset() is None or self.ends_at.utcoffset() is None:
            raise ValueError("Les horaires doivent inclure leur fuseau horaire.")
        self.starts_at = self.starts_at.astimezone(timezone.utc)
        self.ends_at = self.ends_at.astimezone(timezone.utc)
        if not timedelta(0) < self.ends_at - self.starts_at <= timedelta(days=31):
            raise ValueError("La fin doit suivre le début, dans une limite de 31 jours.")
        return self


class ComparableInput(Input):
    label: str = Field(min_length=2, max_length=180)
    source: str = Field(min_length=2, max_length=300)
    url: HttpUrl | None = None
    observed_date: date
    kind: Literal["sale", "asking"]
    price: Decimal = Field(gt=0, le=999999999, decimal_places=2)
    surface: Decimal = Field(gt=0, le=100000, decimal_places=2)

    @model_validator(mode="after")
    def past_reference(self):
        if self.observed_date > datetime.now(ZoneInfo("Europe/Paris")).date():
            raise ValueError("Une référence observée ne peut pas être datée dans le futur.")
        return self


class EstimateDetails(Input):
    district: str = Field(default="", max_length=100)
    rooms: int | None = Field(default=None, ge=1, le=100)
    bedrooms: int | None = Field(default=None, ge=0, le=100)
    floor: str = Field(default="", max_length=50)
    construction_year: int | None = Field(default=None, ge=1000, le=2200)
    carrez_surface: Decimal | None = Field(default=None, gt=0, le=100000, decimal_places=2)
    land_surface: Decimal | None = Field(default=None, ge=0, le=10000000, decimal_places=2)
    annual_charges: Decimal | None = Field(default=None, ge=0, le=99999999, decimal_places=2)
    property_tax: Decimal | None = Field(default=None, ge=0, le=99999999, decimal_places=2)
    dpe: Literal["A", "B", "C", "D", "E", "F", "G", "Inconnu", "Exempté"] = "Inconnu"
    condition: str = Field(default="", max_length=500)
    features: str = Field(default="", max_length=2000)
    works: str = Field(default="", max_length=2000)


class EstimateInput(Input):
    version: int | None = Field(default=None, ge=1)
    title: str = Field(min_length=2, max_length=180)
    address: str = Field(min_length=3, max_length=250)
    city: str = Field(min_length=2, max_length=100)
    property_type: Literal["Appartement", "Maison", "Terrain", "Local", "Autre"]
    surface: Decimal = Field(gt=0, le=100000, decimal_places=2)
    contact_id: str | None = Field(default=None, max_length=36)
    status: Literal["draft", "presented", "accepted", "archived"] = "draft"
    low_price: Decimal = Field(gt=0, le=999999999, decimal_places=2)
    central_price: Decimal = Field(gt=0, le=999999999, decimal_places=2)
    high_price: Decimal = Field(gt=0, le=999999999, decimal_places=2)
    basis: Literal["sale", "asking", "manual"] = "manual"
    details: EstimateDetails = Field(default_factory=EstimateDetails)
    comparables: list[ComparableInput] = Field(default_factory=list, max_length=30)
    analysis: str = Field(default="", max_length=15000)

    @model_validator(mode="after")
    def range_order(self):
        if not self.low_price <= self.central_price <= self.high_price:
            raise ValueError("La fourchette doit respecter : basse ≤ centrale ≤ haute.")
        if self.basis != "manual" and not any(c.kind == self.basis for c in self.comparables):
            raise ValueError("Ajoutez au moins un comparable du type de référence choisi, ou choisissez une évaluation manuelle.")
        return self
