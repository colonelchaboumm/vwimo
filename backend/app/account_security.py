"""Gestion personnelle des identifiants, sans service de récupération externe."""
import hashlib
import threading
import time
from collections import defaultdict, deque
from datetime import timezone
from typing import Literal

from argon2.exceptions import VerificationError
from fastapi import Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import delete, func, select, update

from .models import SessionToken, User, now


class RevokeInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=False, extra='forbid')
    current_password: str = Field(min_length=1, max_length=256)
    confirmed: Literal[True]


class PasswordInput(RevokeInput):
    new_password: str = Field(min_length=12, max_length=256)
    password_confirmation: str = Field(min_length=12, max_length=256)

    @model_validator(mode='after')
    def matching(self):
        if not self.new_password.strip():
            raise ValueError('Le nouveau mot de passe ne peut pas contenir uniquement des espaces.')
        if self.new_password != self.password_confirmation:
            raise ValueError('Les deux nouveaux mots de passe ne correspondent pas.')
        if self.new_password == self.current_password:
            raise ValueError('Choisissez un mot de passe différent du mot de passe actuel.')
        return self


def register(api, settings, database, user, audit, hasher, bearer):
    attempts = defaultdict(deque)
    lock = threading.Lock()

    def verify(account, password):
        if settings.mode == 'demo':
            raise HTTPException(403, 'La gestion des identifiants est indisponible en démonstration.')
        with lock:
            cutoff = time.monotonic() - 300
            for key in list(attempts):
                while attempts[key] and attempts[key][0] < cutoff:
                    attempts[key].popleft()
                if not attempts[key]:
                    del attempts[key]
            if len(attempts[account.id]) >= 10:
                raise HTTPException(429, 'Trop de tentatives. Réessayez dans cinq minutes.')
            attempts[account.id].append(time.monotonic())
        try:
            hasher.verify(account.password_hash, password)
        except VerificationError:
            # Un mauvais secret de confirmation ne doit pas fermer une session valide.
            raise HTTPException(403, 'Le mot de passe actuel est incorrect.')

    def invalidate(db, account, action, password_hash=None):
        values = {'auth_version': account.auth_version + 1}
        if password_hash is not None:
            values['password_hash'] = password_hash
        result = db.execute(update(User).where(User.id == account.id, User.auth_version == account.auth_version)
                            .values(**values).execution_options(synchronize_session=False))
        if result.rowcount != 1:
            db.rollback()
            raise HTTPException(409, 'Les identifiants ont changé ailleurs. Reconnectez-vous.')
        db.execute(delete(SessionToken).where(SessionToken.user_id == account.id))
        audit(db, account, action, account.id)
        db.commit()

    @api.get('/api/auth/sessions')
    def sessions(credentials=Depends(bearer), account=Depends(user), db=Depends(database)):
        current_hash = hashlib.sha256(credentials.credentials.encode()).hexdigest()
        query = select(SessionToken).where(SessionToken.user_id == account.id,
                    SessionToken.auth_version == account.auth_version, SessionToken.expires_at > now())
        total = db.scalar(select(func.count()).select_from(query.subquery()))
        rows = db.scalars(query.order_by(SessionToken.created_at.desc(), SessionToken.id).limit(50))
        def utc(value):
            return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
        return {'total': total, 'limit': 50, 'items': [
            {'created_at': utc(row.created_at), 'expires_at': utc(row.expires_at), 'current': row.token_hash == current_hash}
            for row in rows]}

    @api.post('/api/auth/change-password', status_code=204)
    def change_password(data: PasswordInput, account=Depends(user), db=Depends(database)):
        verify(account, data.current_password)
        invalidate(db, account, 'auth.password_changed', hasher.hash(data.new_password))

    @api.post('/api/auth/revoke-sessions', status_code=204)
    def revoke_sessions(data: RevokeInput, account=Depends(user), db=Depends(database)):
        verify(account, data.current_password)
        invalidate(db, account, 'auth.sessions_revoked')
