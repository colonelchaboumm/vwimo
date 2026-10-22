from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone, timedelta
from uuid import uuid4
from sqlalchemy import select
from app.models import Contact, User
from app.radar_schemas import today
from test_finance import new_income, acquire, acquisition


def partner_payload(**changes):
    return {'name':'Courtier fictif de test','kind':'broker','email':'courtier@example.com','agreement':'Conditions déclarées à vérifier',**changes}


def partner(client,**changes):
    result=client.post('/api/partners',json=partner_payload(**changes))
    assert result.status_code==201,result.text
    return result.json()


def referral_payload(client,**changes):
    buyer=next(c for c in client.get('/api/contacts').json() if c['kind']=='buyer')
    return {'reference':'APP-'+uuid4().hex[:8],'title':'Financement de test','kind':'broker','partner_id':partner(client)['id'],'contact_id':buyer['id'],'source':'Origine déclarée de test','project':'Financement achat','introduced_on':today().isoformat(),**changes}


def referral(client,**changes):
    data=referral_payload(client,**changes)
    result=client.post('/api/referrals',json=data)
    assert result.status_code==201,result.text
    return result.json(),data


def test_partner_search_archive_version_and_no_delete(client):
    row=partner(client,name='Partenaire 100% fictif')
    assert client.get('/api/partners',params={'q':'100%'}).json()['total']==1
    payload=partner_payload(name=row['name'],version=row['version'],archived=True)
    response=client.put('/api/partners/'+row['id'],json=payload)
    assert response.status_code==200
    assert client.put('/api/partners/'+row['id'],json=payload).status_code==409
    assert client.get('/api/partners').json()['total']==0
    assert client.get('/api/partners',params={'archived':True}).json()['total']==1
    assert client.delete('/api/partners/'+row['id']).status_code==405
    data=referral_payload(client,partner_id=row['id'])
    assert client.post('/api/referrals',json=data).status_code==422


def test_transmission_requires_permission_and_preserves_snapshot(client):
    row,data=referral(client)
    sent={**data,'version':row['version'],'stage':'introduced','transferred_on':today().isoformat()}
    assert client.put('/api/referrals/'+row['id'],json=sent).status_code==422
    sent.update(permission='granted',permission_on=today().isoformat(),permission_note='Accord client fictif documenté')
    result=client.put('/api/referrals/'+row['id'],json=sent)
    assert result.status_code==200,result.text
    row=result.json()
    snapshot=row['transmission']
    assert snapshot['permission_note']=='Accord client fictif documenté'
    revoked={**sent,'version':row['version'],'permission':'withdrawn','permission_note':'Retrait déclaré par le client'}
    row=client.put('/api/referrals/'+row['id'],json=revoked).json()
    assert row['transmission']==snapshot and row['permission']=='withdrawn'
    detail=client.get('/api/referrals/'+row['id']).json()
    assert len(detail['events'])==3 and detail['events'][0]['changes']['permission']['after']=='withdrawn'
    assert client.put('/api/referrals/'+row['id'],json={**revoked,'version':row['version'],'transferred_on':None,'stage':'draft'}).status_code==409
    assert client.put('/api/referrals/'+row['id'],json={**revoked,'version':row['version'],'contact_id':str(uuid4())}).status_code==404


def test_archived_relations_can_be_followed_but_not_transmitted(setup):
    client,app,_=setup
    row,data=referral(client)
    with app.state.sessions() as db:
        db.get(Contact,row['contact_id']).archived=True
        db.commit()
    assert client.put('/api/referrals/'+row['id'],json={**data,'version':row['version'],'notes':'Suivi historique conservé'}).status_code==200
    row=client.get('/api/referrals/'+row['id']).json()
    sent={**data,'version':row['version'],'stage':'introduced','transferred_on':today().isoformat(),'permission':'granted','permission_on':today().isoformat(),'permission_note':'Accord de test explicite'}
    assert client.put('/api/referrals/'+row['id'],json=sent).status_code==422


def test_broker_type_dates_closure_and_version_validation(client):
    data=referral_payload(client)
    assert client.post('/api/referrals',json={**data,'introduced_on':(today()+timedelta(days=1)).isoformat()}).status_code==422
    assert client.post('/api/referrals',json={**data,'kind':'service','financing':'approved'}).status_code==422
    assert client.post('/api/referrals',json={**data,'stage':'cancelled'}).status_code==422
    other=partner(client,kind='moving')
    assert client.post('/api/referrals',json={**data,'partner_id':other['id']}).status_code==422
    row=client.post('/api/referrals',json=data).json()
    changed={**data,'version':row['version'],'outcome':'Clôture fictive documentée','stage':'cancelled'}
    assert client.put('/api/referrals/'+row['id'],json=changed).status_code==200
    assert client.put('/api/referrals/'+row['id'],json=changed).status_code==409
    assert client.post('/api/referrals',json=data).status_code==409


