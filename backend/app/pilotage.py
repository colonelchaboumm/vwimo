"""Indicateurs descriptifs de données locales ; aucune attribution causale implicite."""
from datetime import date, datetime, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo
from fastapi import Depends, Query
from sqlalchemy import extract, func, select
from .commission_math import cents
from .models import Contact, Mandate, SaleTransaction, Partner, Referral, Income, IncomePayment, ProspectActivity, CalendarEvent
from .radar_schemas import today


def register_pilotage(api, *, database, user):
    @api.get('/api/pilotage')
    def pilotage(year: int = Query(default=None,ge=1900,le=2100), account=Depends(user), db=Depends(database)):
        year = year or today().year
        start,end = date(year,1,1),date(year+1,1,1)
        paris = ZoneInfo('Europe/Paris')
        utc_start = datetime(year,1,1,tzinfo=paris).astimezone(timezone.utc)
        utc_end = datetime(year+1,1,1,tzinfo=paris).astimezone(timezone.utc)
        def grouped(model, field, *terms):
            return {str(key):count for key,count in db.execute(select(field,func.count()).where(*terms).group_by(field))}
        stocks = {
            'contacts':db.scalar(select(func.count()).select_from(Contact).where(Contact.archived==False)),
            'partners':db.scalar(select(func.count()).select_from(Partner).where(Partner.archived==False)),
            'mandates':grouped(Mandate,Mandate.status),
            'transactions':grouped(SaleTransaction,SaleTransaction.stage),
            'referrals':grouped(Referral,Referral.stage),
        }
        signed_terms = [SaleTransaction.stage=='signed',SaleTransaction.deed_on>=start,SaleTransaction.deed_on<end]
        signed_count,volume = db.execute(select(func.count(),func.coalesce(func.sum(SaleTransaction.sale_price),0)).where(*signed_terms)).one()
        delays = ((deed-compromise).days for deed,compromise in db.execute(select(SaleTransaction.deed_on,SaleTransaction.compromise_on).where(*signed_terms,SaleTransaction.compromise_on.is_not(None))).yield_per(500))
        total_days,samples = 0,0
        for days in delays:
            if days>=0: total_days += days; samples += 1
        activity = grouped(ProspectActivity,ProspectActivity.kind,ProspectActivity.occurred_at>=utc_start,ProspectActivity.occurred_at<utc_end)
        calendar = grouped(CalendarEvent,CalendarEvent.kind,CalendarEvent.starts_at>=utc_start,CalendarEvent.starts_at<utc_end)
        financial = {basis:{'months':[{'month':m,'forecast':'0.00','acquired':'0.00','received':'0.00'} for m in range(1,13)], 'categories':{}} for basis in ('contract','ht','ttc')}
        for status,field in (('forecast',Income.expected_on),('acquired',Income.earned_on)):
            month = extract('month',field)
            for basis,number,amount in db.execute(select(Income.amount_basis,month,func.sum(Income.amount)).where(Income.status==status,field>=start,field<end).group_by(Income.amount_basis,month)):
                financial[basis]['months'][int(number)-1][status]=str(cents(amount))
            for basis,category,amount in db.execute(select(Income.amount_basis,Income.category,func.sum(Income.amount)).where(Income.status==status,field>=start,field<end).group_by(Income.amount_basis,Income.category)):
                financial[basis]['categories'].setdefault(category,{'forecast':'0.00','acquired':'0.00','received':'0.00'})[status]=str(cents(amount))
        month = extract('month',IncomePayment.paid_on)
        receipts = select(Income.amount_basis,month,func.sum(IncomePayment.amount)).join(IncomePayment,IncomePayment.income_id==Income.id).where(IncomePayment.paid_on>=start,IncomePayment.paid_on<end).group_by(Income.amount_basis,month)
        for basis,number,amount in db.execute(receipts): financial[basis]['months'][int(number)-1]['received']=str(cents(amount))
        for basis,category,amount in db.execute(select(Income.amount_basis,Income.category,func.sum(IncomePayment.amount)).join(IncomePayment,IncomePayment.income_id==Income.id).where(IncomePayment.paid_on>=start,IncomePayment.paid_on<end).group_by(Income.amount_basis,Income.category)):
            financial[basis]['categories'].setdefault(category,{'forecast':'0.00','acquired':'0.00','received':'0.00'})['received']=str(cents(amount))
        return {'year':year,'stocks':stocks,'annual':{'signed_count':signed_count,'sale_volume':str(cents(volume)),
            'compromise_to_deed_days':str(cents(Decimal(total_days)/samples)) if samples else None,'delay_samples':samples,
            'prospect_activities':activity,'calendar_entries':calendar,'referrals_opened':db.scalar(select(func.count()).select_from(Referral).where(Referral.introduced_on>=start,Referral.introduced_on<end))}, 'financial':financial}
