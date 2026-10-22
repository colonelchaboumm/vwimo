from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from email import policy
from email.parser import BytesParser
from uuid import uuid4
from sqlalchemy import select
from app.models import Contact, User
from app.radar_schemas import today

def customer(client,name='Client newsletter',email='newsletter@example.com',kind='buyer'):
    response=client.post('/api/contacts',json={'name':name,'email':email,'kind':kind})
    assert response.status_code==201,response.text
    return response.json()

def consent(client,contact,state='declared',**changes):
    current=client.get('/api/marketing/permissions/'+contact['id']).json()
    return client.put('/api/marketing/permissions/'+contact['id'],json={'version':current['version'],'state':state,'declared_on':today().isoformat(),'note':'Préférence newsletter fictive documentée',**changes})

def draft(client,**changes):
    data={'reference':'NL-'+uuid4().hex[:8],'title':'Lettre de test','segment':'all','subject':'Bonjour {nom}','body':'Actualité fictive pour {nom}.','sender_name':'Agence fictive','sender_email':'agence@example.com','footer':'Identité fictive. Pour vous désinscrire, répondez à ce message.',**changes}
    response=client.post('/api/marketing/campaigns',json=data)
    assert response.status_code==201,response.text
    return response.json(),data

def preview(client,campaign):
    response=client.get('/api/marketing/campaigns/'+campaign['id']+'/preview')
    assert response.status_code==200,response.text
    return response.json()

def export(client,campaign,contact,value=None,**changes):
    value=value or preview(client,campaign)
    return client.post('/api/marketing/campaigns/'+campaign['id']+'/download',json={'contact_id':contact['id'],'request_id':str(uuid4()),'digest':value['digest'],'confirmed':True,**changes})

def test_no_assumed_permission_and_independent_newsletter_consent(client):
    c=customer(client)
    campaign,_=draft(client)
    view=preview(client,campaign)
    assert not view['eligible'] and not view['delivery_available']
    assert next(r for r in view['excluded'] if r['id']==c['id'])['reason']=='Autorisation newsletter non déclarée'
    assert consent(client,c).status_code==200
    assert len(preview(client,campaign)['eligible'])==1
    assert consent(client,c,declared_on=(today()+timedelta(days=1)).isoformat()).status_code==422

def test_plain_eml_is_personalized_single_recipient_and_idempotent(client):
    c=customer(client,name='Émilie Client')
    consent(client,c)
    campaign,_=draft(client,body='<script>texte seulement</script> Bonjour {nom}')
    view=preview(client,campaign)
    identifier=str(uuid4())
    result=export(client,campaign,c,view,request_id=identifier)
    assert result.status_code==200,result.text
    msg=BytesParser(policy=policy.default).parsebytes(result.content)
    assert str(msg['To'])=='Émilie Client <newsletter@example.com>'
    assert len(msg['To'].addresses)==1 and msg['Bcc'] is None and msg['Cc'] is None
    assert str(msg['Subject'])=='Bonjour Émilie Client' and msg['X-Unsent']=='1'
    assert '<script>texte seulement</script>' in msg.get_content()
    assert msg.get_content_type()=='text/plain' and msg['List-Unsubscribe']=='<mailto:agence@example.com>'
    again=export(client,campaign,c,view,request_id=identifier)
    assert again.status_code==200 and again.content==result.content
    assert len(preview(client,campaign)['exports'])==1
    assert consent(client,c,'withdrawn').status_code==200
    assert export(client,campaign,c,view,request_id=identifier).status_code==409

def test_shared_email_refusal_blocks_duplicates_and_regrant_does_not_clear_exclusion(client):
    a=customer(client,name='Premier contact')
    b=customer(client,name='Deuxième contact',email='NEWSLETTER@example.com')
    consent(client,a); consent(client,b)
    campaign,_=draft(client)
    view=preview(client,campaign)
    assert len(view['eligible'])==1
    assert any('déjà retenue' in row['reason'] for row in view['excluded'])
    consent(client,b,'refused')
    assert not preview(client,campaign)['eligible']
    consent(client,b)
    assert not preview(client,campaign)['eligible']

def test_email_change_requires_new_permission_and_exclusion_survives_archive(setup):
    client,app,_=setup
    c=customer(client)
    consent(client,c)
    campaign,_=draft(client)
    old=preview(client,campaign)
    with app.state.sessions() as db:
        db.get(Contact,c['id']).email='changed@example.com'
        db.commit()
    assert export(client,campaign,c,old).status_code==409
    view=preview(client,campaign)
    assert not view['eligible'] and any('Adresse modifiée' in r['reason'] for r in view['excluded'])
    consent(client,c,'withdrawn')
    assert client.get('/api/marketing/exclusions').json()['total']==2
    with app.state.sessions() as db:
        db.get(Contact,c['id']).archived=True
        db.commit()
    other=customer(client,email='newsletter@example.com')
    consent(client,other)
    assert not preview(client,campaign)['eligible']

