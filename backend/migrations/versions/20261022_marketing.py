"""Brouillons, autorisations newsletter, exclusions et exports locaux."""
from alembic import op
import sqlalchemy as sa
revision = '20261022_marketing'
down_revision = '20261022_partners'
branch_labels = None
depends_on = None

def entity():
    return [sa.Column('id',sa.String(36),primary_key=True),sa.Column('created_at',sa.DateTime(timezone=True),nullable=False)]

def upgrade():
    guard=op.create_table('marketing_guard',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('version',sa.Integer(),nullable=False,server_default='1'))
    op.bulk_insert(guard,[{'id':1,'version':1}])
    op.create_table('marketing_permissions',sa.Column('contact_id',sa.String(36),sa.ForeignKey('contacts.id',ondelete='RESTRICT'),primary_key=True),
        sa.Column('state',sa.String(20),nullable=False),sa.Column('email_snapshot',sa.String(254)),sa.Column('declared_on',sa.Date()),sa.Column('note',sa.String(1000),nullable=False),sa.Column('version',sa.Integer(),nullable=False,server_default='1'),
        sa.CheckConstraint("state IN ('unknown','declared','refused','withdrawn')",name='marketing_permission_state'))
    op.create_table('email_exclusions',*entity(),sa.Column('email',sa.String(254),unique=True,nullable=False),sa.Column('blocked',sa.Boolean(),nullable=False),sa.Column('note',sa.String(1000),nullable=False),sa.Column('declared_on',sa.Date(),nullable=False),sa.Column('version',sa.Integer(),nullable=False,server_default='1'))
    op.create_index('ix_email_exclusions_blocked','email_exclusions',['blocked'])
    op.create_table('campaigns',*entity(),sa.Column('reference',sa.String(40),unique=True,nullable=False),sa.Column('title',sa.String(180),nullable=False),sa.Column('segment',sa.String(20),nullable=False),sa.Column('subject',sa.String(180),nullable=False),sa.Column('body',sa.Text(),nullable=False),sa.Column('sender_name',sa.String(180),nullable=False),sa.Column('sender_email',sa.String(254)),sa.Column('reply_to',sa.String(254)),sa.Column('footer',sa.Text(),nullable=False),sa.Column('archived',sa.Boolean(),nullable=False),sa.Column('version',sa.Integer(),nullable=False,server_default='1'),
        sa.CheckConstraint("segment IN ('buyers','sellers','professional','all')",name='campaign_segment'))
    op.create_index('ix_campaigns_archived','campaigns',['archived'])
    op.create_table('campaign_exports',*entity(),sa.Column('campaign_id',sa.String(36),sa.ForeignKey('campaigns.id',ondelete='RESTRICT'),nullable=False),sa.Column('contact_id',sa.String(36),sa.ForeignKey('contacts.id',ondelete='RESTRICT'),nullable=False),sa.Column('recipient_email',sa.String(254),nullable=False),sa.Column('campaign_version',sa.Integer(),nullable=False),sa.Column('audience_digest',sa.String(64),nullable=False),sa.Column('content',sa.Text(),nullable=False),sa.Column('sha256',sa.String(64),nullable=False))
    op.create_index('ix_campaign_export_date','campaign_exports',['campaign_id','created_at'])
    op.create_index('ix_campaign_exports_contact_id','campaign_exports',['contact_id'])

def downgrade():
    for table in ('campaign_exports','campaigns','email_exclusions','marketing_permissions','marketing_guard'): op.drop_table(table)
