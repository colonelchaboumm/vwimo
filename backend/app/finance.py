"""Suivi financier déclaratif local ; ni facture, ni déclaration fiscale, ni paiement bancaire."""
import csv
import hashlib
import io
import json
from datetime import date
from decimal import Decimal

from fastapi import Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from .commission_math import calculate, cents, period_bounds
from .finance_schemas import AcquisitionInput, IncomeInput, PaymentInput, PlanInput, TransactionInput
from .models import CommissionPlan, Contact, Document, Income, IncomePayment, Mandate, SaleTransaction
from .radar_schemas import today


def register_finance(api, *, database, user, writer, audit, find, save, check_version, record):
    def flush(db):
        try: db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Référence déjà utilisée, dossier de vente existant pour ce mandat ou lien incompatible. Actualisez avant de réessayer.")

    def transaction_data(row, mandate, buyer):
        return {**record(row), "mandate_reference": mandate.reference, "buyer_name": buyer.name if buyer else "",
                "overdue": bool(row.expected_deed_on and row.expected_deed_on < today() and row.stage not in ('signed','cancelled')),
                "unchecked": sum(not item['done'] for item in row.checklist)}

    @api.get('/api/transactions')
    def transactions(offset: int = Query(default=0, ge=0, le=100000), limit: int = Query(default=40, ge=1, le=100), account=Depends(user), db=Depends(database)):
        rows = db.execute(select(SaleTransaction, Mandate, Contact).join(Mandate, SaleTransaction.mandate_id == Mandate.id)
            .outerjoin(Contact, SaleTransaction.buyer_id == Contact.id).order_by(SaleTransaction.created_at.desc(), SaleTransaction.id).offset(offset).limit(limit)).all()
        return {"items": [transaction_data(*row) for row in rows], "total": db.scalar(select(func.count()).select_from(SaleTransaction))}

    def apply_transaction(db, row, data):
        mandate = find(db, Mandate, data.mandate_id)
        buyer = find(db, Contact, data.buyer_id) if data.buyer_id else None
        if buyer and (buyer.archived or buyer.kind not in ('buyer','both') or buyer.id == mandate.seller_id):
            raise HTTPException(422, "Choisissez un acquéreur actif distinct du vendeur du mandat.")
        if row.id and row.mandate_id != data.mandate_id:
            raise HTTPException(422, "Le mandat d’une transaction existante ne peut pas être remplacé.")
        if data.stage == 'cancelled' and row.id and db.scalar(select(Income.id).where(Income.transaction_id == row.id, Income.status == 'acquired').limit(1)):
            raise HTTPException(409, "Cette transaction possède un revenu validé. Sa correction doit préserver l’historique financier.")
        for name, value in data.model_dump(exclude={'version','checklist'}).items(): setattr(row, name, value)
        row.checklist = [item.model_dump() for item in data.checklist]
        db.add(row)
        flush(db)
        return mandate, buyer

    @api.post('/api/transactions', status_code=201)
    def create_transaction(data: TransactionInput, account=Depends(writer), db=Depends(database)):
        row = SaleTransaction()
        mandate, buyer = apply_transaction(db, row, data)
        audit(db, account, 'transaction.create', row.id)
        save(db)
        return transaction_data(row, mandate, buyer)

    @api.put('/api/transactions/{identifier}')
    def update_transaction(identifier: str, data: TransactionInput, account=Depends(writer), db=Depends(database)):
        row = find(db, SaleTransaction, identifier)
        check_version(row, data.version)
        before = {"stage": row.stage, "sale_price": str(row.sale_price)}
        row.version += 1
        mandate, buyer = apply_transaction(db, row, data)
        audit(db, account, 'transaction.update', row.id, {"before": before, "after": {"stage": row.stage, "sale_price": str(row.sale_price)}})
        save(db)
        return transaction_data(row, mandate, buyer)

    @api.get('/api/transactions/{identifier}/documents')
    def documents(identifier: str, account=Depends(user), db=Depends(database)):
        row = find(db, SaleTransaction, identifier)
        mandate = find(db, Mandate, row.mandate_id)
        contacts = [c for c in (row.buyer_id, mandate.seller_id) if c]
        rows = list(db.scalars(select(Document).where(or_(Document.mandate_id == row.mandate_id, Document.contact_id.in_(contacts))).order_by(Document.created_at.desc()).limit(201)))
        return {"items": [{k:v for k,v in record(d).items() if k != 'storage_key'} for d in rows[:200]], "limited": len(rows)>200}

    @api.get('/api/finance/plans')
    def plans(account=Depends(user), db=Depends(database)):
        rows = list(db.scalars(select(CommissionPlan).order_by(CommissionPlan.created_at.desc(), CommissionPlan.id).limit(501)))
        return {"items": [record(row) for row in rows[:500]], "limited": len(rows)>500}

    @api.post('/api/finance/plans', status_code=201)
    def create_plan(data: PlanInput, account=Depends(writer), db=Depends(database)):
        if account.role != 'admin': raise HTTPException(403, "Seul le propriétaire ou un administrateur peut enregistrer un barème contractuel.")
        row = CommissionPlan(**data.model_dump(exclude={'tiers'}), tiers=[t.model_dump(mode='json') for t in data.tiers])
        db.add(row)
        flush(db)
        audit(db, account, 'commission.plan.create', row.id)
        save(db)
        return record(row)

    paid_amount = select(func.coalesce(func.sum(IncomePayment.amount), 0)).where(IncomePayment.income_id == Income.id).correlate(Income).scalar_subquery()

    def income_data(db, row, paid=None):
        paid = paid if paid is not None else db.scalar(select(func.coalesce(func.sum(IncomePayment.amount), 0)).where(IncomePayment.income_id == row.id))
        remaining = row.amount-paid if row.status == 'acquired' else Decimal(0)
        return {**record(row), "paid": str(cents(paid)), "remaining": str(cents(remaining)),
                "overdue": row.status == 'acquired' and remaining > 0 and row.expected_on < today()}

    def quotation(db, row, day, *, acquiring=False):
        plan = find(db, CommissionPlan, row.plan_id) if row.plan_id else None
        if acquiring:
            if not date(1900, 1, 1) <= day <= date(2100, 12, 31): raise HTTPException(422, "La date doit être comprise entre 1900 et 2100.")
            if day > today(): raise HTTPException(422, "La validation d’un revenu ne peut pas être future.")
            if len(row.justification.strip()) < 10: raise HTTPException(422, "Documentez le droit à rémunération avant de valider ce revenu (10 caractères minimum).")
        if plan:
            if not plan.effective_from <= day or (plan.effective_to and day > plan.effective_to):
                raise HTTPException(422, "La date de calcul est hors des dates d’application de ce barème. Choisissez un autre barème.")
            if row.amount_basis != plan.amount_basis: raise HTTPException(422, "La base HT/TTC/contractuelle doit correspondre au barème.")
            start, end = period_bounds(day, plan.period)
            predicate = [Income.plan_id == plan.id, Income.status == 'acquired', Income.earned_on >= start, Income.earned_on < end]
            before = db.scalar(select(func.coalesce(func.sum(Income.base_amount),0)).where(*predicate))
            if plan.opening_base and plan.opening_on and start <= plan.opening_on < end:
                if day < plan.opening_on: raise HTTPException(422, "La date précède la reprise du cumul contractuel de cette période.")
                before += plan.opening_base
            latest = db.scalar(select(func.max(Income.earned_on)).where(*predicate))
            if acquiring and latest and latest > day:
                raise HTTPException(422, "Validez les revenus de ce barème dans l’ordre des dates à l’intérieur de chaque période.")
            try: calculation = calculate(plan.tiers, plan.method, before, row.base_amount, row.adjustment)
            except ValueError as e: raise HTTPException(422, str(e))
            calculation.update({"plan_id": plan.id, "plan_name": plan.name, "plan_version": plan.version, "base_label": plan.base_label,
                                "period_start": str(start), "period_end_exclusive": str(end), "tiers": plan.tiers})
            calculation.update({"opening_base": str(plan.opening_base), "opening_on": str(plan.opening_on) if plan.opening_on else None})
        else:
            amount = cents(row.fixed_amount+row.adjustment)
            if not 0 <= amount <= Decimal('999999999'): raise HTTPException(422, "Le montant après ajustement est hors limites.")
            calculation = {"method": "fixed", "fixed_amount": str(row.fixed_amount), "adjustment": str(row.adjustment), "amount": str(amount)}
        calculation.update({"date": str(day), "amount_basis": row.amount_basis, "adjustment_reason": row.adjustment_reason})
        snapshot = {"income_id": row.id, "income_version": row.version, "calculation": calculation}
        digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        return {"calculation": calculation, "digest": digest}

    def apply_income(db, row, data):
        if data.transaction_id: find(db, SaleTransaction, data.transaction_id)
        if data.contact_id:
            contact = find(db, Contact, data.contact_id)
            if contact.archived: raise HTTPException(422, "Choisissez un contact actif.")
        with db.no_autoflush:
            for key, value in data.model_dump(exclude={'version'}).items(): setattr(row, key, value)
            row.status = 'forecast'
            value = quotation(db, row, row.expected_on)
        row.calculation, row.amount = value['calculation'], Decimal(value['calculation']['amount'])
        db.add(row)

    @api.get('/api/finance/incomes')
    def incomes(offset: int = Query(default=0, ge=0, le=100000), limit: int = Query(default=40, ge=1, le=100), account=Depends(user), db=Depends(database)):
        rows = db.execute(select(Income, paid_amount).order_by(Income.created_at.desc(), Income.id).offset(offset).limit(limit)).all()
        return {"items": [income_data(db,row,paid) for row,paid in rows], "total": db.scalar(select(func.count()).select_from(Income))}

    @api.post('/api/finance/incomes', status_code=201)
    def create_income(data: IncomeInput, account=Depends(writer), db=Depends(database)):
        row = Income()
        apply_income(db, row, data)
        flush(db)
        audit(db, account, 'income.forecast.create', row.id)
        save(db)
        return income_data(db, row)

    @api.put('/api/finance/incomes/{identifier}')
    def update_income(identifier: str, data: IncomeInput, account=Depends(writer), db=Depends(database)):
        row = find(db, Income, identifier)
        check_version(row, data.version)
        if row.status != 'forecast': raise HTTPException(409, "Un revenu validé ou annulé est conservé sans modification financière.")
        row.version += 1
        apply_income(db, row, data)
        audit(db, account, 'income.forecast.update', row.id)
        save(db)
        return income_data(db, row)

    @api.get('/api/finance/incomes/{identifier}')
    def income_detail(identifier: str, account=Depends(user), db=Depends(database)):
        row = find(db, Income, identifier)
        return {**income_data(db, row), "payments": [record(p) for p in db.scalars(select(IncomePayment).where(IncomePayment.income_id == row.id).order_by(IncomePayment.paid_on, IncomePayment.id))]}

    @api.get('/api/finance/incomes/{identifier}/quote')
    def quote(identifier: str, earned_on: date, account=Depends(user), db=Depends(database)):
        row = find(db, Income, identifier)
        if row.status != 'forecast': raise HTTPException(409, "Ce revenu n’est plus prévisionnel.")
        return quotation(db, row, earned_on, acquiring=True)

    @api.post('/api/finance/incomes/{identifier}/acquire')
    def acquire(identifier: str, data: AcquisitionInput, account=Depends(writer), db=Depends(database)):
        row = find(db, Income, identifier)
        request_id = str(data.request_id)
        if row.acquisition_request_id == request_id and row.earned_on == data.earned_on:
            return income_data(db, row)
        check_version(row, data.version)
        if row.status != 'forecast': raise HTTPException(409, "Ce revenu a déjà été validé ou annulé.")
        # Garder une référence forte : le cache d'identité SQLAlchemy est faible.
        # Le compteur utilisé par le devis doit rester celui modifié à la validation.
        plan = find(db, CommissionPlan, row.plan_id) if row.plan_id else None
        value = quotation(db, row, data.earned_on, acquiring=True)
        if value['digest'] != data.digest: raise HTTPException(409, "Le calcul ou le cumul a changé. Recalculez et confirmez le nouveau montant.")
        if plan:
            plan.version += 1  # Sérialise les validations partageant le même compteur contractuel.
        row.calculation, row.amount = value['calculation'], Decimal(value['calculation']['amount'])
        row.earned_on, row.status, row.acquisition_request_id = data.earned_on, 'acquired', request_id
        row.version += 1
        audit(db, account, 'income.acquired.declared', row.id, {"amount": str(row.amount), "request_id": request_id})
        save(db)
        return income_data(db, row)

    @api.post('/api/finance/incomes/{identifier}/cancel')
    def cancel(identifier: str, version: int = Query(ge=1), account=Depends(writer), db=Depends(database)):
        row = find(db, Income, identifier)
        check_version(row, version)
        if row.status != 'forecast': raise HTTPException(409, "Seule une prévision peut être annulée ici. Les revenus validés et leurs encaissements restent conservés.")
        row.status = 'cancelled'
        row.version += 1
        audit(db, account, 'income.forecast.cancel', row.id)
        save(db)
        return income_data(db, row)

    @api.post('/api/finance/incomes/{identifier}/payments')
    def payment(identifier: str, data: PaymentInput, account=Depends(writer), db=Depends(database)):
        row = find(db, Income, identifier)
        request_id = str(data.request_id)
        old = db.get(IncomePayment, request_id)
        if old:
            if old.income_id != row.id or old.amount != data.amount or old.paid_on != data.paid_on or old.reference != data.reference:
                raise HTTPException(409, "Cet identifiant de requête est déjà utilisé pour un autre encaissement.")
            return income_data(db,row)
        check_version(row, data.version)
        if row.status != 'acquired': raise HTTPException(422, "Validez d’abord le revenu avant de déclarer son encaissement.")
        if not row.earned_on <= data.paid_on <= today(): raise HTTPException(422, "L’encaissement doit être daté entre la validation du revenu et aujourd’hui.")
        paid = db.scalar(select(func.coalesce(func.sum(IncomePayment.amount),0)).where(IncomePayment.income_id == row.id))
        if paid+data.amount > row.amount: raise HTTPException(422, "Le cumul des encaissements dépasse le montant validé.")
        row.version += 1
        db.add(IncomePayment(id=request_id, income_id=row.id, paid_on=data.paid_on, amount=data.amount, reference=data.reference))
        audit(db, account, 'income.payment.declared', row.id, {"request_id": request_id, "amount": str(data.amount)})
        save(db)
        return income_data(db,row)

    @api.get('/api/finance/summary')
    def summary(year: int = Query(default=None, ge=1900, le=2100), account=Depends(user), db=Depends(database)):
        year = year or today().year
        start, end = date(year,1,1), date(year+1,1,1)
        totals = {basis: {"forecast": '0.00', "acquired": '0.00', "received": '0.00', "outstanding_all_years": '0.00'} for basis in ('ht','ttc','contract')}
        for status, field in (('forecast', Income.expected_on), ('acquired', Income.earned_on)):
            for basis, amount in db.execute(select(Income.amount_basis, func.sum(Income.amount)).where(Income.status == status, field >= start, field < end).group_by(Income.amount_basis)):
                totals[basis][status] = str(cents(amount))
        for basis, amount in db.execute(select(Income.amount_basis, func.sum(IncomePayment.amount)).join(Income, IncomePayment.income_id == Income.id).where(IncomePayment.paid_on >= start, IncomePayment.paid_on < end).group_by(Income.amount_basis)):
            totals[basis]['received'] = str(cents(amount))
        for basis, amount in db.execute(select(Income.amount_basis, func.sum(Income.amount-paid_amount)).where(Income.status == 'acquired').group_by(Income.amount_basis)):
            totals[basis]['outstanding_all_years'] = str(cents(amount))
        return {"year": year, "totals": totals, "tax_calculation_available": False, "invoice_available": False}

    @api.get('/api/finance/export/download')
    def export(account=Depends(user), db=Depends(database)):
        rows = db.execute(select(Income, paid_amount).order_by(Income.expected_on, Income.id).limit(2001)).all()
        if len(rows)>2000: raise HTTPException(422, "L’export est limité à 2 000 revenus dans cette version.")
        def safe(value):
            text = str(value or '')
            return "'"+text if text.lstrip().startswith(('=','+','-','@','\t','\r','\n')) else text
        out = io.StringIO(newline='')
        writer_csv = csv.writer(out, delimiter=';', lineterminator='\r\n')
        writer_csv.writerow(['reference','origine','partenaire','statut','base_montant','montant','date_previsionnelle','date_validation','encaisse','reste_a_encaisser'])
        for row, paid in rows:
            writer_csv.writerow([safe(row.reference), row.category, safe(row.partner), row.status, row.amount_basis, str(row.amount), row.expected_on, row.earned_on or '', str(cents(paid)), str(cents(row.amount-paid)) if row.status=='acquired' else ''])
        return Response('\ufeff'+out.getvalue(), media_type='text/csv; charset=utf-8', headers={'Content-Disposition':'attachment; filename="revenus-immo-pilot.csv"'})
