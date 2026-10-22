import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../../api";
import { useFormGuard } from "../FormGuard";
import { Field, useSubmitLock } from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { parisInput } from "../radar/types";
import { bases, type Plan } from "./types";

export function PlanForm({
  copy,
  onClose,
  onSaved,
}: {
  copy?: Plan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tiers, setTiers] = useState(() =>
    (copy?.tiers || [{ threshold: "0", rate: "" }]).map((t) => ({
      ...t,
      key: crypto.randomUUID(),
    })),
  );
  const [method, setMethod] = useState(copy?.method || "marginal");
  const [error, setError] = useState("");
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/finance/plans", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          method,
          effective_to: values.effective_to || null,
          opening_on: values.opening_on || null,
          tiers: tiers.map(({ threshold, rate }) => ({ threshold, rate })),
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
      onClose={guard.close}
      title="Nouveau barème contractuel"
      description="Conditions à recopier depuis votre contrat. Un barème enregistré est figé ; de nouvelles conditions nécessitent un nouveau barème et un cumul repris explicite."
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
        <fieldset disabled={lock.busy} className="radar-form-grid">
          <Field label="Nom du barème">
            {(id) => (
              <input
                id={id}
                name="name"
                required
                minLength={3}
                maxLength={180}
                defaultValue={copy ? copy.name + " · copie" : ""}
              />
            )}
          </Field>
          <Field label="Partenaire du contrat">
            {(id) => (
              <input
                id={id}
                name="partner"
                required
                minLength={2}
                maxLength={180}
                defaultValue={copy?.partner || ""}
              />
            )}
          </Field>
          <Field label="Assiette prévue au contrat">
            {(id) => (
              <input
                id={id}
                name="base_label"
                required
                minLength={3}
                maxLength={180}
                placeholder="Ex. honoraires agence HT, prix de vente…"
                defaultValue={copy?.base_label || ""}
              />
            )}
          </Field>
          <Field label="Présentation des montants calculés">
            {(id) => (
              <select
                id={id}
                name="amount_basis"
                defaultValue={copy?.amount_basis || "contract"}
              >
                {Object.entries(bases).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Méthode des paliers">
            {(id) => (
              <select
                id={id}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="marginal">Par tranche (marginal)</option>
                <option value="global">Global avec rattrapage du cumul</option>
              </select>
            )}
          </Field>
          <Field label="Période du cumul contractuel">
            {(id) => (
              <select
                id={id}
                name="period"
                defaultValue={copy?.period || "year"}
              >
                <option value="year">Année civile</option>
                <option value="month">Mois civil</option>
              </select>
            )}
          </Field>
          <Field label="Applicable à partir du">
            {(id) => (
              <input
                id={id}
                name="effective_from"
                type="date"
                required
                defaultValue={copy?.effective_from || parisInput().slice(0, 10)}
              />
            )}
          </Field>
          <Field label="Applicable jusqu’au (facultatif)">
            {(id) => (
              <input
                id={id}
                name="effective_to"
                type="date"
                defaultValue={copy?.effective_to || ""}
              />
            )}
          </Field>
          <Field label="Cumul antérieur repris (assiettes en €)">
            {(id) => (
              <input
                id={id}
                name="opening_base"
                type="number"
                min="0"
                max="999999999"
                step=".01"
                required
                defaultValue="0"
              />
            )}
          </Field>
          <Field label="Date de reprise du cumul">
            {(id) => (
              <input
                id={id}
                name="opening_on"
                type="date"
                max={parisInput().slice(0, 10)}
              />
            )}
          </Field>
        </fieldset>
        <p className="notice">
          Le cumul est celui des assiettes contractuelles validées avec ce
          barème, pas votre revenu fiscal. Une reprise chiffrée s’applique
          seulement à sa période ; le compteur repart sans reprise sur la
          période suivante.
        </p>
        <h3 className="radar-section-title">Vos paliers</h3>
        {tiers.map((tier, index) => (
          <div key={tier.key} className="finance-tier-row">
            <Field label={`À partir de (€) · palier ${index + 1}`}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  required
                  min="0"
                  max="999999999"
                  step=".01"
                  value={tier.threshold}
                  disabled={index === 0 || lock.busy}
                  onChange={(e) =>
                    setTiers((rows) =>
                      rows.map((t) =>
                        t.key === tier.key
                          ? { ...t, threshold: e.target.value }
                          : t,
                      ),
                    )
                  }
                />
              )}
            </Field>
            <Field label={`Taux (%) · palier ${index + 1}`}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  required
                  min="0"
                  max="100"
                  step=".0001"
                  value={tier.rate}
                  disabled={lock.busy}
                  onChange={(e) =>
                    setTiers((rows) =>
                      rows.map((t) =>
                        t.key === tier.key ? { ...t, rate: e.target.value } : t,
                      ),
                    )
                  }
                />
              )}
            </Field>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Retirer le palier ${index + 1}`}
              disabled={!index || lock.busy}
              onClick={() => {
                setTiers((rows) => rows.filter((t) => t.key !== tier.key));
                guard.markDirty();
              }}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={lock.busy || tiers.length >= 20}
          onClick={() => {
            setTiers((rows) => [
              ...rows,
              { key: crypto.randomUUID(), threshold: "", rate: "" },
            ]);
            guard.markDirty();
          }}
        >
          Ajouter un palier
        </Button>
        <p className="commercial-status">
          {method === "global"
            ? "Global : droits sur le cumul après opération moins droits sur le cumul avant, avec rattrapage. Les taux doivent être non décroissants."
            : "Marginal : chaque part de l’assiette reçoit le taux de sa tranche, sans recalcul des opérations précédentes."}
        </p>
        <Field label="Référence du contrat / précisions">
          {(id) => (
            <textarea
              id={id}
              name="notes"
              rows={3}
              maxLength={5000}
              defaultValue={copy?.notes || ""}
              disabled={lock.busy}
            />
          )}
        </Field>
        <div className="commercial-actions finance-footer">
          <Button
            type="button"
            variant="outline"
            onClick={guard.close}
            disabled={lock.busy}
          >
            Annuler
          </Button>
          <Button disabled={lock.busy}>Enregistrer le barème</Button>
        </div>
      </form>
    </Modal>
  );
}
