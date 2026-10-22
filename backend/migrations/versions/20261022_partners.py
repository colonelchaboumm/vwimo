"""Annuaire, mises en relation et revenus liés."""
from alembic import op
import sqlalchemy as sa

revision = "20261022_partners"
down_revision = "20261022_finance"
branch_labels = None
depends_on = None


def entity():
    return [sa.Column('id', sa.String(36), primary_key=True), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)]


def upgrade():
    op.create_table('partners', *entity(),
        sa.Column('name', sa.String(180), nullable=False), sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('representative', sa.String(180), nullable=False), sa.Column('email', sa.String(254)),
        sa.Column('phone', sa.String(30), nullable=False), sa.Column('city', sa.String(100), nullable=False),
        sa.Column('agreement', sa.Text(), nullable=False), sa.Column('notes', sa.Text(), nullable=False),
        sa.Column('archived', sa.Boolean(), nullable=False), sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.CheckConstraint("kind IN ('broker','moving','agency','notary','other')", name='partner_kind'))
    for field in ('name','kind','archived'): op.create_index('ix_partners_'+field, 'partners', [field])
    op.create_table('referrals', *entity(),
        sa.Column('reference', sa.String(40), nullable=False, unique=True), sa.Column('title', sa.String(180), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False), sa.Column('partner_id', sa.String(36), sa.ForeignKey('partners.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('contact_id', sa.String(36), sa.ForeignKey('contacts.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('transaction_id', sa.String(36), sa.ForeignKey('sale_transactions.id', ondelete='RESTRICT')),
        sa.Column('source', sa.String(180), nullable=False), sa.Column('project', sa.String(180), nullable=False),
        sa.Column('introduced_on', sa.Date(), nullable=False), sa.Column('transferred_on', sa.Date()),
        sa.Column('permission', sa.String(20), nullable=False), sa.Column('permission_on', sa.Date()),
        sa.Column('permission_note', sa.String(1000), nullable=False), sa.Column('transmission', sa.JSON()),
        sa.Column('stage', sa.String(20), nullable=False), sa.Column('financing', sa.String(20), nullable=False),
        sa.Column('outcome', sa.String(1000), nullable=False), sa.Column('next_action_on', sa.Date()),
        sa.Column('notes', sa.Text(), nullable=False), sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.CheckConstraint("kind IN ('broker','referral','service')", name='referral_kind'),
        sa.CheckConstraint("stage IN ('draft','introduced','in_progress','completed','unsuccessful','cancelled')", name='referral_stage'),
        sa.CheckConstraint("permission IN ('unknown','granted','refused','withdrawn')", name='referral_permission'),
        sa.CheckConstraint("financing IN ('unknown','requested','approved','refused')", name='referral_financing'))
    for field in ('kind','partner_id','contact_id','transaction_id','introduced_on','transferred_on','stage','next_action_on'):
        op.create_index('ix_referrals_'+field, 'referrals', [field])
    op.create_table('referral_events', *entity(),
        sa.Column('referral_id', sa.String(36), sa.ForeignKey('referrals.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('actor_id', sa.String(36), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False), sa.Column('changes', sa.JSON(), nullable=False))
    op.create_index('ix_referral_event_date', 'referral_events', ['referral_id','created_at'])
    op.create_index('ix_referral_events_actor_id', 'referral_events', ['actor_id'])
    with op.batch_alter_table('incomes') as batch:
        batch.add_column(sa.Column('referral_id', sa.String(36)))
        batch.create_foreign_key('fk_income_referral', 'referrals', ['referral_id'], ['id'], ondelete='RESTRICT')
        batch.create_index('ix_incomes_referral_id', ['referral_id'])


def downgrade():
    with op.batch_alter_table('incomes') as batch:
        batch.drop_index('ix_incomes_referral_id')
        batch.drop_constraint('fk_income_referral', type_='foreignkey')
        batch.drop_column('referral_id')
    for table in ('referral_events','referrals','partners'): op.drop_table(table)
