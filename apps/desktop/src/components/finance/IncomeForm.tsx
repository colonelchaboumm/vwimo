import { useState, type FormEvent } from "react";
import { api } from "../../api";
import type { Contact } from "../../types";
import { useFormGuard } from "../FormGuard";
import { Field, useSubmitLock } from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { parisInput } from "../radar/types";
import {
  bases,
  categories,
  type Income,
  type Plan,
  type Transaction,
} from "./types";

export function IncomeForm({
  item,
  plans,
  transactions,
  contacts,
  onClose,
  onSaved,
}: {
  item?: Income;
  plans: Plan[];
  transactions: Transaction[];
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [planId, setPlanId] = useState(item?.plan_id || "");
  const [basis, setBasis] = useState(item?.amount_basis || "contract");
  const [partner, setPartner] = useState(item?.partner || "");
  const [error, setError] = useState("");
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/finance/incomes" + (item ? "/" + item.id : ""), {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({
          ...values,
          version: item?.version,
          plan_id: planId || null,
          amount_basis: basis,
          partner,
          transaction_id: values.transaction_id || null,
          contact_id: values.contact_id || null,
          fixed_amount: planId ? null : values.fixed_amount,
          base_amount: planId ? values.base_amount : "0",
        }),
      });
      guard.clean();
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  return (
    <Modal
      open
      wide
      title={item ? "Modifier la prévision" : "Nouveau revenu prévisionnel"}
      onClose={guard.close}
      description="Une ligne par rémunération : part vente, entrée de mandat, courtier ou autre partenaire. Aucune facture ni déclaration fiscale n’est créée."
    >
      <form
        className="commercial-form"
        onSubmit={save}
        onChange={guard.markDirty}
      >
        {guard.notice}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <fieldset className="radar-form-grid" disabled={lock.busy}>
          <Field label="Référence du revenu">
            {(id) => (
              <input
                id={id}
                name="reference"
                required
                minLength={2}
                maxLength={40}
                defaultValue={item?.reference || ""}
              />
            )}
          </Field>
          <Field label="Libellé du revenu">
            {(id) => (
              <input
                id={id}
                name="title"
                required
                minLength={3}
                maxLength={180}
                defaultValue={item?.title || ""}
              />
            )}
          </Field>
          <Field label="Origine de la rémunération">
            {(id) => (
              <select
                id={id}
                name="category"
                defaultValue={item?.category || "sale"}
              >
                {Object.entries(categories).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Payeur / partenaire">
            {(id) => (
              <input
                id={id}
                required
                minLength={2}
                maxLength={180}
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
              />
            )}
          </Field>
          <Field label="Transaction liée (facultatif)">
            {(id) => (
              <select
                id={id}
                name="transaction_id"
                defaultValue={item?.transaction_id || ""}
              >
                <option value="">Aucune transaction liée</option>
                {item?.transaction_id &&
                  !transactions.some((t) => t.id === item.transaction_id) && (
                    <option value={item.transaction_id}>
                      Transaction liée hors liste
                    </option>
                  )}
                {transactions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.reference} · {t.mandate_reference}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Contact lié (facultatif)">
            {(id) => (
              <select
                id={id}
                name="contact_id"
                defaultValue={item?.contact_id || ""}
              >
                <option value="">Aucun contact lié</option>
                {item?.contact_id &&
                  !contacts.some((c) => c.id === item.contact_id) && (
                    <option value={item.contact_id}>
                      Contact lié hors liste
                    </option>
                  )}
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Calcul de la rémunération">
            {(id) => (
              <select
                id={id}
                value={planId}
                onChange={(e) => {
                  const plan = plans.find((p) => p.id === e.target.value);
                  setPlanId(e.target.value);
                  if (plan) {
                    setBasis(plan.amount_basis);
                    setPartner(plan.partner);
                  }
                }}
              >
                <option value="">Montant fixe saisi</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.partner}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            label={
              planId
                ? "Assiette de l’opération (€)"
                : "Montant fixe de rémunération (€)"
            }
          >
            {(id) => (
              <input
                key={planId ? "base" : "fixed"}
                id={id}
                name={planId ? "base_amount" : "fixed_amount"}
                type="number"
                min={planId ? ".01" : "0"}
                max="999999999"
                step=".01"
                required
                defaultValue={
                  planId ? item?.base_amount || "" : item?.fixed_amount || ""
                }
              />
            )}
          </Field>
          <Field label="Nature du montant de rémunération">
            {(id) => (
              <select
                id={id}
                value={basis}
                disabled={!!planId}
                onChange={(e) => setBasis(e.target.value)}
              >
                {Object.entries(bases).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Date prévue de règlement">
            {(id) => (
              <input
                id={id}
                name="expected_on"
                type="date"
                required
                defaultValue={item?.expected_on || parisInput().slice(0, 10)}
              />
            )}
          </Field>
          <Field label="Ajustement manuel (€)">
            {(id) => (
              <input
                id={id}
                name="adjustment"
                type="number"
                min="-999999999"
                max="999999999"
                step=".01"
                required
                defaultValue={item?.adjustment || "0"}
              />
            )}
          </Field>
          <Field label="Motif de l’ajustement">
            {(id) => (
              <textarea
                id={id}
                name="adjustment_reason"
                maxLength={1000}
                rows={2}
                defaultValue={item?.adjustment_reason || ""}
              />
            )}
          </Field>
          <div className="radar-full">
            <Field label="Justification du droit à rémunération">
              {(id) => (
                <textarea
                  id={id}
                  name="justification"
                  maxLength={5000}
                  rows={3}
                  placeholder="Contrat, conditions remplies et référence du dossier. Nécessaire avant validation."
                  defaultValue={item?.justification || ""}
                />
              )}
            </Field>
          </div>
          <div className="radar-full">
            <Field label="Notes du revenu">
              {(id) => (
                <textarea
                  id={id}
                  name="notes"
                  rows={3}
                  maxLength={5000}
                  defaultValue={item?.notes || ""}
                />
              )}
            </Field>
          </div>
        </fieldset>
        <p className="notice">
          Les montants HT, TTC et contractuels restent séparés. L’outil ne
          déduit pas de TVA, d’impôt ou de cotisations. Une prévision utilise le
          cumul déjà validé ; les autres prévisions ne sont pas empilées
          automatiquement.
        </p>
        <div className="commercial-actions finance-footer">
          <Button
            type="button"
            variant="outline"
            onClick={guard.close}
            disabled={lock.busy}
          >
            Annuler
          </Button>
          <Button disabled={lock.busy}>Enregistrer la prévision</Button>
        </div>
      </form>
    </Modal>
  );
}