def test_linked_income_receipts_and_context_change_require_new_quote(client):
    row,data=referral(client)
    income=new_income(client,referral_id=row['id'],contact_id=row['contact_id'],category='broker',fixed_amount='100.01')
    old_quote=acquisition(client,income)
    changed=client.put('/api/referrals/'+row['id'],json={**data,'version':row['version'],'notes':'Précision explicite nouvelle'})
    assert changed.status_code==200
    assert client.post('/api/finance/incomes/'+income['id']+'/acquire',json=old_quote).status_code==409
    income=acquire(client,income)
    receipt={'version':income['version'],'request_id':str(uuid4()),'amount':'20.01','paid_on':today().isoformat(),'reference':'Virement fictif lié'}
    assert client.post('/api/finance/incomes/'+income['id']+'/payments',json=receipt).status_code==200
    detail=client.get('/api/referrals/'+row['id']).json()
    assert len(detail['incomes'])==1 and detail['incomes'][0]['paid']=='20.01'
    assert detail['incomes'][0]['amount']=='100.01'
    summary=client.get('/api/pilotage',params={'year':today().year}).json()
    assert summary['financial']['contract']['categories']['broker']['acquired']=='100.01'
    assert summary['financial']['contract']['categories']['broker']['received']=='20.01'
    assert client.put('/api/referrals/'+row['id'],json={**data,'version':detail['version'],'source':'Autre origine'}).status_code==409
    # Une rémunération déjà validée fige le contexte, mais n'empêche pas de documenter la première transmission.
    sent=client.put('/api/referrals/'+row['id'],json={**data,'version':detail['version'],'stage':'introduced','transferred_on':today().isoformat(),'permission':'granted','permission_on':today().isoformat(),'permission_note':'Accord fictif pour première mise en relation'})
    assert sent.status_code==200,sent.text
    assert client.get('/api/finance/incomes/'+income['id']).json()['amount']=='100.01'
    other=next(c for c in client.get('/api/contacts').json() if c['id']!=row['contact_id'])
    response=client.post('/api/finance/incomes',json={'reference':'REV-INCOMPATIBLE','title':'Revenu incompatible','category':'broker','partner':'Test','referral_id':row['id'],'contact_id':other['id'],'fixed_amount':'10','expected_on':today().isoformat()})
    assert response.status_code==422


def test_referral_simultaneous_updates_preserve_history(client):
    row,data=referral(client)
    requests=[{**data,'version':row['version'],'notes':'Modification '+str(i)} for i in range(2)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses=list(pool.map(lambda payload:client.put('/api/referrals/'+row['id'],json=payload).status_code,requests))
    assert sorted(statuses)==[200,409]
    assert len(client.get('/api/referrals/'+row['id']).json()['events'])==2


def test_reader_can_view_but_cannot_write_partners(setup):
    client,app,_=setup
    row,data=referral(client)
    with app.state.sessions() as db:
        db.scalar(select(User).limit(1)).role='reader'
        db.commit()
    for url in ('/api/partners','/api/referrals','/api/referrals/'+row['id'],'/api/pilotage'):
        assert client.get(url).status_code==200
    assert client.post('/api/partners',json=partner_payload()).status_code==403
    assert client.put('/api/referrals/'+row['id'],json={**data,'version':row['version']}).status_code==403


def test_pilotage_separates_years_bases_and_receipts(client):
    previous=date(today().year-1,12,31).isoformat()
    income=acquire(client,new_income(client,fixed_amount='100.01',amount_basis='ht',category='broker'),day=previous)
    receipt={'version':income['version'],'request_id':str(uuid4()),'amount':'20.01','paid_on':today().isoformat(),'reference':'Versement année différente'}
    assert client.post('/api/finance/incomes/'+income['id']+'/payments',json=receipt).status_code==200
    new_income(client,fixed_amount='120.02',amount_basis='ttc',category='moving')
    summary=client.get('/api/pilotage',params={'year':today().year}).json()
    ht=summary['financial']['ht']
    ttc=summary['financial']['ttc']
    assert ht['months'][today().month-1]['received']=='20.01'
    assert ht['categories']['broker']['acquired']=='0.00'
    assert ttc['months'][today().month-1]['forecast']=='120.02'
    previous_summary=client.get('/api/pilotage',params={'year':today().year-1}).json()
    assert previous_summary['financial']['ht']['months'][11]['acquired']=='100.01'
    assert client.get('/api/pilotage',params={'year':9999}).status_code==422


def test_annual_dates_use_paris_and_sales_use_deed_dates(setup):
    from app.models import CalendarEvent
    from test_application import mandate_payload
    client,app,_=setup
    mandate=client.post('/api/mandates',json=mandate_payload(client)).json()
    deed=date(today().year,1,10)
    if deed>today(): deed=date(today().year-1,1,10)
    row=client.post('/api/transactions',json={'reference':'STAT-VENTE','mandate_id':mandate['id'],'stage':'signed','sale_price':'350000.10','compromise_on':(deed-timedelta(days=30)).isoformat(),'deed_on':deed.isoformat()})
    assert row.status_code==201,row.text
    # 31 décembre UTC, mais déjà le 1er janvier à Paris.
    boundary=datetime(deed.year-1,12,31,23,30,tzinfo=timezone.utc)
    with app.state.sessions() as db:
        db.add(CalendarEvent(title='Visite année de Paris',kind='visit',starts_at=boundary,ends_at=boundary+timedelta(hours=1)))
        db.commit()
    data=client.get('/api/pilotage',params={'year':deed.year}).json()
    assert data['annual']['signed_count']==1 and data['annual']['sale_volume']=='350000.10'
    assert data['annual']['compromise_to_deed_days']=='30.00' and data['annual']['delay_samples']==1
    assert data['annual']['calendar_entries']['visit']==1
    other=client.get('/api/pilotage',params={'year':deed.year-1}).json()
    assert other['annual']['signed_count']==0 and other['annual']['delay_samples']==0
    assert other['annual']['compromise_to_deed_days'] is None and other['annual']['calendar_entries'].get('visit',0)==0
