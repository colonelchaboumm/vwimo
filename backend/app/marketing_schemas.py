from typing import Literal
from uuid import UUID
from pydantic import EmailStr, Field, field_validator, model_validator
from .schemas import Input
from .finance_schemas import BusinessDate
from .radar_schemas import today

class PermissionInput(Input):
    version: int = Field(ge=0)
    state: Literal['unknown','declared','refused','withdrawn']
    declared_on: BusinessDate | None = None
    note: str = Field(default='',max_length=1000)
    @model_validator(mode='after')
    def proof(self):
        if self.state!='unknown' and (not self.declared_on or self.declared_on>today() or len(self.note)<10):
            raise ValueError('Datez et justifiez cette préférence newsletter (10 caractères minimum, date non future).')
        if self.declared_on and self.declared_on>today(): raise ValueError('La date ne peut pas être future.')
        return self

class ExclusionInput(Input):
    version: int | None = Field(default=None,ge=1)
    email: EmailStr
    blocked: bool = True
    note: str = Field(min_length=10,max_length=1000)
    declared_on: BusinessDate
    confirm_unblock: bool = False
    @model_validator(mode='after')
    def dates(self):
        if self.declared_on>today(): raise ValueError('La date ne peut pas être future.')
        if not self.blocked and not self.confirm_unblock: raise ValueError('Confirmez explicitement la levée de cette exclusion.')
        return self

class CampaignInput(Input):
    version: int | None = Field(default=None,ge=1)
    reference: str = Field(min_length=2,max_length=40)
    title: str = Field(min_length=3,max_length=180)
    segment: Literal['buyers','sellers','professional','all'] = 'buyers'
    subject: str = Field(default='',max_length=180)
    body: str = Field(default='',max_length=20000)
    sender_name: str = Field(default='',max_length=180)
    sender_email: EmailStr | None = None
    reply_to: EmailStr | None = None
    footer: str = Field(default='',max_length=5000)
    archived: bool = False
    @field_validator('subject','sender_name')
    @classmethod
    def header(cls,value):
        if any(ord(c)<32 or ord(c)==127 for c in value): raise ValueError('Les en-têtes ne peuvent contenir de saut de ligne ou caractère de contrôle.')
        return value

class ExportInput(Input):
    request_id: UUID
    contact_id: str = Field(min_length=1,max_length=36)
    digest: str = Field(pattern=r'^[a-f0-9]{64}$')
    confirmed: Literal[True]
