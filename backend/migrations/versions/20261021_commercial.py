"""Agenda local et estimations sourcées."""
from alembic import op
import sqlalchemy as sa

revision = "20261021_commercial"
down_revision = "20261019_versions"
branch_labels = None
depends_on = None


def common():
    return [sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1")]


def upgrade():
    op.create_table("calendar_events", *common(),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location", sa.String(300), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("contact_id", sa.String(36), sa.ForeignKey("contacts.id", ondelete="RESTRICT")),
        sa.Column("mandate_id", sa.String(36), sa.ForeignKey("mandates.id", ondelete="RESTRICT")),
        sa.CheckConstraint("ends_at > starts_at", name="calendar_dates"),
        sa.CheckConstraint("kind IN ('visit','estimate','seller','buyer','signing','other')", name="calendar_kind"))
    op.create_index("ix_calendar_interval", "calendar_events", ["starts_at", "ends_at"])
    for column in ("contact_id", "mandate_id"):
        op.create_index(f"ix_calendar_events_{column}", "calendar_events", [column])
    op.create_table("estimates", *common(),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("address", sa.String(250), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("property_type", sa.String(40), nullable=False),
        sa.Column("surface", sa.Numeric(10, 2), nullable=False),
        sa.Column("contact_id", sa.String(36), sa.ForeignKey("contacts.id", ondelete="RESTRICT")),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("low_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("central_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("high_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("basis", sa.String(20), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("comparables", sa.JSON(), nullable=False),
        sa.Column("analysis", sa.Text(), nullable=False),
        sa.CheckConstraint("surface > 0", name="estimate_surface"),
        sa.CheckConstraint("low_price > 0 AND central_price >= low_price AND high_price >= central_price", name="estimate_prices"),
        sa.CheckConstraint("status IN ('draft','presented','accepted','archived')", name="estimate_status"),
        sa.CheckConstraint("basis IN ('manual','sale','asking')", name="estimate_basis"))
    op.create_index("ix_estimates_city", "estimates", ["city"])
    op.create_index("ix_estimates_contact_id", "estimates", ["contact_id"])


def downgrade():
    op.drop_table("estimates")
    op.drop_table("calendar_events")
