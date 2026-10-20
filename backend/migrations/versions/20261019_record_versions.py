"""Versionner les dossiers pour détecter les modifications concurrentes."""
from alembic import op
import sqlalchemy as sa

revision = "20261019_versions"
down_revision = "d59c00624dcc"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("contacts", sa.Column("version", sa.Integer(), server_default="1", nullable=False))
    op.add_column("mandates", sa.Column("version", sa.Integer(), server_default="1", nullable=False))


def downgrade():
    with op.batch_alter_table("mandates") as batch:
        batch.drop_column("version")
    with op.batch_alter_table("contacts") as batch:
        batch.drop_column("version")
