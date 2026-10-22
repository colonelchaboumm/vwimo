"""Génération des identifiants, conservant les comptes et sessions existants."""
from alembic import op
import sqlalchemy as sa

revision = '20261022_account_security'
down_revision = '20261022_marketing'
branch_labels = None
depends_on = None


def upgrade():
    for table in ('users', 'sessions'):
        op.add_column(table, sa.Column('auth_version', sa.Integer(), nullable=False, server_default='1'))


def downgrade():
    for table in ('sessions', 'users'):
        op.drop_column(table, 'auth_version')
