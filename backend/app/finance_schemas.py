from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID
from pydantic import Field, model_validator
from .schemas import Input
from .radar_schemas import today

BusinessDate = Annotated[date, Field(ge=date(1900, 1, 1), le=date(2100, 12, 31))]


class ChecklistItem(Input):
    label: str = Field(min_length=2, max_length=180)
    done: bool = False


class TransactionInput(Input):
    version: int | None = Field(default=None, ge=1)
    reference: str = Field(min_length=2, max_length=40)
    mandate_id: str = Field(min_length=1, max_length=36)
    buyer_id: str | None = Field(default=None, max_length=36)
    stage: Literal['marketing','visits','offer','accepted','file','compromise','conditions','financing','signed','cancelled'] = 'marketing'
    sale_price: Decimal = Field(gt=0, le=999999999, decimal_places=2)
    notary: str = Field(default="", max_length=180)
    offer_on: BusinessDate | None = None
    compromise_on: BusinessDate | None = None
    expected_deed_on: BusinessDate | None = None
    deed_on: BusinessDate | None = None
    financing: Literal['unknown','requested','approved','refused'] = 'unknown'
    conditions: str = Field(default="", max_length=5000)
    checklist: list[ChecklistItem] = Field(default_factory=list, max_length=30)
    notes: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def dates(self):
        known = [d for d in (self.offer_on, self.compromise_on, self.deed_on) if d]
        if known != sorted(known) or any(d > today() for d in known):
            raise ValueError("Les dates effectuées doivent être chronologiques et non futures. Utilisez la date prévisionnelle pour l’acte à venir.")
        if self.stage == 'signed' and not self.deed_on:
            raise ValueError("Renseignez la date de l’acte effectué avant de déclarer la vente signée.")
        if self.deed_on and self.stage != 'signed':
            raise ValueError("Une date d’acte effectué exige l’étape Vente signée.")
        return self


class Tier(Input):
    threshold: Decimal = Field(ge=0, le=999999999, decimal_places=2)
    rate: Decimal = Field(ge=0, le=100, decimal_places=4)


class PlanInput(Input):
    name: str = Field(min_length=3, max_length=180)
    partner: str = Field(min_length=2, max_length=180)
    base_label: str = Field(min_length=3, max_length=180)
    amount_basis: Literal['ht','ttc','contract'] = 'contract'
    method: Literal['marginal','global']
    period: Literal['year','month']
    effective_from: BusinessDate
    effective_to: BusinessDate | None = None
    opening_base: Decimal = Field(default=0, ge=0, le=999999999, decimal_places=2)
    opening_on: BusinessDate | None = None
    tiers: list[Tier] = Field(min_length=1, max_length=20)
    notes: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def ordered(self):
        thresholds = [t.threshold for t in self.tiers]
        if thresholds[0] != 0 or thresholds != sorted(set(thresholds)):
            raise ValueError("Le premier palier doit commencer à 0, puis les seuils doivent être strictement croissants.")
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValueError("La fin d’application précède le début.")
        if self.opening_base and (not self.opening_on or self.opening_on < self.effective_from or self.opening_on > today() or (self.effective_to and self.opening_on > self.effective_to)):
            raise ValueError("Un cumul repris exige une date de reprise dans la période d’application, au plus tard aujourd’hui.")
        if self.method == 'global' and [t.rate for t in self.tiers] != sorted(t.rate for t in self.tiers):
            raise ValueError("Le calcul global avec rattrapage exige des taux non décroissants.")
        return self


class IncomeInput(Input):
    version: int | None = Field(default=None, ge=1)
    reference: str = Field(min_length=2, max_length=40)
    title: str = Field(min_length=3, max_length=180)
    category: Literal['sale','mandate','broker','moving','referral','other']
    partner: str = Field(min_length=2, max_length=180)
    transaction_id: str | None = Field(default=None, max_length=36)
    contact_id: str | None = Field(default=None, max_length=36)
    plan_id: str | None = Field(default=None, max_length=36)
    base_amount: Decimal = Field(default=0, ge=0, le=999999999, decimal_places=2)
    fixed_amount: Decimal | None = Field(default=None, ge=0, le=999999999, decimal_places=2)
    adjustment: Decimal = Field(default=0, ge=-999999999, le=999999999, decimal_places=2)
    adjustment_reason: str = Field(default="", max_length=1000)
    amount_basis: Literal['ht','ttc','contract'] = 'contract'
    expected_on: BusinessDate
    justification: str = Field(default="", max_length=5000)
    notes: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def calculation(self):
        if self.plan_id and (self.base_amount <= 0 or self.fixed_amount is not None):
            raise ValueError("Un barème exige une assiette positive et aucun montant fixe.")
        if not self.plan_id and self.fixed_amount is None:
            raise ValueError("Renseignez un montant fixe ou choisissez un barème.")
        if self.adjustment and len(self.adjustment_reason) < 10:
            raise ValueError("Justifiez l’ajustement manuel (10 caractères minimum).")
        return self


class AcquisitionInput(Input):
    version: int = Field(ge=1)
    request_id: UUID
    earned_on: BusinessDate
    digest: str = Field(pattern=r'^[a-f0-9]{64}$')


class PaymentInput(Input):
    version: int = Field(ge=1)
    request_id: UUID
    paid_on: BusinessDate
    amount: Decimal = Field(gt=0, le=999999999, decimal_places=2)
    reference: str = Field(min_length=3, max_length=180)
