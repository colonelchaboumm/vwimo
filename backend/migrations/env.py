from alembic import context
from sqlalchemy import create_engine, pool
from app.config import Settings
from app.models import Base

config = context.config
settings = config.attributes.get("settings") or Settings()
settings.validate_runtime()
url = settings.database_url
if context.is_offline_mode():
    context.configure(url=url, target_metadata=Base.metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True, render_as_batch=url.startswith("sqlite"))
        with context.begin_transaction():
            context.run_migrations()
