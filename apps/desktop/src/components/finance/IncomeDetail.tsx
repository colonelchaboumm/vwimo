import { useRef, useState, type FormEvent } from "react";
import { api } from "../../api";
import { dateText } from "../../lib/utils";
import { financeMoney as money } from "./types";
import { useFormGuard } from "../FormGuard";
import {
  Field,
  ResourceState,
  useResource,
  useSubmitLock,
} from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { parisInput } from "../radar/types";
import {
  bases,
  incomeStatuses,
  type Calculation,
  type Income,
  type Payment,
} from "./types";

export function CalculationView({ value }: { value: Calculation }) {
  return (
    <div className="finance-calculation">
      <strong>{money(value.amount)}</strong>
      <p>
        {value.plan_name || "Montant fixe saisi"}
        {value.base_label ? " · " + value.base_label : ""}
      </p>
      {value.referral_reference && (
        <p>Dossier partenaire : {value.referral_reference}</p>
      )}
      {value.cumulative_before !== undefined && (
        <p>
          Cumul des assiettes avant : {money(value.cumulative_before)}
          <br />
          Assiette de l’opération : {money(value.base || "0")}
          <br />
          Cumul après : {money(value.cumulative_after || "0")}
        </p>
      )}
      {value.segments?.map((segment, index) => (
        <p key={index}>
          Tranche : {money(segment.base)} × {segment.rate} %
        </p>
      ))}
      {value.method === "global" && (
        <p>
          Droits cumulés après ({value.after_rate} %) :{" "}
          {money(value.entitlement_after || "0")}
          <br />
          Moins droits avant ({value.before_rate} %) :{" "}
          {money(value.entitlement_before || "0")}
          <br />
          Le rattrapage concerne aussi le cumul antérieur de cette période.
        </p>
      )}
      <p>
        Ajustement : {money(value.adjustment)}
        {value.adjustment_reason ? " · " + value.adjustment_reason : ""}
        <br />
        {value.rounding || "Calcul au centime"}
      </p>
    </div>
  );
}
type Detail = Income & { payments: Payment[] };
type Quote = { calculation: Calculation; digest: string };
function DetailForm({
  initial,
  readonly,
  onClose,
  onChanged,
}: {
  initial: Detail;
  readonly: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState(initial);
  const [earnedOn, setEarnedOn] = useState(parisInput().slice(0, 10));
  const [quote, setQuote] = useState<Quote | null>(null);
  const [consent, setConsent] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  const pending = useRef<{ key: string; id: string } | null>(null);
  function requestId(key: string) {
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    return pending.current.id;
  }
  async function calculate(e: FormEvent) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    setConsent(false);
    try {
      setQuote(
        await api<Quote>(
          "/finance/incomes/" + current.id + "/quote?earned_on=" + earnedOn,
        ),
      );
    } catch (e) {
      setQuote(null);
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  async function acquire() {
    if (!quote || !consent || !lock.start()) return;
    setError("");
    const body = {
      version: current.version,
      earned_on: earnedOn,
      digest: quote.digest,
    };
    try {
      const value = await api<Income>(
        "/finance/incomes/" + current.id + "/acquire",
        {
          method: "POST",
          body: JSON.stringify({
            ...body,
            request_id: requestId(JSON.stringify(body)),
          }),
        },
      );
      setCurrent({ ...value, payments: current.payments });
      setQuote(null);
      setConsent(false);
      pending.current = null;
      guard.clean();
      setNotice(
        "Revenu validé selon votre déclaration. Aucun encaissement ni facture créé.",
      );
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  async function payment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const key = JSON.stringify(values);
    const id = requestId(key);
    try {
      const value = await api<Income>(
        "/finance/incomes/" + current.id + "/payments",
        {
          method: "POST",
          body: JSON.stringify({
            ...values,
            version: current.version,
            request_id: id,
          }),
        },
      );
      const payment = {
        id,
        paid_on: String(values.paid_on),
        amount: String(values.amount),
        reference: String(values.reference),
      };
      setCurrent({
        ...value,
        payments: current.payments.some((p) => p.id === id)
          ? current.payments
          : [...current.payments, payment].sort((a, b) =>
              a.paid_on.localeCompare(b.paid_on),
            ),
      });
      pending.current = null;
      form.reset();
      guard.clean();
      setNotice(
        "Encaissement déclaré enregistré. Aucun paiement bancaire déclenché.",
      );
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  async function cancelForecast() {
    if (!lock.start()) return;
    setError("");
    try {
      const value = await api<Income>(
        "/finance/incomes/" + current.id + "/cancel?version=" + current.version,
        { method: "POST" },
      );
      setCurrent({ ...value, payments: current.payments });
      setCancel(false);
      guard.clean();
      onChanged();
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
      title={current.reference + " · " + current.title}
      onClose={guard.close}
      description="Montants déclarés et calcul contractuel conservé. Ce suivi n’est ni une facture ni une déclaration fiscale."
    >
      {guard.notice}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <p className="commercial-status">
        {incomeStatuses[current.status]} · {bases[current.amount_basis]} ·{" "}
        {current.partner}
      </p>
      <CalculationView value={current.calculation} />
      {current.status === "forecast" && (
        <p className="notice">
          Calcul prévisionnel conservé lors du dernier enregistrement. Les
          autres validations peuvent modifier le cumul : recalculez avant de
          confirmer.
        </p>
      )}
      <p className="commercial-status">
        Justification : {current.justification || "non renseignée"}
      </p>
      {current.status === "forecast" && !readonly && (
        <>
          <form
            className="commercial-form"
            onSubmit={calculate}
            onChange={guard.markDirty}
          >
            <Field label="Date réelle de validation du revenu">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  required
                  max={parisInput().slice(0, 10)}
                  disabled={lock.busy}
                  value={earnedOn}
                  onChange={(e) => {
                    setEarnedOn(e.target.value);
                    setQuote(null);
                    setConsent(false);
                  }}
                />
              )}
            </Field>
            <Button className="finance-footer" disabled={lock.busy}>
              Recalculer avant validation
            </Button>
          </form>
          {quote && (
            <div className="finance-quote">
              <h3>Calcul à confirmer</h3>
              <CalculationView value={quote.calculation} />
              <label className="commercial-check">
                <input
                  type="checkbox"
                  disabled={lock.busy}
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    guard.markDirty();
                  }}
                />
                Je confirme ce calcul et mon droit à rémunération à cette date.
              </label>
              <Button
                disabled={!consent || lock.busy}
                onClick={() => void acquire()}
              >
                Confirmer le revenu validé
              </Button>
            </div>
          )}
          <div className="commercial-actions finance-footer">
            <Button
              variant="destructive"
              disabled={lock.busy}
              onClick={() => (cancel ? void cancelForecast() : setCancel(true))}
            >
              {cancel
                ? "Confirmer l’annulation de la prévision"
                : "Annuler cette prévision"}
            </Button>
          </div>
        </>
      )}
      {current.status === "acquired" && (
        <>
          <div className="prospect-stats">
            <div className="panel">
              <span>Encaissements déclarés</span>
              <strong>{money(current.paid)}</strong>
            </div>
            <div className="panel">
              <span>Reste à encaisser</span>
              <strong>{money(current.remaining)}</strong>
            </div>
          </div>
          <h3 className="radar-section-title">Encaissements enregistrés</h3>
          <ul className="finance-payments">
            {current.payments.map((p) => (
              <li key={p.id}>
                <strong>{money(p.amount)}</strong> · {dateText(p.paid_on)}
                <small>{p.reference}</small>
              </li>
            ))}
          </ul>
          {!readonly && Number(current.remaining) > 0 && (
            <form
              className="commercial-form"
              onSubmit={payment}
              onChange={guard.markDirty}
            >
              <h3 className="radar-section-title">
                Déclarer un encaissement reçu
              </h3>
              <fieldset className="radar-form-grid" disabled={lock.busy}>
                <Field label="Montant encaissé (€)">
                  {(id) => (
                    <input
                      id={id}
                      name="amount"
                      required
                      type="number"
                      min=".01"
                      max={current.remaining}
                      step=".01"
                    />
                  )}
                </Field>
                <Field label="Date de l’encaissement">
                  {(id) => (
                    <input
                      id={id}
                      name="paid_on"
                      required
                      type="date"
                      min={current.earned_on || undefined}
                      max={parisInput().slice(0, 10)}
                      defaultValue={parisInput().slice(0, 10)}
                    />
                  )}
                </Field>
                <div className="radar-full">
                  <Field label="Référence / preuve de l’encaissement">
                    {(id) => (
                      <input
                        id={id}
                        name="reference"
                        required
                        minLength={3}
                        maxLength={180}
                      />
                    )}
                  </Field>
                </div>
              </fieldset>
              <Button disabled={lock.busy}>
                Enregistrer l’encaissement déclaré
              </Button>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
export function IncomeDetail({
  item,
  readonly,
  onClose,
  onChanged,
}: {
  item: Income;
  readonly: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const resource = useResource<Detail>("/finance/incomes/" + item.id);
  return resource.data ? (
    <DetailForm
      initial={resource.data}
      readonly={readonly}
      onClose={onClose}
      onChanged={onChanged}
    />
  ) : (
    <Modal open title="Chargement du revenu" onClose={onClose}>
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
    </Modal>
  );
}
