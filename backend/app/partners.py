"""Dossiers déclaratifs. Aucun transfert de données ni sollicitation externe."""
from fastapi import Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from .commission_math import cents
from .models import Partner, Referral, ReferralEvent, Contact, SaleTransaction, Income, IncomePayment, User, now
from .partner_schemas import PartnerInput, ReferralInput
from .radar_schemas import today


def register_partners(api, *, database, user, writer, audit, find, save, check_version, record):
    def flush(db):
        try: db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, 'Référence déjà utilisée ou lien incompatible. Actualisez avant de réessayer.')

    @api.get('/api/partners')
    def partners(q: str = Query(default='', max_length=180), archived: bool = False,
                 offset: int = Query(default=0, ge=0, le=100000), limit: int = Query(default=40, ge=1, le=100), account=Depends(user), db=Depends(database)):
        terms = [Partner.archived == archived]
        if q.strip():
            terms.append(or_(Partner.name.icontains(q.strip(), autoescape=True), Partner.city.icontains(q.strip(), autoescape=True), Partner.representative.icontains(q.strip(), autoescape=True)))
        rows = db.scalars(select(Partner).where(*terms).order_by(Partner.name, Partner.id).offset(offset).limit(limit))
        return {'items':[record(row) for row in rows], 'total': db.scalar(select(func.count()).select_from(Partner).where(*terms))}

    @api.post('/api/partners', status_code=201)
    def create_partner(data: PartnerInput, account=Depends(writer), db=Depends(database)):
        row = Partner(**data.model_dump(exclude={'version'}))
        db.add(row)
        flush(db)
        audit(db, account, 'partner.create', row.id)
        save(db)
        return record(row)

    @api.put('/api/partners/{identifier}')
    def update_partner(identifier: str, data: PartnerInput, account=Depends(writer), db=Depends(database)):
        row = find(db, Partner, identifier)
        check_version(row, data.version)
        for key, value in data.model_dump(exclude={'version'}).items(): setattr(row,key,value)
        row.version += 1
        audit(db,account,'partner.update',row.id,{'archived':row.archived})
        save(db)
        return record(row)

    def referral_data(row, partner, contact):
        return {**record(row), 'partner_name':partner.name, 'partner_archived':partner.archived, 'contact_name':contact.name,
                'overdue': bool(row.next_action_on and row.next_action_on < today() and row.stage not in ('completed','unsuccessful','cancelled') and row.permission not in ('refused','withdrawn'))}

    def referral_query():
        return select(Referral,Partner,Contact).join(Partner,Referral.partner_id==Partner.id).join(Contact,Referral.contact_id==Contact.id)

    @api.get('/api/referrals')
    def referrals(q: str = Query(default='', max_length=180), stage: str = Query(default='', max_length=30), partner_id: str = Query(default='', max_length=36),
                  offset: int = Query(default=0, ge=0, le=100000), limit: int = Query(default=40, ge=1, le=100), account=Depends(user), db=Depends(database)):
        terms = []
        if stage: terms.append(Referral.stage==stage)
        if partner_id: terms.append(Referral.partner_id==partner_id)
        if q.strip():
            terms.append(or_(Referral.reference.icontains(q.strip(),autoescape=True), Referral.title.icontains(q.strip(),autoescape=True), Partner.name.icontains(q.strip(),autoescape=True), Contact.name.icontains(q.strip(),autoescape=True)))
        query = referral_query().where(*terms)
        total = db.scalar(select(func.count()).select_from(query.subquery()))
        rows = db.execute(query.order_by(Referral.created_at.desc(),Referral.id).offset(offset).limit(limit))
        return {'items':[referral_data(*row) for row in rows], 'total':total}

    def apply_referral(db, row, data, account, creating=False):
        values = data.model_dump(exclude={'version'})
        old = {key:getattr(row,key) for key in values} if not creating else {}
        partner = find(db,Partner,data.partner_id)
        contact = find(db,Contact,data.contact_id)
        new_transmission = bool(data.transferred_on and not row.transferred_on)
        if (creating or partner.id != row.partner_id or new_transmission) and partner.archived:
            raise HTTPException(422,'Choisissez un partenaire actif avant de créer un dossier ou déclarer une mise en relation.')
        if (creating or contact.id != row.contact_id or new_transmission) and contact.archived:
            raise HTTPException(422,'Choisissez un contact actif avant de créer un dossier ou déclarer une mise en relation.')
        check_types = creating or new_transmission or data.kind != row.kind or data.partner_id != row.partner_id or data.contact_id != row.contact_id
        if check_types and data.kind == 'broker' and contact.kind not in ('buyer','both'):
            raise HTTPException(422,'Un dossier de courtage nécessite un acquéreur.')
        if check_types and data.kind == 'broker' and partner.kind != 'broker':
            raise HTTPException(422,'Choisissez un partenaire de type Courtier pour un dossier de courtage.')
        if data.transaction_id: find(db,SaleTransaction,data.transaction_id)
        if not creating and (row.transferred_on or db.scalar(select(Income.id).where(Income.referral_id==row.id,Income.status=='acquired').limit(1))):
            fixed_fields = ('kind','partner_id','contact_id','transaction_id','introduced_on','source')
            if row.transferred_on: fixed_fields += ('transferred_on',)
            if any(old[key] != values[key] for key in fixed_fields):
                raise HTTPException(409,'Les liens, l’origine et les dates du dossier sont conservés après une mise en relation ou un revenu validé. Créez un nouveau dossier si nécessaire.')
        if new_transmission:
            if data.permission != 'granted' or not data.permission_on or data.permission_on > data.transferred_on:
                raise HTTPException(422,'Une mise en relation exige une autorisation client déclarée, datée au plus tard le jour de la transmission.')
            row.transmission = {'declared_at':now().isoformat(), 'transferred_on':str(data.transferred_on), 'permission_on':str(data.permission_on),
                'permission_note':data.permission_note, 'partner_id':partner.id, 'partner_name':partner.name, 'contact_id':contact.id,'contact_name':contact.name}
        if creating or new_transmission:
            # Verrou optimiste partagé avec l'archivage : ces références fortes restent en session jusqu'au flush.
            partner.version += 1
            contact.version += 1
        for key,value in values.items(): setattr(row,key,value)
        if not creating: row.version += 1
        db.add(row)
        flush(db)
        changes = {'created':creating, 'fields':[key for key,value in values.items() if old.get(key)!=value],
                   'stage':{'before':old.get('stage'), 'after':row.stage}, 'permission':{'before':old.get('permission'), 'after':row.permission}}
        db.add(ReferralEvent(referral_id=row.id,actor_id=account.id,changes=changes))
        audit(db,account,'referral.create' if creating else 'referral.update',row.id,changes)
        save(db)
        return referral_data(row,partner,contact)

    @api.post('/api/referrals', status_code=201)
    def create_referral(data: ReferralInput, account=Depends(writer), db=Depends(database)):
        return apply_referral(db,Referral(),data,account,creating=True)

    @api.put('/api/referrals/{identifier}')
    def update_referral(identifier: str, data: ReferralInput, account=Depends(writer), db=Depends(database)):
        row = find(db,Referral,identifier)
        check_version(row,data.version)
        return apply_referral(db,row,data,account)

    @api.get('/api/referrals/{identifier}')
    def detail(identifier: str, account=Depends(user), db=Depends(database)):
        row = find(db,Referral,identifier)
        result = referral_data(row,find(db,Partner,row.partner_id),find(db,Contact,row.contact_id))
        events = db.execute(select(ReferralEvent,User.name).join(User,ReferralEvent.actor_id==User.id).where(ReferralEvent.referral_id==row.id).order_by(ReferralEvent.created_at.desc(),ReferralEvent.id).limit(201)).all()
        result['events'] = [{**record(event),'actor_name':name} for event,name in events[:200]]
        result['events_limited'] = len(events)>200
        paid = select(func.coalesce(func.sum(IncomePayment.amount),0)).where(IncomePayment.income_id==Income.id).correlate(Income).scalar_subquery()
        incomes = db.execute(select(Income,paid).where(Income.referral_id==row.id).order_by(Income.created_at,Income.id).limit(201)).all()
        result['incomes'] = [{**record(income),'paid':str(cents(amount))} for income,amount in incomes[:200]]
        result['incomes_limited'] = len(incomes)>200
        return result
