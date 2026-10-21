from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid", validate_default=True)


class CriteriaInput(Input):
    budget_min: Decimal = Field(default=0, ge=0, le=999999999, max_digits=14, decimal_places=2)
    budget_max: Decimal = Field(default=0, ge=0, le=999999999, max_digits=14, decimal_places=2)
    min_surface: Decimal = Field(default=0, ge=0, le=100000, decimal_places=2)
    bedrooms: int = Field(default=0, ge=0, le=100)
    sectors: str = Field(default="", max_length=500)
    financing: str = Field(default="À qualifier", max_length=120)
    mandatory: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def budgets(self):
        if self.budget_max < self.budget_min:
            raise ValueError("Le budget maximum doit être supérieur au minimum.")
        return self


class ContactInput(Input):
    version: int | None = Field(default=None, ge=1)
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr | None = None
    phone: str = Field(default="", max_length=30, pattern=r"^[\d+().\s-]*$")
    kind: Literal["buyer", "seller", "both", "professional"]
    city: str = Field(default="", max_length=100)
    source: str = Field(default="Saisie manuelle", max_length=120)
    notes: str = Field(default="", max_length=10000)
    criteria: CriteriaInput | None = None

    @model_validator(mode="after")
    def buyer_only(self):
        if self.criteria is not None and self.kind not in ("buyer", "both"):
            raise ValueError("Les critères sont réservés aux acquéreurs.")
        return self


class PropertyInput(Input):
    title: str = Field(min_length=3, max_length=180)
    address: str = Field(min_length=3, max_length=250)
    city: str = Field(min_length=2, max_length=100)
    property_type: Literal["Appartement", "Maison", "Terrain", "Local", "Autre"]
    surface: Decimal = Field(gt=0, le=100000, decimal_places=2)
    rooms: int = Field(gt=0, le=100)
    dpe: Literal["A", "B", "C", "D", "E", "F", "G", "Inconnu", "Exempté"] = "Inconnu"


class MandateInput(Input):
    version: int | None = Field(default=None, ge=1)
    reference: str = Field(min_length=2, max_length=40)
    seller_id: str
    kind: Literal["exclusive", "simple", "partner"]
    status: Literal["preparation", "active", "offer", "compromise", "sold", "expired", "withdrawn"] = "preparation"
    signed_date: date
    end_date: date
    price: Decimal = Field(gt=0, le=999999999, decimal_places=2)
    fees: Decimal = Field(default=0, ge=0, le=999999999, decimal_places=2)
    partner_name: str = Field(default="", max_length=180)
    partner_terms: str = Field(default="", max_length=5000)
    commercialization_authorized: bool = False
    notes: str = Field(default="", max_length=10000)
    property: PropertyInput

    @model_validator(mode="after")
    def consistency(self):
        if self.end_date < self.signed_date:
            raise ValueError("L'échéance précède la signature.")
        if self.fees > self.price:
            raise ValueError("Les honoraires dépassent le prix.")
        if self.kind == "partner" and (not self.partner_name or not self.partner_terms):
            raise ValueError("Renseignez l'agence et les conditions de partage.")
        if self.kind == "partner" and self.status in ("active", "offer", "compromise", "sold") and not self.commercialization_authorized:
            raise ValueError("L'autorisation de commercialisation intercabinets est obligatoire.")
        return self


class LoginInput(Input):
    email: EmailStr
    # Les espaces font partie du secret ; ils ne doivent jamais être supprimés.
    model_config = ConfigDict(str_strip_whitespace=False, extra="forbid")
    password: str = Field(min_length=1, max_length=256)


class AutomationInput(Input):
    enabled: bool


class LocalRegistrationInput(LoginInput):
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=12, max_length=256)
    password_confirmation: str = Field(min_length=12, max_length=256)

    @model_validator(mode="after")
    def valid_registration(self):
        self.name = self.name.strip()
        if len(self.name) < 2:
            raise ValueError("Renseignez votre nom (2 caractères minimum).")
        if not self.password.strip():
            raise ValueError("Le mot de passe ne peut pas contenir uniquement des espaces.")
        if self.password != self.password_confirmation:
            raise ValueError("Les deux mots de passe ne correspondent pas.")
        return self
