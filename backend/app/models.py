from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text, UniqueConstraint
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
