from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Entity:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Installation(Base):
    __tablename__ = "installation"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mode: Mapped[str] = mapped_column(String(10))


class User(Entity, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(20), default="advisor")
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class SessionToken(Entity, Base):
    __tablename__ = "sessions"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Contact(Entity, Base):
    __tablename__ = "contacts"
    __table_args__ = (CheckConstraint("kind IN ('buyer','seller','both','professional')", name="contact_kind"),)
    name: Mapped[str] = mapped_column(String(120), index=True)
    email: Mapped[str | None] = mapped_column(String(254), index=True)
    phone: Mapped[str] = mapped_column(String(30), default="")
    kind: Mapped[str] = mapped_column(String(20), index=True)
    city: Mapped[str] = mapped_column(String(100), default="")
    source: Mapped[str] = mapped_column(String(120), default="Saisie manuelle")
    notes: Mapped[str] = mapped_column(Text, default="")
    provenance: Mapped[str] = mapped_column(String(20), default="manual")
    archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class BuyerCriteria(Base):
    __tablename__ = "buyer_criteria"
    __table_args__ = (CheckConstraint("budget_min >= 0 AND budget_max >= budget_min", name="buyer_budget"), CheckConstraint("min_surface >= 0 AND bedrooms >= 0", name="buyer_dimensions"))
    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True)
    budget_min: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    budget_max: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    min_surface: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    bedrooms: Mapped[int] = mapped_column(Integer, default=0)
    sectors: Mapped[str] = mapped_column(String(500), default="")
    financing: Mapped[str] = mapped_column(String(120), default="À qualifier")
    mandatory: Mapped[str] = mapped_column(Text, default="")


class Property(Entity, Base):
    __tablename__ = "properties"
    __table_args__ = (CheckConstraint("surface > 0 AND rooms > 0", name="property_dimensions"),)
    title: Mapped[str] = mapped_column(String(180))
    address: Mapped[str] = mapped_column(String(250))
    city: Mapped[str] = mapped_column(String(100), index=True)
    property_type: Mapped[str] = mapped_column(String(40))
    surface: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    rooms: Mapped[int] = mapped_column(Integer)
    dpe: Mapped[str] = mapped_column(String(12), default="Inconnu")


