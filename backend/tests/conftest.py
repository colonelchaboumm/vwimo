import os
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.config import Settings
from app.main import create_app
from app.manage import initialize


@pytest.fixture
def setup(tmp_path, monkeypatch):
    pg_url = os.environ.get("IMMO_TEST_POSTGRES_URL")
    admin = None
    schema = "test_" + uuid4().hex
    if pg_url:
        # Un schéma aléatoire par test ; aucune table préexistante n'est modifiée.
        admin = create_engine(pg_url)
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        url = make_url(pg_url).update_query_dict({"options": f"-csearch_path={schema}"}).render_as_string(hide_password=False)
    else:
        url = "sqlite:///" + (tmp_path / "test.db").as_posix()
    monkeypatch.setenv("IMMO_DATABASE_URL", url)
    monkeypatch.setenv("IMMO_MODE", "demo")
    monkeypatch.setenv("IMMO_STORAGE_DIR", str(tmp_path / "documents"))
    command.upgrade(Config("backend/alembic.ini"), "head")
    settings = Settings()
    initialize(settings, demo=True)
    app = create_app(settings)
    with TestClient(app) as client:
        token = client.post("/api/auth/demo").json()["token"]
        client.headers["Authorization"] = "Bearer " + token
        yield client, app, settings
    if admin:
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


@pytest.fixture
def client(setup):
    return setup[0]
