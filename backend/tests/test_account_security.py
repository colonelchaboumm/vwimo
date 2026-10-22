import hashlib
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier, Event

import pytest
from argon2 import PasswordHasher
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.models import AuditLog, SessionToken, User, now

OLD = ' Ancien secret personnel 2026! '
NEW = ' Nouveau secret personnel 2026! '
BODY = {'current_password': OLD, 'new_password': NEW, 'password_confirmation': NEW, 'confirmed': True}


@pytest.fixture
def account(setup):
    client, app, settings = setup
    # Même route sur SQLite/PostgreSQL ; le transport/mode local est vérifié séparément.
    settings.mode = 'real'
    with app.state.sessions() as db:
        row = db.scalar(select(User))
        row.password_hash = PasswordHasher().hash(OLD)
        identifier, email = row.id, row.email
        db.commit()
    return client, app, identifier, email


def login(client, email, password=OLD):
    return client.post('/api/auth/login', json={'email': email, 'password': password})


def test_password_change_revokes_all_sessions_and_preserves_data(account):
    client, app, identifier, email = account
    original_token = client.headers['Authorization']
    second = login(client, email).json()['token']
    contact = client.post('/api/contacts', json={'name': 'Dossier conservé', 'kind': 'buyer'}).json()
    sessions = client.get('/api/auth/sessions').json()
    assert sessions['total'] == 2 and sum(row['current'] for row in sessions['items']) == 1
    assert set(sessions['items'][0]) == {'created_at', 'expires_at', 'current'}
    assert sessions['items'][0]['created_at'].endswith('Z') or sessions['items'][0]['created_at'].endswith('+00:00')
    assert client.post('/api/auth/change-password', json=BODY).status_code == 204
    assert client.get('/api/auth/me').status_code == 401
    assert client.get('/api/auth/me', headers={'Authorization': 'Bearer '+second}).status_code == 401
    assert login(client, email).status_code == 401
    assert login(client, email, NEW.strip()).status_code == 401
    fresh = login(client, email, NEW)
    assert fresh.status_code == 200
    client.headers['Authorization'] = 'Bearer '+fresh.json()['token']
    assert contact['id'] in [row['id'] for row in client.get('/api/contacts').json()]
    with app.state.sessions() as db:
        row = db.get(User, identifier)
        assert row.auth_version == 2 and PasswordHasher().verify(row.password_hash, NEW)
        logs = str([row.details for row in db.scalars(select(AuditLog))])
        assert OLD not in logs and NEW not in logs and original_token not in logs
        assert db.scalar(select(AuditLog).where(AuditLog.action == 'auth.password_changed'))


@pytest.mark.parametrize('changes', [
    {'password_confirmation': 'Confirmation différente'}, {'new_password': 'court'},
    {'new_password': ' '*12, 'password_confirmation': ' '*12},
    {'new_password': OLD, 'password_confirmation': OLD}, {'confirmed': False},
    {'role': 'admin'},
])
def test_invalid_password_change_has_no_effect(account, changes):
    client, _, _, email = account
    assert client.post('/api/auth/change-password', json={**BODY, **changes}).status_code == 422
    assert client.get('/api/auth/me').status_code == 200
    assert login(client, email).status_code == 200


def test_wrong_confirmation_password_is_limited_without_logging_out(account):
    client, _, _, _ = account
    for _ in range(10):
        assert client.post('/api/auth/revoke-sessions', json={'current_password': OLD.strip(), 'confirmed': True}).status_code == 403
    assert client.post('/api/auth/change-password', json=BODY).status_code == 429
    assert client.get('/api/auth/me').status_code == 200


def test_revoke_all_keeps_password_and_other_accounts(account):
    client, app, identifier, email = account
    with app.state.sessions() as db:
        other = User(email='other-security@example.com', name='Autre compte', role='reader', password_hash=PasswordHasher().hash(OLD))
        db.add(other)
        db.flush()
        token = 'other-account-token'
        db.add(SessionToken(user_id=other.id, token_hash=hashlib.sha256(token.encode()).hexdigest(), expires_at=now()+timedelta(hours=1)))
        db.get(User, identifier).role = 'reader'
        db.commit()
    assert client.post('/api/auth/revoke-sessions', json={'current_password': OLD, 'confirmed': True}).status_code == 204
    assert client.get('/api/auth/me').status_code == 401
    assert client.get('/api/auth/me', headers={'Authorization': 'Bearer '+token}).status_code == 200
    assert login(client, email).status_code == 200


