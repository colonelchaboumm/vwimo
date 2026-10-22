"""Configuration protégée et conversations privées de Charlie."""
from alembic import op
import sqlalchemy as sa

revision = "20261021_charlie"
down_revision = "20261021_commercial"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("ai_settings", sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False), sa.Column("model", sa.String(120), nullable=False),
        sa.Column("key_cipher", sa.Text()), sa.Column("max_output_tokens", sa.Integer(), nullable=False),
        sa.Column("tested_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("max_output_tokens BETWEEN 256 AND 8192", name="ai_output_limit"))
    op.create_table("ai_conversations", sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(180), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("pending_request_id", sa.String(36)), sa.Column("pending_since", sa.DateTime(timezone=True)),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.create_index("ix_ai_conversations_user_id", "ai_conversations", ["user_id"])
    op.create_index("ix_ai_conversations_owner_updated", "ai_conversations", ["user_id", "updated_at"])
    op.create_table("ai_turns", sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("conversation_id", sa.String(36), sa.ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("question", sa.Text(), nullable=False), sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("engine", sa.String(20), nullable=False), sa.Column("model", sa.String(120), nullable=False),
        sa.Column("status", sa.String(20), nullable=False), sa.Column("context", sa.JSON(), nullable=False),
        sa.Column("error", sa.String(500), nullable=False),
        sa.CheckConstraint("status IN ('running','completed','failed')", name="ai_turn_status"),
        sa.CheckConstraint("engine IN ('local','openai')", name="ai_turn_engine"))
    op.create_index("ix_ai_turns_conversation_id", "ai_turns", ["conversation_id"])
    op.create_index("ix_ai_turns_conversation_created", "ai_turns", ["conversation_id", "created_at"])


def downgrade():
    op.drop_table("ai_turns")
    op.drop_table("ai_conversations")
    op.drop_table("ai_settings")
