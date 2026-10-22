"""Radar déclaré, observations de prix et journal manuel de prospection."""
from alembic import op
import sqlalchemy as sa

revision = "20261022_radar"
down_revision = "20261021_charlie"
branch_labels = None
depends_on = None


def entity():
    return [sa.Column("id", sa.String(36), primary_key=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False)]


def upgrade():
    op.create_table("radar_listings", *entity(),
        sa.Column("title", sa.String(180), nullable=False), sa.Column("source_name", sa.String(120), nullable=False),
        sa.Column("source_url", sa.String(1500), nullable=False), sa.Column("source_key", sa.String(64), unique=True),
        sa.Column("rights_note", sa.String(500), nullable=False), sa.Column("provenance", sa.String(20), nullable=False),
        sa.Column("city", sa.String(100), nullable=False), sa.Column("district", sa.String(120), nullable=False),
        sa.Column("address", sa.String(250), nullable=False), sa.Column("property_type", sa.String(40), nullable=False),
        sa.Column("seller_type", sa.String(20), nullable=False), sa.Column("status", sa.String(20), nullable=False),
        sa.Column("price", sa.Numeric(14, 2), nullable=False), sa.Column("surface", sa.Numeric(10, 2), nullable=False),
        sa.Column("rooms", sa.Integer()), sa.Column("published_on", sa.Date()), sa.Column("observed_on", sa.Date(), nullable=False),
        sa.Column("latitude", sa.Numeric(10, 6)), sa.Column("longitude", sa.Numeric(10, 6)),
        sa.Column("description", sa.Text(), nullable=False), sa.Column("search_text", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("price > 0 AND surface > 0", name="radar_dimensions"),
        sa.CheckConstraint("seller_type IN ('private','professional','unknown')", name="radar_seller"),
        sa.CheckConstraint("status IN ('active','removed','sold')", name="radar_status"),
        sa.CheckConstraint("(latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -85 AND 85 AND longitude BETWEEN -180 AND 180)", name="radar_coordinates"))
    op.create_index("ix_radar_listings_city", "radar_listings", ["city"])
    op.create_index("ix_radar_status_seller", "radar_listings", ["status", "seller_type"])
    op.create_table("radar_prices", *entity(),
        sa.Column("listing_id", sa.String(36), sa.ForeignKey("radar_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("price", sa.Numeric(14, 2), nullable=False), sa.Column("observed_on", sa.Date(), nullable=False),
        sa.Column("note", sa.String(500), nullable=False), sa.CheckConstraint("price > 0", name="radar_history_price"))
    op.create_index("ix_radar_prices_listing_created", "radar_prices", ["listing_id", "created_at"])
    op.create_table("prospects", *entity(),
        sa.Column("listing_id", sa.String(36), sa.ForeignKey("radar_listings.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("stage", sa.String(20), nullable=False), sa.Column("permission", sa.String(20), nullable=False),
        sa.Column("permission_note", sa.String(1000), nullable=False), sa.Column("opposed", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False), sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("stage IN ('qualified','contacted','replied','appointment','estimate','won','excluded')", name="prospect_stage"),
        sa.CheckConstraint("permission IN ('unknown','declared','refused')", name="prospect_permission"))
    op.create_index("ix_prospects_stage", "prospects", ["stage"])
    op.create_table("prospect_activities", *entity(),
        sa.Column("prospect_id", sa.String(36), sa.ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False), sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False), sa.Column("message", sa.Text(), nullable=False),
        sa.Column("evidence", sa.String(1000), nullable=False),
        sa.CheckConstraint("kind IN ('initial','followup','reply','refusal','appointment','estimate','mandate','note')", name="prospect_activity_kind"))
    op.create_index("ix_prospect_activity_prospect_date", "prospect_activities", ["prospect_id", "occurred_at"])
    op.create_table("outlook_settings", sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_id", sa.String(36), nullable=False), sa.Column("tenant", sa.String(36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"))


def downgrade():
    for table in ("outlook_settings", "prospect_activities", "prospects", "radar_prices", "radar_listings"):
        op.drop_table(table)
