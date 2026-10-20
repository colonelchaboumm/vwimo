from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker


def connect(url: str):
    options = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_size": 5, "max_overflow": 5}
    engine = create_engine(url, pool_pre_ping=True, **options)
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
    return engine, sessionmaker(bind=engine, expire_on_commit=False)
