from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal
from threading import Barrier
from uuid import uuid4
import pytest
from sqlalchemy import select

from app.commission_math import calculate
from app.models import User
from app.radar_schemas import today
from test_application import mandate_payload


def plan_payload(**changes):
    return {"name": "Contrat de test déclaré", "partner": "Partenaire de test", "base_label": "Assiettes contractuelles déclarées", "method": "marginal", "period": "year",
            "effective_from": "2020-01-01", "tiers": [{"threshold": "0", "rate": "40"}, {"threshold": "10000", "rate": "50"}], **changes}


def new_plan(client, **changes):
    result = client.post('/api/finance/plans', json=plan_payload(**changes))
    assert result.status_code == 201, result.text
    return result.json()


def income_payload(**changes):
    return {"reference": "REV-"+uuid4().hex[:10], "title": "Commission déclarée de test", "category": "sale", "partner": "Partenaire déclaré",
            "fixed_amount": "1000.00", "expected_on": today().isoformat(), "justification": "Droit contractuel documenté dans le dossier de test", **changes}


def new_income(client, **changes):
    result = client.post('/api/finance/incomes', json=income_payload(**changes))
    assert result.status_code == 201, result.text
    return result.json()


def acquisition(client, row, day=None):
    day = day or today().isoformat()
    quote = client.get('/api/finance/incomes/'+row['id']+'/quote', params={"earned_on": day})
    assert quote.status_code == 200, quote.text
    return {"version": row['version'], "request_id": str(uuid4()), "earned_on": day, "digest": quote.json()['digest']}


def acquire(client, row, day=None):
    result = client.post('/api/finance/incomes/'+row['id']+'/acquire', json=acquisition(client,row,day))
    assert result.status_code == 200, result.text
    return result.json()


def test_marginal_and_global_crossing_are_distinct():
    tiers = [{'threshold':'0','rate':'40'},{'threshold':'10000','rate':'50'}]
    assert calculate(tiers,'marginal',Decimal('9900'),Decimal('200'))['amount'] == '90.00'
    global_value = calculate(tiers,'global',Decimal('9900'),Decimal('200'))
    assert global_value['amount'] == '1090.00'  # Rattrapage sur le cumul, pas seulement sur la nouvelle opération.
    assert calculate(tiers,'global',Decimal('9900'),Decimal('100'))['amount'] == '1040.00'
    assert calculate(tiers,'marginal',Decimal('10000'),Decimal('100'))['amount'] == '50.00'


def test_global_rounding_telescopes_without_accumulating_cents():
    tiers = [{'threshold':'0','rate':'33.3333'}]
    values = [Decimal(calculate(tiers,'global',Decimal(i)/100,Decimal('.01'))['amount']) for i in range(30)]
    assert sum(values) == Decimal('.10')


def test_transaction_dates_links_versions_and_independent_mandate(client):
    mandate = client.post('/api/mandates', json=mandate_payload(client)).json()
    data = {'reference':'VENTE-TEST', 'mandate_id':mandate['id'], 'sale_price':'410000', 'stage':'compromise', 'compromise_on':today().isoformat(), 'checklist':[{'label':'Pièce déclarée à vérifier','done':False}]}
    result = client.post('/api/transactions',json=data)
    assert result.status_code == 201, result.text
    row = result.json()
    assert row['unchecked'] == 1
    assert client.post('/api/transactions',json={**data,'reference':'AUTRE'}).status_code == 409
    assert client.put('/api/transactions/'+row['id'],json={**data,'stage':'signed','version':row['version']}).status_code == 422
    update = {**data,'stage':'signed','deed_on':today().isoformat(),'version':row['version']}
    assert client.put('/api/transactions/'+row['id'],json=update).status_code == 200
    assert client.put('/api/transactions/'+row['id'],json=update).status_code == 409
    current = next(m for m in client.get('/api/mandates').json() if m['id']==mandate['id'])
    assert current['status']=='active' and current['price']=='420000.00'
    assert client.get('/api/transactions/'+row['id']+'/documents').status_code == 200