class Mandate(Entity, Base):
    __tablename__ = "mandates"
    __table_args__ = (CheckConstraint("price > 0 AND fees >= 0 AND fees <= price", name="mandate_amounts"), CheckConstraint("end_date >= signed_date", name="mandate_dates"), CheckConstraint("kind IN ('exclusive','simple','partner')", name="mandate_kind"), CheckConstraint("status IN ('preparation','active','offer','compromise','sold','expired','withdrawn')", name="mandate_status"), Index("ix_mandates_status_end", "status", "end_date"))
    reference: Mapped[str] = mapped_column(String(40), unique=True)
    property_id: Mapped[str] = mapped_column(ForeignKey("properties.id", ondelete="RESTRICT"), unique=True)
    seller_id: Mapped[str] = mapped_column(ForeignKey("contacts.id", ondelete="RESTRICT"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="preparation")
    signed_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    fees: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    partner_name: Mapped[str] = mapped_column(String(180), default="")
    partner_terms: Mapped[str] = mapped_column(Text, default="")
    commercialization_authorized: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    provenance: Mapped[str] = mapped_column(String(20), default="manual")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class Document(Entity, Base):
    __tablename__ = "documents"
    contact_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id", ondelete="RESTRICT"), index=True)
    mandate_id: Mapped[str | None] = mapped_column(ForeignKey("mandates.id", ondelete="RESTRICT"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(80), unique=True)
    media_type: Mapped[str] = mapped_column(String(120))
    size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    category: Mapped[str] = mapped_column(String(80), default="Autre")
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)


class AuditLog(Entity, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(36), index=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class AutomationSettings(Base):
    __tablename__ = "automation_settings"
    __table_args__ = (CheckConstraint("daily_limit BETWEEN 1 AND 100", name="daily_limit_range"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    daily_limit: Mapped[int] = mapped_column(Integer, default=17)
    followups: Mapped[bool] = mapped_column(Boolean, default=True)
    followup_days: Mapped[int] = mapped_column(Integer, default=7)
    max_followups: Mapped[int] = mapped_column(Integer, default=1)
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Paris")
    sector: Mapped[str] = mapped_column(String(120), default="Annecy et Grand Annecy")


class RadarListing(Entity, Base):
    __tablename__ = "radar_listings"
    __table_args__ = (
        CheckConstraint("price > 0 AND surface > 0", name="radar_dimensions"),
        CheckConstraint("seller_type IN ('private','professional','unknown')", name="radar_seller"),
        CheckConstraint("status IN ('active','removed','sold')", name="radar_status"),
        CheckConstraint("(latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -85 AND 85 AND longitude BETWEEN -180 AND 180)", name="radar_coordinates"),
        Index("ix_radar_status_seller", "status", "seller_type"),
    )
    title: Mapped[str] = mapped_column(String(180))
    source_name: Mapped[str] = mapped_column(String(120))
    source_url: Mapped[str] = mapped_column(String(1500), default="")
    source_key: Mapped[str | None] = mapped_column(String(64), unique=True)
    rights_note: Mapped[str] = mapped_column(String(500), default="")
    provenance: Mapped[str] = mapped_column(String(20), default="manual")
    city: Mapped[str] = mapped_column(String(100), index=True)
    district: Mapped[str] = mapped_column(String(120), default="")
    address: Mapped[str] = mapped_column(String(250), default="")
    property_type: Mapped[str] = mapped_column(String(40))
    seller_type: Mapped[str] = mapped_column(String(20), default="unknown")
    status: Mapped[str] = mapped_column(String(20), default="active")
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    surface: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    rooms: Mapped[int | None] = mapped_column(Integer)
    published_on: Mapped[date | None] = mapped_column(Date)
    observed_on: Mapped[date] = mapped_column(Date)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 6))
    description: Mapped[str] = mapped_column(Text, default="")
    search_text: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class RadarPrice(Entity, Base):
    __tablename__ = "radar_prices"
    __table_args__ = (CheckConstraint("price > 0", name="radar_history_price"), Index("ix_radar_prices_listing_created", "listing_id", "created_at"))
    listing_id: Mapped[str] = mapped_column(ForeignKey("radar_listings.id", ondelete="CASCADE"))
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    observed_on: Mapped[date] = mapped_column(Date)
    note: Mapped[str] = mapped_column(String(500), default="")


class Prospect(Entity, Base):
    __tablename__ = "prospects"
    __table_args__ = (CheckConstraint("stage IN ('qualified','contacted','replied','appointment','estimate','won','excluded')", name="prospect_stage"),
                     CheckConstraint("permission IN ('unknown','declared','refused')", name="prospect_permission"))
    listing_id: Mapped[str] = mapped_column(ForeignKey("radar_listings.id", ondelete="RESTRICT"), unique=True)
    stage: Mapped[str] = mapped_column(String(20), default="qualified", index=True)
    permission: Mapped[str] = mapped_column(String(20), default="unknown")
    permission_note: Mapped[str] = mapped_column(String(1000), default="")
    opposed: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class ProspectActivity(Entity, Base):
    __tablename__ = "prospect_activities"
    __table_args__ = (CheckConstraint("kind IN ('initial','followup','reply','refusal','appointment','estimate','mandate','note')", name="prospect_activity_kind"),
                     Index("ix_prospect_activity_prospect_date", "prospect_id", "occurred_at"))
    prospect_id: Mapped[str] = mapped_column(ForeignKey("prospects.id", ondelete="CASCADE"))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    kind: Mapped[str] = mapped_column(String(20))
    channel: Mapped[str] = mapped_column(String(20))
    message: Mapped[str] = mapped_column(Text)
    evidence: Mapped[str] = mapped_column(String(1000), default="")


class OutlookSettings(Base):
    __tablename__ = "outlook_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[str] = mapped_column(String(36), default="")
    tenant: Mapped[str] = mapped_column(String(36), default="common")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class CalendarEvent(Entity, Base):
    __tablename__ = "calendar_events"
    __table_args__ = (CheckConstraint("ends_at > starts_at", name="calendar_dates"),
                     CheckConstraint("kind IN ('visit','estimate','seller','buyer','signing','other')", name="calendar_kind"),
                     Index("ix_calendar_interval", "starts_at", "ends_at"))
    title: Mapped[str] = mapped_column(String(180))
    kind: Mapped[str] = mapped_column(String(20), default="other")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location: Mapped[str] = mapped_column(String(300), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    contact_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id", ondelete="RESTRICT"), index=True)
    mandate_id: Mapped[str | None] = mapped_column(ForeignKey("mandates.id", ondelete="RESTRICT"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class Estimate(Entity, Base):
    __tablename__ = "estimates"
    __table_args__ = (CheckConstraint("surface > 0", name="estimate_surface"),
                     CheckConstraint("low_price > 0 AND central_price >= low_price AND high_price >= central_price", name="estimate_prices"),
                     CheckConstraint("status IN ('draft','presented','accepted','archived')", name="estimate_status"),
                     CheckConstraint("basis IN ('manual','sale','asking')", name="estimate_basis"))
    title: Mapped[str] = mapped_column(String(180))
    address: Mapped[str] = mapped_column(String(250))
    city: Mapped[str] = mapped_column(String(100), index=True)
    property_type: Mapped[str] = mapped_column(String(40))
    surface: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    contact_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    low_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    central_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    high_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    basis: Mapped[str] = mapped_column(String(20), default="sale")
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    comparables: Mapped[list] = mapped_column(JSON, default=list)
    analysis: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class AISettings(Base):
    __tablename__ = "ai_settings"
    __table_args__ = (CheckConstraint("max_output_tokens BETWEEN 256 AND 8192", name="ai_output_limit"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    model: Mapped[str] = mapped_column(String(120), default="gpt-5-mini")
    key_cipher: Mapped[str | None] = mapped_column(Text)
    max_output_tokens: Mapped[int] = mapped_column(Integer, default=2048)
    tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AIConversation(Entity, Base):
    __tablename__ = "ai_conversations"
    __table_args__ = (Index("ix_ai_conversations_owner_updated", "user_id", "updated_at"),)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    pending_request_id: Mapped[str | None] = mapped_column(String(36))
    pending_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class AITurn(Base):
    __tablename__ = "ai_turns"
    __table_args__ = (CheckConstraint("status IN ('running','completed','failed')", name="ai_turn_status"),
                     CheckConstraint("engine IN ('local','openai')", name="ai_turn_engine"),
                     Index("ix_ai_turns_conversation_created", "conversation_id", "created_at"))
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text, default="")
    engine: Mapped[str] = mapped_column(String(20))
    model: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(20), default="running")
    context: Mapped[dict] = mapped_column(JSON)
    error: Mapped[str] = mapped_column(String(500), default="")


class SaleTransaction(Entity, Base):
    __tablename__ = "sale_transactions"
    __table_args__ = (CheckConstraint("sale_price > 0", name="transaction_price"),
        CheckConstraint("stage IN ('marketing','visits','offer','accepted','file','compromise','conditions','financing','signed','cancelled')", name="transaction_stage"),
        Index("uq_transaction_active_mandate", "mandate_id", unique=True, sqlite_where=text("stage != 'cancelled'"), postgresql_where=text("stage != 'cancelled'")))
    reference: Mapped[str] = mapped_column(String(40), unique=True)
    mandate_id: Mapped[str] = mapped_column(ForeignKey("mandates.id", ondelete="RESTRICT"), index=True)
    buyer_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id", ondelete="RESTRICT"), index=True)
    stage: Mapped[str] = mapped_column(String(20), default="marketing", index=True)
    sale_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    notary: Mapped[str] = mapped_column(String(180), default="")
    offer_on: Mapped[date | None] = mapped_column(Date)
    compromise_on: Mapped[date | None] = mapped_column(Date)
    expected_deed_on: Mapped[date | None] = mapped_column(Date, index=True)
    deed_on: Mapped[date | None] = mapped_column(Date)
    financing: Mapped[str] = mapped_column(String(20), default="unknown")
    conditions: Mapped[str] = mapped_column(Text, default="")
    checklist: Mapped[list] = mapped_column(JSON, default=list)
    notes: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class CommissionPlan(Entity, Base):
    __tablename__ = "commission_plans"
    __table_args__ = (CheckConstraint("method IN ('marginal','global')", name="commission_method"),
                     CheckConstraint("period IN ('year','month')", name="commission_period"))
    name: Mapped[str] = mapped_column(String(180))
    partner: Mapped[str] = mapped_column(String(180))
    base_label: Mapped[str] = mapped_column(String(180))
    amount_basis: Mapped[str] = mapped_column(String(20), default="contract")
    method: Mapped[str] = mapped_column(String(20))
    period: Mapped[str] = mapped_column(String(20))
    effective_from: Mapped[date] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    opening_base: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    opening_on: Mapped[date | None] = mapped_column(Date)
    tiers: Mapped[list] = mapped_column(JSON)
    notes: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class Income(Entity, Base):
    __tablename__ = "incomes"
    __table_args__ = (CheckConstraint("category IN ('sale','mandate','broker','moving','referral','other')", name="income_category"),
                     CheckConstraint("status IN ('forecast','acquired','cancelled')", name="income_status"),
                     CheckConstraint("amount_basis IN ('ht','ttc','contract')", name="income_basis"),
                     CheckConstraint("base_amount >= 0 AND amount >= 0", name="income_amounts"),
                     Index("ix_income_plan_earned", "plan_id", "earned_on"))
    reference: Mapped[str] = mapped_column(String(40), unique=True)
    title: Mapped[str] = mapped_column(String(180))
    category: Mapped[str] = mapped_column(String(20))
    partner: Mapped[str] = mapped_column(String(180))
    transaction_id: Mapped[str | None] = mapped_column(ForeignKey("sale_transactions.id", ondelete="RESTRICT"), index=True)
    contact_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id", ondelete="RESTRICT"), index=True)
    referral_id: Mapped[str | None] = mapped_column(ForeignKey("referrals.id", ondelete="RESTRICT"), index=True)
    plan_id: Mapped[str | None] = mapped_column(ForeignKey("commission_plans.id", ondelete="RESTRICT"))
    base_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    fixed_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    adjustment: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    adjustment_reason: Mapped[str] = mapped_column(String(1000), default="")
    amount_basis: Mapped[str] = mapped_column(String(20), default="contract")
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    expected_on: Mapped[date] = mapped_column(Date, index=True)
    earned_on: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="forecast", index=True)
    calculation: Mapped[dict] = mapped_column(JSON)
    justification: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    acquisition_request_id: Mapped[str | None] = mapped_column(String(36), unique=True)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class IncomePayment(Entity, Base):
    __tablename__ = "income_payments"
    __table_args__ = (CheckConstraint("amount > 0", name="payment_positive"), Index("ix_income_payment_date", "income_id", "paid_on"))
    income_id: Mapped[str] = mapped_column(ForeignKey("incomes.id", ondelete="RESTRICT"))
    paid_on: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    reference: Mapped[str] = mapped_column(String(180))


class Partner(Entity, Base):
    __tablename__ = "partners"
    __table_args__ = (CheckConstraint("kind IN ('broker','moving','agency','notary','other')", name="partner_kind"),)
    name: Mapped[str] = mapped_column(String(180), index=True)
    kind: Mapped[str] = mapped_column(String(20), index=True)
    representative: Mapped[str] = mapped_column(String(180), default="")
    email: Mapped[str | None] = mapped_column(String(254))
    phone: Mapped[str] = mapped_column(String(30), default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    agreement: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class Referral(Entity, Base):
    __tablename__ = "referrals"
    __table_args__ = (
        CheckConstraint("kind IN ('broker','referral','service')", name="referral_kind"),
        CheckConstraint("stage IN ('draft','introduced','in_progress','completed','unsuccessful','cancelled')", name="referral_stage"),
        CheckConstraint("permission IN ('unknown','granted','refused','withdrawn')", name="referral_permission"),
        CheckConstraint("financing IN ('unknown','requested','approved','refused')", name="referral_financing"),
    )
    reference: Mapped[str] = mapped_column(String(40), unique=True)
    title: Mapped[str] = mapped_column(String(180))
    kind: Mapped[str] = mapped_column(String(20), index=True)
    partner_id: Mapped[str] = mapped_column(ForeignKey("partners.id", ondelete="RESTRICT"), index=True)
    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id", ondelete="RESTRICT"), index=True)
    transaction_id: Mapped[str | None] = mapped_column(ForeignKey("sale_transactions.id", ondelete="RESTRICT"), index=True)
    source: Mapped[str] = mapped_column(String(180))
    project: Mapped[str] = mapped_column(String(180))
    introduced_on: Mapped[date] = mapped_column(Date, index=True)
    transferred_on: Mapped[date | None] = mapped_column(Date, index=True)
    permission: Mapped[str] = mapped_column(String(20), default="unknown")
    permission_on: Mapped[date | None] = mapped_column(Date)
    permission_note: Mapped[str] = mapped_column(String(1000), default="")
    transmission: Mapped[dict | None] = mapped_column(JSON)
    stage: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    financing: Mapped[str] = mapped_column(String(20), default="unknown")
    outcome: Mapped[str] = mapped_column(String(1000), default="")
    next_action_on: Mapped[date | None] = mapped_column(Date, index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    __mapper_args__ = {"version_id_col": version}


class ReferralEvent(Entity, Base):
    __tablename__ = "referral_events"
    __table_args__ = (Index("ix_referral_event_date", "referral_id", "created_at"),)
    referral_id: Mapped[str] = mapped_column(ForeignKey("referrals.id", ondelete="RESTRICT"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    changes: Mapped[dict] = mapped_column(JSON)
