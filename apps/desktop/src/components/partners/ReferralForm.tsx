import { useState, type FormEvent } from "react";
import { api } from "../../api";
import type { Contact } from "../../types";
import type { Transaction } from "../finance/types";
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
  financingLabels,
  permissions,
  referralKinds,
  referralStages,
  type Partner,
  type Referral,
} from "./types";

export function ReferralForm({
  item,
  initialPartner,
  contacts,
  onClose,
  onSaved,
}: {
  item?: Referral;
  initialPartner?: Partner;
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState(
    item?.kind || (initialPartner?.kind === "broker" ? "broker" : "referral"),
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(
    item?.partner_id || initialPartner?.id || "",
  );
  const [error, setError] = useState("");
  const partners = useResource<{ items: Partner[]; total: number }>(
    "/partners?limit=100&q=" + encodeURIComponent(query),
  );
  const transactions = useResource<{ items: Transaction[]; total: number }>(
    "/transactions?limit=100",
  );
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  const frozen = !!item?.transferred_on;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/referrals" + (item ? "/" + item.id : ""), {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({
          ...values,
          version: item?.version,
          kind,
          partner_id: selected,
          financing: kind === "broker" ? values.financing : "unknown",
          transaction_id: values.transaction_id || null,
          transferred_on: values.transferred_on || null,
          permission_on: values.permission_on || null,
          next_action_on: values.next_action_on || null,
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
      title={
        item ? "Modifier la mise en relation" : "Nouveau dossier partenaire"
      }
      onClose={guard.close}
      description="Suivi d’actions effectuées hors de l’outil. Aucun message ni transfert de coordonnées n’est envoyé."
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
        <ResourceState
          error={partners.error}
          loading={partners.loading}
          retry={partners.refresh}
        />
        <ResourceState
          error={transactions.error}
          loading={transactions.loading}
          retry={transactions.refresh}
        />
        {frozen && (
          <p className="notice">
            Après la mise en relation, les liens, l’origine et les dates
            effectuées restent conservés. Le suivi, le résultat et un retrait
            d’autorisation peuvent être mis à jour.
          </p>
        )}
        <fieldset disabled={lock.busy} className="radar-form-grid">
          <Field label="Référence du dossier partenaire">
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
          <Field label="Libellé de la mise en relation">
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
          <Field label="Type de dossier partenaire">
            {(id) => (
              <select
                id={id}
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                disabled={frozen}
              >
                {Object.entries(referralKinds).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Rechercher un partenaire actif">
            {(id) => (
              <input
                id={id}
                value={query}
                maxLength={180}
                onChange={(e) => setQuery(e.target.value)}
                disabled={frozen}
              />
            )}
          </Field>
          <Field label="Partenaire du dossier">
            {(id) => (
              <select
                id={id}
                required
                value={selected}
                disabled={frozen}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Choisir un partenaire</option>
                {selected &&
                  !partners.data?.items.some((p) => p.id === selected) && (
                    <option value={selected}>
                      {item?.partner_name ||
                        initialPartner?.name ||
                        "Partenaire sélectionné hors filtre"}
                    </option>
                  )}
                {partners.data?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Contact recommandé / acquéreur">
            {(id) => (
              <select
                id={id}
                name="contact_id"
                required
                defaultValue={item?.contact_id || ""}
                disabled={frozen}
              >
                <option value="">Choisir un contact</option>
                {item?.contact_id &&
                  !contacts.some((c) => c.id === item.contact_id) && (
                    <option value={item.contact_id}>
                      {item.contact_name} · hors liste active
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
          {frozen && (
            <input type="hidden" name="contact_id" value={item.contact_id} />
          )}
          <Field label="Transaction du dossier (facultatif)">
            {(id) => (
              <select
                id={id}
                name="transaction_id"
                defaultValue={item?.transaction_id || ""}
                disabled={frozen}
              >
                <option value="">Aucune transaction liée</option>
                {item?.transaction_id &&
                  !transactions.data?.items.some(
                    (t) => t.id === item.transaction_id,
                  ) && (
                    <option value={item.transaction_id}>
                      Transaction liée hors liste
                    </option>
                  )}
                {transactions.data?.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.reference}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {frozen && (
            <input
              type="hidden"
              name="transaction_id"
              value={item.transaction_id || ""}
            />
          )}
          <Field label="Origine de la recommandation">
            {(id) => (
              <input
                id={id}
                name="source"
                required
                minLength={2}
                maxLength={180}
                defaultValue={item?.source || ""}
                readOnly={frozen}
              />
            )}
          </Field>
          <Field label="Projet / besoin du client">
            {(id) => (
              <input
                id={id}
                name="project"
                required
                minLength={3}
                maxLength={180}
                defaultValue={item?.project || ""}
              />
            )}
          </Field>
          <Field label="Date d’ouverture du dossier partenaire">
            {(id) => (
              <input
                id={id}
                name="introduced_on"
                type="date"
                required
                max={parisInput().slice(0, 10)}
                defaultValue={item?.introduced_on || parisInput().slice(0, 10)}
                readOnly={frozen}
              />
            )}
          </Field>
          <Field label="Étape du dossier partenaire">
            {(id) => (
              <select
                id={id}
                name="stage"
                defaultValue={item?.stage || "draft"}
              >
                {Object.entries(referralStages).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Date de mise en relation effectuée">
            {(id) => (
              <input
                id={id}
                name="transferred_on"
                type="date"
                max={parisInput().slice(0, 10)}
                defaultValue={item?.transferred_on || ""}
                readOnly={frozen}
              />
            )}
          </Field>
          <Field label="Autorisation du client">
            {(id) => (
              <select
                id={id}
                name="permission"
                defaultValue={item?.permission || "unknown"}
              >
                {Object.entries(permissions).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Date d’autorisation / refus / retrait">
            {(id) => (
              <input
                id={id}
                name="permission_on"
                type="date"
                max={parisInput().slice(0, 10)}
                defaultValue={item?.permission_on || ""}
              />
            )}
          </Field>
          <div className="radar-full">
            <Field label="Justificatif déclaré de l’autorisation / refus / retrait">
              {(id) => (
                <textarea
                  id={id}
                  name="permission_note"
                  maxLength={1000}
                  rows={3}
                  defaultValue={item?.permission_note || ""}
                />
              )}
            </Field>
          </div>
          {kind === "broker" && (
            <Field label="Financement du dossier de courtage">
              {(id) => (
                <select
                  id={id}
                  name="financing"
                  defaultValue={item?.financing || "unknown"}
                >
                  {Object.entries(financingLabels).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Prochaine action à examiner">
            {(id) => (
              <input
                id={id}
                name="next_action_on"
                type="date"
                defaultValue={item?.next_action_on || ""}
              />
            )}
          </Field>
          <div className="radar-full">
            <Field label="Résultat / motif de clôture">
              {(id) => (
                <textarea
                  id={id}
                  name="outcome"
                  rows={3}
                  maxLength={1000}
                  defaultValue={item?.outcome || ""}
                />
              )}
            </Field>
          </div>
          <div className="radar-full">
            <Field label="Notes du dossier partenaire">
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
        {partners.data && partners.data.total > 100 && (
          <p className="notice">
            100 partenaires maximum proposés : utilisez la recherche pour
            retrouver les autres.
          </p>
        )}
        <p className="notice">
          La date de transmission décrit une action déjà effectuée hors de
          l’outil. Son premier enregistrement exige une autorisation client
          datée et justifiée. Les rémunérations doivent être vérifiées selon vos
          accords et votre activité ; elles sont saisies séparément dans
          Commissions & revenus.
        </p>
        <div className="commercial-actions finance-footer">
          <Button
            type="button"
            variant="outline"
            disabled={lock.busy}
            onClick={guard.close}
          >
            Annuler
          </Button>
          <Button
            disabled={
              lock.busy ||
              partners.loading ||
              transactions.loading ||
              !!partners.error ||
              !!transactions.error
            }
          >
            Enregistrer le dossier partenaire
          </Button>
        </div>
      </form>
    </Modal>
  );
}