@pytest.mark.parametrize('changes', [
    {'tiers':[{'threshold':'10','rate':'50'}]}, {'tiers':[{'threshold':'0','rate':'101'}]},
    {'tiers':[{'threshold':'0','rate':'30'},{'threshold':'0','rate':'40'}]},
    {'method':'global','tiers':[{'threshold':'0','rate':'50'},{'threshold':'100','rate':'40'}]},
    {'effective_to':'2019-01-01'}, {'opening_base':'1000','opening_on':None},
])
def test_invalid_plans_rejected(client, changes):
    assert client.post('/api/finance/plans',json=plan_payload(**changes)).status_code == 422


def test_quote_counter_snapshot_and_annual_reset(client):
    plan = new_plan(client, opening_base='9900', opening_on=today().isoformat())
    row = new_income(client, plan_id=plan['id'], base_amount='200', fixed_amount=None)
    assert row['amount']=='90.00'
    row = acquire(client,row)
    assert row['calculation']['cumulative_before']=='9900.00'
    second = new_income(client, plan_id=plan['id'], base_amount='100', fixed_amount=None)
    assert second['amount']=='50.00'
    future = new_income(client, plan_id=plan['id'], base_amount='100', fixed_amount=None, expected_on=date(today().year+1,1,1).isoformat())
    assert future['amount']=='40.00'
    assert client.put('/api/finance/incomes/'+row['id'],json=income_payload(version=row['version'])).status_code == 409
    assert client.put('/api/finance/plans/'+plan['id'],json=plan_payload()).status_code in (404,405)


def test_stale_cumulative_quote_requires_new_confirmation(client):
    plan = new_plan(client)
    first = new_income(client, plan_id=plan['id'],base_amount='1000',fixed_amount=None)
    second = new_income(client, plan_id=plan['id'],base_amount='1000',fixed_amount=None)
    old = acquisition(client,second)
    acquire(client,first)
    assert client.post('/api/finance/incomes/'+second['id']+'/acquire',json=old).status_code == 409
    assert acquire(client,second)['calculation']['cumulative_before']=='1000.00'


def test_acquisition_is_idempotent_and_payments_are_partial_and_versioned(client):
    row = new_income(client)
    path = '/api/finance/incomes/'+row['id']
    data = acquisition(client,row)
    row = client.post(path+'/acquire',json=data).json()
    assert client.post(path+'/acquire',json=data).json()['version']==row['version']
    payment = {'version':row['version'],'request_id':str(uuid4()),'paid_on':today().isoformat(),'amount':'400','reference':'Virement déclaré de test'}
    response = client.post(path+'/payments',json=payment)
    assert response.status_code==200,response.text
    value = response.json()
    assert value['paid']=='400.00' and value['remaining']=='600.00'
    assert client.post(path+'/payments',json=payment).json()['paid']=='400.00'
    assert client.post(path+'/payments',json={**payment,'request_id':str(uuid4()),'version':value['version'],'amount':'601'}).status_code==422
    assert client.post(path+'/payments',json={**payment,'request_id':str(uuid4()),'amount':'600'}).status_code==409
    assert len(client.get(path).json()['payments'])==1


def test_payment_and_validation_conditions(client):
    row = new_income(client, justification='')
    assert client.get('/api/finance/incomes/'+row['id']+'/quote',params={'earned_on':today().isoformat()}).status_code==422
    assert client.post('/api/finance/incomes/'+row['id']+'/payments',json={'version':row['version'],'request_id':str(uuid4()),'paid_on':today().isoformat(),'amount':'10','reference':'Test déclaré'}).status_code==422
    row = new_income(client)
    assert client.get('/api/finance/incomes/'+row['id']+'/quote',params={'earned_on':(today()+timedelta(days=1)).isoformat()}).status_code==422
    assert client.post('/api/finance/incomes',json=income_payload(fixed_amount='0',adjustment='-1',adjustment_reason='Correction expliquée')).status_code==422