def test_old_generation_token_cannot_be_used_even_if_present(account):
    client, app, identifier, _ = account
    with app.state.sessions() as db:
        row = db.get(User, identifier)
        row.auth_version += 1
        db.commit()
    assert client.get('/api/auth/me').status_code == 401


def test_login_started_before_password_change_is_invalid_afterwards(account):
    client, app, identifier, email = account
    reached, release = Event(), Event()
    def pause_issue(state):
        if state.is_delete and 'sessions.expires_at' in str(state.statement):
            reached.set()
            assert release.wait(15)
    event.listen(Session, 'do_orm_execute', pause_issue)
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(login, client, email)
            assert reached.wait(10)
            response = client.post('/api/auth/change-password', json=BODY)
            release.set()
            assert response.status_code == 204, response.text
            stale = pending.result(timeout=15)
            assert stale.status_code == 200, stale.text
        assert client.get('/api/auth/me', headers={'Authorization': 'Bearer '+stale.json()['token']}).status_code == 401
    finally:
        release.set()
        event.remove(Session, 'do_orm_execute', pause_issue)


def test_sessions_exclude_expired_foreign_and_old_generation(account):
    client, app, identifier, _ = account
    with app.state.sessions() as db:
        db.add(SessionToken(user_id=identifier, token_hash='e'*64, expires_at=now()-timedelta(seconds=1)))
        db.add(SessionToken(user_id=identifier, token_hash='f'*64, expires_at=now()+timedelta(hours=1), auth_version=0))
        db.commit()
    assert client.get('/api/auth/sessions').json()['total'] == 1


def test_demo_does_not_allow_password_changes(client):
    assert client.post('/api/auth/change-password', json=BODY).status_code == 403
    assert client.post('/api/auth/revoke-sessions', json={'current_password': OLD, 'confirmed': True}).status_code == 403
    assert client.get('/api/auth/me').status_code == 200
    assert client.get('/api/auth/sessions', headers={'Authorization': ''}).status_code == 401


def test_upgrade_keeps_existing_account_and_sessions(setup):
    from alembic import command
    from alembic.config import Config
    client, app, _ = setup
    with app.state.sessions() as db:
        original_hash = db.scalar(select(User.password_hash))
    config = Config('backend/alembic.ini')
    command.downgrade(config, '20261022_marketing')
    command.upgrade(config, 'head')
    assert client.get('/api/auth/me').status_code == 200
    assert client.get('/api/auth/sessions').json()['total'] == 1
    with app.state.sessions() as db:
        assert db.scalar(select(User.password_hash)) == original_hash


def test_session_list_is_bounded(account):
    client, app, identifier, _ = account
    with app.state.sessions() as db:
        for index in range(55):
            db.add(SessionToken(user_id=identifier, token_hash=hashlib.sha256(str(index).encode()).hexdigest(), expires_at=now()+timedelta(hours=1)))
        db.commit()
    result = client.get('/api/auth/sessions').json()
    assert result['total'] == 56 and result['limit'] == 50 and len(result['items']) == 50


def test_concurrent_security_mutations_have_one_winner(account):
    client, app, identifier, _ = account
    barrier = Barrier(2, timeout=15)
    def synchronize(state):
        if state.is_update and state.statement.table.name == 'users':
            barrier.wait()
    event.listen(Session, 'do_orm_execute', synchronize)
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            changed = pool.submit(client.post, '/api/auth/change-password', json=BODY)
            revoked = pool.submit(client.post, '/api/auth/revoke-sessions', json={'current_password': OLD, 'confirmed': True})
            assert sorted([changed.result().status_code, revoked.result().status_code]) == [204, 409]
    finally:
        event.remove(Session, 'do_orm_execute', synchronize)
    with app.state.sessions() as db:
        assert db.get(User, identifier).auth_version == 2
        assert len(list(db.scalars(select(AuditLog).where(AuditLog.action.in_(['auth.password_changed', 'auth.sessions_revoked']))))) == 1