def test_campaign_versions_archive_and_headers(client):
    campaign,data=draft(client)
    changed={**data,'version':campaign['version'],'subject':'Objet révisé'}
    assert client.put('/api/marketing/campaigns/'+campaign['id'],json=changed).status_code==200
    assert client.put('/api/marketing/campaigns/'+campaign['id'],json=changed).status_code==409
    assert client.post('/api/marketing/campaigns',json=data).status_code==409
    assert client.post('/api/marketing/campaigns',json={**data,'reference':'HEADER','subject':'Objet\r\nBcc: other@example.com'}).status_code==422
    c=customer(client);consent(client,c)
    campaign,_=draft(client,archived=True)
    assert export(client,campaign,c).status_code==422
    incomplete,_=draft(client,body='',sender_email=None)
    assert preview(client,incomplete)['missing']
    assert export(client,incomplete,c).status_code==422

def test_exclusion_unblock_requires_admin_confirmation_and_permission_remains_independent(setup):
    client,app,_=setup
    c=customer(client);consent(client,c)
    payload={'email':'NEWSLETTER@example.com','note':'Exclusion fictive documentée','declared_on':today().isoformat()}
    result=client.post('/api/marketing/exclusions',json=payload)
    assert result.status_code==201,result.text
    row=result.json()
    assert row['email']=='newsletter@example.com'
    assert client.post('/api/marketing/exclusions',json=payload).status_code==409
    change={**payload,'version':row['version'],'blocked':False}
    assert client.put('/api/marketing/exclusions/'+row['id'],json=change).status_code==422
    with app.state.sessions() as db:
        db.scalar(select(User).limit(1)).role='advisor';db.commit()
    assert client.put('/api/marketing/exclusions/'+row['id'],json={**change,'confirm_unblock':True}).status_code==403
    with app.state.sessions() as db:
        db.scalar(select(User).limit(1)).role='admin';db.commit()
    assert client.put('/api/marketing/exclusions/'+row['id'],json={**change,'confirm_unblock':True}).status_code==200
    campaign,_=draft(client)
    assert len(preview(client,campaign)['eligible'])==1

def test_reader_cannot_prepare_or_change_marketing(setup):
    client,app,_=setup
    c=customer(client);consent(client,c);campaign,_=draft(client)
    with app.state.sessions() as db:
        db.scalar(select(User).limit(1)).role='reader';db.commit()
    assert client.get('/api/marketing/campaigns').status_code==200
    assert preview(client,campaign)['eligible']
    assert export(client,campaign,c).status_code==403
    assert consent(client,c,'withdrawn').status_code==403

def test_stale_permission_preview_cannot_be_exported(client):
    c=customer(client);consent(client,c);campaign,_=draft(client)
    value=preview(client,campaign)
    # Une modification après l'aperçu doit rendre sa confirmation inutilisable.
    consent(client,c,'withdrawn')
    response=export(client,campaign,c,value)
    assert response.status_code==409
    assert not preview(client,campaign)['exports']

def test_concurrent_export_and_withdrawal_cannot_both_commit(client):
    from threading import Barrier
    from sqlalchemy import event
    from sqlalchemy.orm import Session
    from app.models import MarketingGuard
    c=customer(client);consent(client,c);campaign,_=draft(client)
    value=preview(client,campaign)
    barrier=Barrier(2,timeout=15)
    def before_flush(session,*_):
        if not session.info.get('marketing_sync') and any(isinstance(row,MarketingGuard) for row in session.dirty):
            session.info['marketing_sync']=True
            barrier.wait()
    event.listen(Session,'before_flush',before_flush)
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            prepared=pool.submit(export,client,campaign,c,value)
            withdrawn=pool.submit(consent,client,c,'withdrawn')
            statuses=[prepared.result().status_code,withdrawn.result().status_code]
        assert sorted(statuses)==[200,409]
    finally: event.remove(Session,'before_flush',before_flush)

def test_unicode_local_part_is_not_rewritten_to_another_recipient(client):
    c=customer(client,email='straße@example.com')
    assert consent(client,c).status_code==200
    campaign,_=draft(client)
    value=preview(client,campaign)
    assert not value['eligible']
    row=next(row for row in value['excluded'] if row['id']==c['id'])
    assert row['email']=='straße@example.com' and 'non prise en charge' in row['reason']
    assert export(client,campaign,c,value).status_code==422
    mixed=customer(client,name='Casse préservée',email='MixedCase@example.com')
    consent(client,mixed)
    result=export(client,campaign,mixed)
    assert result.status_code==200,result.text
    message=BytesParser(policy=policy.default).parsebytes(result.content)
    assert message['To'].addresses[0].addr_spec=='MixedCase@example.com'