def test_summary_separates_bases_and_export_neutralizes_formulas(client):
    first = acquire(client,new_income(client,amount_basis='ht',reference='=FORMULE',partner='+Partenaire'))
    second = acquire(client,new_income(client,amount_basis='ttc',fixed_amount='1200'))
    assert first['amount']=='1000.00' and second['amount']=='1200.00'
    summary = client.get('/api/finance/summary',params={'year':today().year}).json()
    assert summary['totals']['ht']['acquired']=='1000.00'
    assert summary['totals']['ttc']['acquired']=='1200.00'
    assert not summary['tax_calculation_available'] and not summary['invoice_available']
    text = client.get('/api/finance/export/download').text
    assert "'=FORMULE" in text and "'+Partenaire" in text


@pytest.mark.parametrize('_attempt', range(4))
def test_plan_acquisitions_serialize_concurrently(setup, _attempt, monkeypatch):
    client, app, settings = setup
    plan = new_plan(client)
    rows = [new_income(client,plan_id=plan['id'],base_amount='1000',fixed_amount=None) for _ in range(2)]
    requests = [(row,acquisition(client,row)) for row in rows]
    barrier = Barrier(2, timeout=15)
    def simultaneous_calculation(*args, **kwargs):
        value = calculate(*args, **kwargs)
        barrier.wait()  # Les deux requêtes ont lu le cumul avant qu'une écriture soit possible.
        return value
    monkeypatch.setattr('app.finance.calculate', simultaneous_calculation)
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda pair:client.post('/api/finance/incomes/'+pair[0]['id']+'/acquire',json=pair[1]).status_code,requests))
    assert sorted(statuses)==[200,409]


def test_monthly_reset_and_date_bounds(client):
    plan = new_plan(client, period='month', opening_base='9900', opening_on=today().isoformat())
    row = acquire(client,new_income(client,plan_id=plan['id'],base_amount='200',fixed_amount=None))
    assert row['amount']=='90.00'
    next_month = date(today().year + (today().month == 12), today().month % 12 + 1, 1)
    row = new_income(client,plan_id=plan['id'],base_amount='200',fixed_amount=None,expected_on=next_month.isoformat())
    assert row['amount']=='80.00'
    assert client.post('/api/finance/incomes',json=income_payload(expected_on='9999-12-31')).status_code==422
    assert client.get('/api/finance/incomes/'+row['id']+'/quote',params={'earned_on':'0001-01-01'}).status_code==422


def test_concurrent_receipts_cannot_overpay(client):
    row = acquire(client,new_income(client,fixed_amount='100.01'))
    path = '/api/finance/incomes/'+row['id']
    payments = [{'version':row['version'],'request_id':str(uuid4()),'paid_on':today().isoformat(),'amount':'60.01','reference':'Versement fictif concurrent'} for _ in range(2)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda data:client.post(path+'/payments',json=data).status_code,payments))
    assert sorted(statuses) in ([200,409], [200,422])  # Conflit de version ou total déjà dépassé.
    detail = client.get(path).json()
    assert detail['paid']=='60.01' and detail['remaining']=='40.00' and len(detail['payments'])==1


def test_backdated_acquisition_and_cancelled_forecast(client):
    plan = new_plan(client)
    current = acquire(client,new_income(client,plan_id=plan['id'],base_amount='100',fixed_amount=None))
    other = new_income(client,plan_id=plan['id'],base_amount='100',fixed_amount=None)
    if today().day > 1:
        assert client.get('/api/finance/incomes/'+other['id']+'/quote',params={'earned_on':(today()-timedelta(days=1)).isoformat()}).status_code==422
    response = client.post('/api/finance/incomes/'+other['id']+'/cancel',params={'version':other['version']})
    assert response.status_code==200 and response.json()['status']=='cancelled'
    assert client.post('/api/finance/incomes/'+current['id']+'/cancel',params={'version':current['version']}).status_code==409


def test_reader_cannot_mutate_finance(setup):
    client,app,_ = setup
    with app.state.sessions() as db:
        db.scalar(select(User).limit(1)).role='reader'
        db.commit()
    assert client.get('/api/finance/incomes').status_code==200
    assert client.get('/api/transactions').status_code==200
    assert client.post('/api/finance/plans',json=plan_payload()).status_code==403
    assert client.post('/api/finance/incomes',json=income_payload()).status_code==403
