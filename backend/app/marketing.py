"""Préparation locale de messages. Aucun transport SMTP, Graph ou service d'envoi."""
import hashlib
import json
from email.message import EmailMessage
from email.headerregistry import Address
from email.policy import SMTP
from email.utils import format_datetime
from fastapi import Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from email_validator import validate_email, EmailNotValidError
from .models import Campaign, CampaignExport, Contact, EmailExclusion, MarketingGuard, MarketingPermission, now
from .marketing_schemas import CampaignInput, ExclusionInput, ExportInput, PermissionInput
from .radar_schemas import today

def canonical(email):
    if not email: return None
    value=str(email).strip()
    try:
        address=validate_email(value,check_deliverability=False,allow_smtputf8=True)
        return (address.ascii_email or address.normalized).lower()
    except EmailNotValidError: return value.lower()

def ascii_email(email):
    try: return validate_email(email,check_deliverability=False,allow_smtputf8=False).ascii_email
    except EmailNotValidError: return None

def display_name(name):
    return ' '.join(''.join(c if ord(c)>=32 and ord(c)!=127 else ' ' for c in name).split())

def register_marketing(api, *, database, user, writer, audit, find, save, check_version, record):
    def flush(db):
        try: db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409,'Référence ou adresse déjà enregistrée. Actualisez avant de réessayer.')
    def gate(db):
        return find(db,MarketingGuard,1)

    @api.get('/api/marketing/permissions/{identifier}')
    def permission(identifier: str, account=Depends(user), db=Depends(database)):
        contact=find(db,Contact,identifier)
        row=db.get(MarketingPermission,identifier)
        return {**(record(row) if row else {'contact_id':identifier,'state':'unknown','version':0,'declared_on':None,'note':'','email_snapshot':None}), 'current_email':contact.email}

    @api.put('/api/marketing/permissions/{identifier}')
    def set_permission(identifier: str, data: PermissionInput, account=Depends(writer), db=Depends(database)):
        lock=gate(db)
        contact=find(db,Contact,identifier)
        row=db.get(MarketingPermission,identifier)
        if row: check_version(row,data.version)
        elif data.version!=0: raise HTTPException(409,'La préférence a changé. Actualisez-la.')
        if data.state=='declared' and (contact.archived or not contact.email): raise HTTPException(422,'Une autorisation newsletter exige un contact actif avec une adresse e-mail.')
        previous_email=row.email_snapshot if row else None
        if not row: row=MarketingPermission(contact_id=identifier)
        if data.state in ('refused','withdrawn'):
            for email in {canonical(contact.email),previous_email}-{None}:
                with db.no_autoflush:
                    exclusion=db.scalar(select(EmailExclusion).where(EmailExclusion.email==email))
                if exclusion:
                    exclusion.blocked=True
                    exclusion.note=data.note
                    exclusion.declared_on=data.declared_on
                    exclusion.version+=1
                else: db.add(EmailExclusion(email=email,blocked=True,note=data.note,declared_on=data.declared_on))
        row.state,row.declared_on,row.note=data.state,data.declared_on,data.note
        row.email_snapshot=canonical(contact.email)
        if row.version: row.version+=1
        lock.version+=1
        contact.version+=1
        db.add(row)
        audit(db,account,'marketing.permission.update',identifier,{'state':data.state})
        save(db)
        return record(row)

    @api.get('/api/marketing/exclusions')
    def exclusions(q: str = Query(default='',max_length=254), offset: int = Query(default=0,ge=0,le=100000), account=Depends(user), db=Depends(database)):
        terms=[EmailExclusion.email.icontains(q.strip(),autoescape=True)] if q.strip() else []
        rows=db.scalars(select(EmailExclusion).where(*terms).order_by(EmailExclusion.created_at.desc(),EmailExclusion.id).offset(offset).limit(40))
        return {'items':[record(row) for row in rows],'total':db.scalar(select(func.count()).select_from(EmailExclusion).where(*terms))}

    def apply_exclusion(db,row,data,account):
        lock=gate(db)
        if not data.blocked and account.role!='admin': raise HTTPException(403,'Seul le propriétaire ou un administrateur peut lever une exclusion.')
        if row:
            check_version(row,data.version)
            if canonical(data.email)!=row.email: raise HTTPException(422,'L’adresse d’une exclusion existante ne peut pas être remplacée.')
            row.version+=1
        else:
            if not data.blocked: raise HTTPException(422,'Une nouvelle exclusion doit être active.')
            row=EmailExclusion(email=canonical(data.email))
        row.blocked,row.note,row.declared_on=data.blocked,data.note,data.declared_on
        lock.version+=1
        db.add(row)
        flush(db)
        audit(db,account,'marketing.exclusion.update',row.id,{'blocked':row.blocked})
        save(db)
        return record(row)

    @api.post('/api/marketing/exclusions',status_code=201)
    def add_exclusion(data: ExclusionInput, account=Depends(writer), db=Depends(database)):
        if db.scalar(select(EmailExclusion.id).where(EmailExclusion.email==canonical(data.email))): raise HTTPException(409,'Cette adresse figure déjà dans la liste. Modifiez la fiche existante.')
        return apply_exclusion(db,None,data,account)

    @api.put('/api/marketing/exclusions/{identifier}')
    def update_exclusion(identifier: str, data: ExclusionInput, account=Depends(writer), db=Depends(database)):
        return apply_exclusion(db,find(db,EmailExclusion,identifier),data,account)

    @api.get('/api/marketing/campaigns')
    def campaigns(archived: bool=False, offset: int = Query(default=0,ge=0,le=100000), account=Depends(user), db=Depends(database)):
        count=select(func.count()).select_from(CampaignExport).where(CampaignExport.campaign_id==Campaign.id).correlate(Campaign).scalar_subquery()
        rows=db.execute(select(Campaign,count).where(Campaign.archived==archived).order_by(Campaign.created_at.desc(),Campaign.id).offset(offset).limit(40))
        return {'items':[{**record(row),'export_count':n} for row,n in rows], 'total':db.scalar(select(func.count()).select_from(Campaign).where(Campaign.archived==archived))}

    def apply_campaign(db,row,data,account,creating=False):
        lock=gate(db)
        if not creating: check_version(row,data.version)
        for key,value in data.model_dump(exclude={'version'}).items(): setattr(row,key,str(value) if key in ('sender_email','reply_to') and value else value)
        if not creating: row.version+=1
        lock.version+=1
        db.add(row)
        flush(db)
        audit(db,account,'marketing.campaign.create' if creating else 'marketing.campaign.update',row.id)
        save(db)
        return record(row)

    @api.post('/api/marketing/campaigns',status_code=201)
    def create_campaign(data: CampaignInput, account=Depends(writer), db=Depends(database)):
        return apply_campaign(db,Campaign(),data,account,creating=True)

    @api.put('/api/marketing/campaigns/{identifier}')
    def update_campaign(identifier: str, data: CampaignInput, account=Depends(writer), db=Depends(database)):
        return apply_campaign(db,find(db,Campaign,identifier),data,account)

    def audience(db,campaign):
        terms=[Contact.archived==False]
        if campaign.segment=='buyers': terms.append(Contact.kind.in_(('buyer','both')))
        elif campaign.segment=='sellers': terms.append(Contact.kind.in_(('seller','both')))
        elif campaign.segment=='professional': terms.append(Contact.kind=='professional')
        rows=db.execute(select(Contact,MarketingPermission).outerjoin(MarketingPermission,MarketingPermission.contact_id==Contact.id).where(*terms).order_by(Contact.name,Contact.id).limit(1001)).all()
        if len(rows)>1000: raise HTTPException(422,'La prévisualisation est limitée à 1 000 contacts. Choisissez un segment plus restreint.')
        exclusions=list(db.scalars(select(EmailExclusion).where(EmailExclusion.blocked==True)))
        blocked={row.email for row in exclusions}
        # Une opposition sur une fiche s'applique aussi aux doublons d'adresse, même si l'e-mail a changé depuis.
        refusals=db.execute(select(Contact.email,MarketingPermission.email_snapshot).join(MarketingPermission,MarketingPermission.contact_id==Contact.id).where(MarketingPermission.state.in_(('refused','withdrawn')))).yield_per(500)
        for current,previous in refusals: blocked.update(e for e in (canonical(current),previous) if e)
        eligible,excluded,seen=[],[],set()
        snapshot=[]
        for contact,permission in rows:
            email=canonical(contact.email)
            reason=''
            if not email: reason='Adresse e-mail absente'
            elif not ascii_email(email): reason='Adresse e-mail non prise en charge pour un fichier EML standard'
            elif email in blocked: reason='Adresse exclue ou opposition enregistrée'
            elif not permission or permission.state!='declared': reason='Autorisation newsletter non déclarée'
            elif permission.email_snapshot!=email: reason='Adresse modifiée : autorisation à revérifier'
            elif email in seen: reason='Adresse déjà retenue sur une autre fiche'
            item={'id':contact.id,'name':contact.name,'email':(ascii_email(contact.email) or contact.email) if email else None}
            if reason: excluded.append({**item,'reason':reason})
            else: eligible.append(item); seen.add(email)
            snapshot.append({'contact':{'id':contact.id,'name':contact.name,'email':email,'actual_email':contact.email,'kind':contact.kind},'permission':record(permission) if permission else None,'reason':reason})
        digest=hashlib.sha256(json.dumps({'campaign':record(campaign),'contacts':snapshot,'blocked':sorted(blocked)},sort_keys=True,default=str,ensure_ascii=False).encode()).hexdigest()
        return {'eligible':eligible,'excluded':excluded,'digest':digest}, {c.id:c for c,_ in rows}

    def render(campaign,contact):
        name=display_name(contact.name)
        subject=campaign.subject.replace('{nom}',name)
        body=campaign.body.replace('{nom}',contact.name)
        if len(subject)>250 or len(body)>100000: raise HTTPException(422,'Le texte personnalisé dépasse la taille autorisée. Réduisez les occurrences de {nom}.')
        return subject,body

    def missing(campaign):
        fields=[]
        if not campaign.subject.strip(): fields.append('Objet')
        if not campaign.body.strip(): fields.append('Message')
        if len(campaign.sender_name.strip())<2 or not campaign.sender_email: fields.append('Identité et e-mail de l’expéditeur')
        elif not ascii_email(campaign.sender_email): fields.append('Adresse expéditeur compatible EML standard')
        if campaign.reply_to and not ascii_email(campaign.reply_to): fields.append('Adresse de réponse compatible EML standard')
        if len(campaign.footer.strip())<10: fields.append('Signature et consignes de désinscription')
        if campaign.archived: fields.append('Campagne archivée')
        return fields

    @api.get('/api/marketing/campaigns/{identifier}/preview')
    def preview(identifier: str, contact_id: str = Query(default='',max_length=36), account=Depends(user), db=Depends(database)):
        campaign=find(db,Campaign,identifier)
        result,contacts=audience(db,campaign)
        chosen=contact_id or (result['eligible'][0]['id'] if result['eligible'] else '')
        selected=next((r for r in result['eligible'] if r['id']==chosen),None)
        if contact_id and not selected: raise HTTPException(422,'Ce contact n’est pas éligible à la préparation du message.')
        subject,body=render(campaign,contacts[chosen]) if selected else (campaign.subject,campaign.body)
        exports=db.scalars(select(CampaignExport).where(CampaignExport.campaign_id==campaign.id).order_by(CampaignExport.created_at.desc(),CampaignExport.id).limit(20))
        return {**result,'campaign':record(campaign),'sample':{'contact_id':chosen,'subject':subject,'body':body},'missing':missing(campaign),
            'exports':[{k:v for k,v in record(row).items() if k not in ('content','audience_digest')} for row in exports], 'delivery_available':False}

    @api.post('/api/marketing/campaigns/{identifier}/download')
    def download(identifier: str, data: ExportInput, account=Depends(writer), db=Depends(database)):
        lock=gate(db)  # Référence forte conservée jusqu'au commit du contrôle et de l'export.
        campaign=find(db,Campaign,identifier)
        if missing(campaign): raise HTTPException(422,'Complétez le brouillon et désarchivez-le avant de préparer un fichier.')
        result,contacts=audience(db,campaign)
        if result['digest']!=data.digest: raise HTTPException(409,'Le brouillon, les coordonnées ou les préférences ont changé. Prévisualisez à nouveau avant de confirmer.')
        recipient=next((row for row in result['eligible'] if row['id']==data.contact_id),None)
        if not recipient: raise HTTPException(422,'Ce contact est exclu de la préparation.')
        request_id=str(data.request_id)
        old=db.get(CampaignExport,request_id)
        if old:
            if old.campaign_id!=campaign.id or old.contact_id!=data.contact_id or old.audience_digest!=data.digest: raise HTTPException(409,'Cet identifiant correspond déjà à une autre préparation.')
            content=old.content
            lock.version+=1
            contacts[data.contact_id].version+=1
            save(db)
        else:
            contact=contacts[data.contact_id]
            subject,body=render(campaign,contact)
            message=EmailMessage(policy=SMTP)
            message['Subject']=subject
            message['From']=Address(display_name=campaign.sender_name,addr_spec=ascii_email(campaign.sender_email))
            message['To']=Address(display_name=display_name(contact.name),addr_spec=ascii_email(recipient['email']))
            reply=ascii_email(campaign.reply_to or campaign.sender_email)
            message['Reply-To']=reply
            message['List-Unsubscribe']='<mailto:'+reply+'>'
            message['Date']=format_datetime(now())
            message['Message-ID']='<'+request_id+'@immo-pilot.local>'
            message['X-Unsent']='1'
            message.set_content(body+'\n\n'+campaign.footer+'\n\nPour ne plus recevoir ces messages, répondez à '+reply+'.\n',cte='quoted-printable')
            content=message.as_bytes().decode('ascii')
            db.add(CampaignExport(id=request_id,campaign_id=campaign.id,contact_id=contact.id,recipient_email=recipient['email'],campaign_version=campaign.version,audience_digest=data.digest,content=content,sha256=hashlib.sha256(content.encode('ascii')).hexdigest()))
            lock.version+=1
            contact.version+=1  # Refuse un changement simultané d'adresse, de nom ou un archivage.
            audit(db,account,'marketing.eml.prepared',campaign.id,{'request_id':request_id,'contact_id':contact.id})
            save(db)
        return Response(content.encode('ascii'),media_type='message/rfc822',headers={'Content-Disposition':'attachment; filename="newsletter-'+request_id+'.eml"'})
