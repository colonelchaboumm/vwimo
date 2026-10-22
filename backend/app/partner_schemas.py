from pydantic import EmailStr, Field, model_validator
from typing import Literal
from .schemas import Input
from .finance_schemas import BusinessDate
from .radar_schemas import today


class PartnerInput(Input):
    version: int | None = Field(default=None, ge=1)
    name: str = Field(min_length=2, max_length=180)
    kind: Literal['broker','moving','agency','notary','other']
    representative: str = Field(default='', max_length=180)
    email: EmailStr | None = None
    phone: str = Field(default='', max_length=30, pattern=r'^[\d+().\s-]*$')
    city: str = Field(default='', max_length=100)
    agreement: str = Field(default='', max_length=5000)
    notes: str = Field(default='', max_length=5000)
    archived: bool = False


class ReferralInput(Input):
    version: int | None = Field(default=None, ge=1)
    reference: str = Field(min_length=2, max_length=40)
    title: str = Field(min_length=3, max_length=180)
    kind: Literal['broker','referral','service']
    partner_id: str = Field(min_length=1, max_length=36)
    contact_id: str = Field(min_length=1, max_length=36)
    transaction_id: str | None = Field(default=None, max_length=36)
    source: str = Field(min_length=2, max_length=180)
    project: str = Field(min_length=3, max_length=180)
    introduced_on: BusinessDate
    transferred_on: BusinessDate | None = None
    permission: Literal['unknown','granted','refused','withdrawn'] = 'unknown'
    permission_on: BusinessDate | None = None
    permission_note: str = Field(default='', max_length=1000)
    stage: Literal['draft','introduced','in_progress','completed','unsuccessful','cancelled'] = 'draft'
    financing: Literal['unknown','requested','approved','refused'] = 'unknown'
    outcome: str = Field(default='', max_length=1000)
    next_action_on: BusinessDate | None = None
    notes: str = Field(default='', max_length=5000)

    @model_validator(mode='after')
    def validate_dates(self):
        if self.introduced_on > today() or (self.transferred_on and not self.introduced_on <= self.transferred_on <= today()):
            raise ValueError('Les dates effectuées doivent être chronologiques et non futures.')
        if self.permission_on and not self.introduced_on <= self.permission_on <= today():
            raise ValueError('La date d’autorisation/refus/retrait doit être comprise entre l’ouverture du dossier et aujourd’hui.')
        if self.permission != 'unknown' and (not self.permission_on or len(self.permission_note) < 10):
            raise ValueError('Datez et justifiez l’autorisation, le refus ou le retrait (10 caractères minimum).')
        if self.stage in ('introduced','in_progress','completed') and not self.transferred_on:
            raise ValueError('Renseignez la date de mise en relation effectuée pour cette étape.')
        if self.stage == 'draft' and self.transferred_on:
            raise ValueError('Une mise en relation effectuée ne peut pas rester en préparation.')
        if self.stage in ('completed','unsuccessful','cancelled') and len(self.outcome) < 10:
            raise ValueError('Documentez le résultat ou la clôture (10 caractères minimum).')
        if self.kind != 'broker' and self.financing != 'unknown':
            raise ValueError('Le suivi du financement est réservé aux dossiers de courtage.')
        return self
