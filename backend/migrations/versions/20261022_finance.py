"""Transactions, barèmes contractuels, revenus déclarés et encaissements."""
from alembic import op
import sqlalchemy as sa

revision = "20261022_finance"
down_revision = "20261022_radar"
branch_labels = None
depends_on = None


def entity():
    return [sa.Column("id", sa.String(36), primary_key=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False)]


def upgrade():
    op.create_table("sale_transactions", *entity(),
        sa.Column("reference", sa.String(40), nullable=False, unique=True),
        sa.Column("mandate_id", sa.String(36), sa.ForeignKey("mandates.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("buyer_id", sa.String(36), sa.ForeignKey("contacts.id", ondelete="RESTRICT")),
        sa.Column("stage", sa.String(20), nullable=False), sa.Column("sale_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("notary", sa.String(180), nullable=False), sa.Column("offer_on", sa.Date()), sa.Column("compromise_on", sa.Date()),
        sa.Column("expected_deed_on", sa.Date()), sa.Column("deed_on", sa.Date()), sa.Column("financing", sa.String(20), nullable=False),
        sa.Column("conditions", sa.Text(), nullable=False), sa.Column("checklist", sa.JSON(), nullable=False), sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("sale_price > 0", name="transaction_price"),
        sa.CheckConstraint("stage IN ('marketing','visits','offer','accepted','file','compromise','conditions','financing','signed','cancelled')", name="transaction_stage"))
    for field in ("mandate_id", "buyer_id", "stage", "expected_deed_on"):
        op.create_index("ix_sale_transactions_"+field, "sale_transactions", [field])
    op.create_index("uq_transaction_active_mandate", "sale_transactions", ["mandate_id"], unique=True, sqlite_where=sa.text("stage != 'cancelled'"), postgresql_where=sa.text("stage != 'cancelled'"))
    op.create_table("commission_plans", *entity(),
        sa.Column("name", sa.String(180), nullable=False), sa.Column("partner", sa.String(180), nullable=False),
        sa.Column("base_label", sa.String(180), nullable=False), sa.Column("amount_basis", sa.String(20), nullable=False), sa.Column("method", sa.String(20), nullable=False),
        sa.Column("period", sa.String(20), nullable=False), sa.Column("effective_from", sa.Date(), nullable=False), sa.Column("effective_to", sa.Date()),
        sa.Column("opening_base", sa.Numeric(14, 2), nullable=False), sa.Column("opening_on", sa.Date()),
        sa.Column("tiers", sa.JSON(), nullable=False), sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("method IN ('marginal','global')", name="commission_method"), sa.CheckConstraint("period IN ('year','month')", name="commission_period"))
    op.create_table("incomes", *entity(), sa.Column("reference", sa.String(40), nullable=False, unique=True),
        sa.Column("title", sa.String(180), nullable=False), sa.Column("category", sa.String(20), nullable=False), sa.Column("partner", sa.String(180), nullable=False),
        sa.Column("transaction_id", sa.String(36), sa.ForeignKey("sale_transactions.id", ondelete="RESTRICT")),
        sa.Column("contact_id", sa.String(36), sa.ForeignKey("contacts.id", ondelete="RESTRICT")),
        sa.Column("plan_id", sa.String(36), sa.ForeignKey("commission_plans.id", ondelete="RESTRICT")),
        sa.Column("base_amount", sa.Numeric(14, 2), nullable=False), sa.Column("fixed_amount", sa.Numeric(14, 2)),
        sa.Column("adjustment", sa.Numeric(14, 2), nullable=False), sa.Column("adjustment_reason", sa.String(1000), nullable=False),
        sa.Column("amount_basis", sa.String(20), nullable=False), sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("expected_on", sa.Date(), nullable=False), sa.Column("earned_on", sa.Date()), sa.Column("status", sa.String(20), nullable=False),
        sa.Column("calculation", sa.JSON(), nullable=False), sa.Column("justification", sa.Text(), nullable=False), sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("acquisition_request_id", sa.String(36), unique=True), sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("category IN ('sale','mandate','broker','moving','referral','other')", name="income_category"),
        sa.CheckConstraint("status IN ('forecast','acquired','cancelled')", name="income_status"),
        sa.CheckConstraint("amount_basis IN ('ht','ttc','contract')", name="income_basis"), sa.CheckConstraint("base_amount >= 0 AND amount >= 0", name="income_amounts"))
    for field in ("transaction_id", "contact_id", "expected_on", "status"):
        op.create_index("ix_incomes_"+field, "incomes", [field])
    op.create_index("ix_income_plan_earned", "incomes", ["plan_id", "earned_on"])
    op.create_table("income_payments", *entity(),
        sa.Column("income_id", sa.String(36), sa.ForeignKey("incomes.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("paid_on", sa.Date(), nullable=False), sa.Column("amount", sa.Numeric(14, 2), nullable=False), sa.Column("reference", sa.String(180), nullable=False),
        sa.CheckConstraint("amount > 0", name="payment_positive"))
    op.create_index("ix_income_payment_date", "income_payments", ["income_id", "paid_on"])


def downgrade():
    for table in ("income_payments", "incomes", "commission_plans", "sale_transactions"):
        op.drop_table(table)
