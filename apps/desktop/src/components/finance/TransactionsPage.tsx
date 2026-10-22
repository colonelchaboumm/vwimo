import { useState, type FormEvent } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, saveFile } from "../../api";
import type { Contact, Doc, Mandate } from "../../types";
import { dateText } from "../../lib/utils";
import { financeMoney as money } from "./types";
import { useFormGuard } from "../FormGuard";
import {
  Field,
  ResourceState,
  useEditing,
  useResource,
  useSubmitLock,
} from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { parisInput } from "../radar/types";
import { transactionStages, type Transaction } from "./types";

function TransactionForm({
  item,
  mandates,
  contacts,
  onClose,
  onSaved,
}: {
  item?: Transaction;
  mandates: Mandate[];
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  const [mandateId, setMandateId] = useState(item?.mandate_id || "");
  const [price, setPrice] = useState(item?.sale_price || "");
  const [stage, setStage] = useState(item?.stage || "marketing");
  const [checklist, setChecklist] = useState(() =>
    (item?.checklist || []).map((v) => ({ ...v, key: crypto.randomUUID() })),
  );
  const seller = mandates.find((m) => m.id === mandateId)?.seller_id;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/transactions" + (item ? "/" + item.id : ""), {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({
          ...values,
          version: item?.version,
          mandate_id: mandateId,
          sale_price: price,
          stage,
          buyer_id: values.buyer_id || null,
          offer_on: values.offer_on || null,
          compromise_on: values.compromise_on || null,
          expected_deed_on: values.expected_deed_on || null,
          deed_on: values.deed_on || null,
          checklist: checklist.map(({ label, done }) => ({ label, done })),
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
      title={item ? "Modifier le dossier de vente" : "Nouveau dossier de vente"}
      description="Les étapes et dates sont déclarées. Ce dossier ne modifie pas automatiquement le mandat ou les revenus."
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
          <Field label="Référence de transaction">
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
          <Field label="Mandat de la transaction">
            {(id) => (
              <select
                id={id}
                required
                disabled={!!item}
                value={mandateId}
                onChange={(e) => {
                  setMandateId(e.target.value);
                  setPrice(
                    mandates.find((m) => m.id === e.target.value)?.price || "",
                  );
                }}
              >
                <option value="">Choisir un mandat</option>
                {mandates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.reference} · {m.property.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Acquéreur du dossier">
            {(id) => (
              <select
                id={id}
                name="buyer_id"
                defaultValue={item?.buyer_id || ""}
              >
                <option value="">À renseigner</option>
                {item?.buyer_id &&
                  !contacts.some(
                    (c) =>
                      c.id === item.buyer_id &&
                      ["buyer", "both"].includes(c.kind) &&
                      c.id !== seller,
                  ) && (
                    <option value={item.buyer_id}>
                      {item.buyer_name || "Acquéreur lié hors liste"}
                    </option>
                  )}
                {contacts
                  .filter(
                    (c) =>
                      ["buyer", "both"].includes(c.kind) && c.id !== seller,
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            )}
          </Field>
          <Field label="Étape de la transaction">
            {(id) => (
              <select
                id={id}
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                {Object.entries(transactionStages).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Prix de vente retenu (€)">
            {(id) => (
              <input
                id={id}
                type="number"
                min=".01"
                max="999999999"
                step=".01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            )}
          </Field>
          <Field label="Notaire / étude">
            {(id) => (
              <input
                id={id}
                name="notary"
                maxLength={180}
                defaultValue={item?.notary || ""}
              />
            )}
          </Field>
          {(
            [
              ["offer_on", "Date de l’offre effectuée"],
              ["compromise_on", "Date du compromis effectué"],
              ["expected_deed_on", "Acte prévu le"],
              ["deed_on", "Date de l’acte effectué"],
            ] as const
          ).map(([name, label]) => (
            <Field key={name} label={label}>
              {(id) => (
                <input
                  id={id}
                  name={name}
                  type="date"
                  required={name === "deed_on" && stage === "signed"}
                  max={
                    name === "expected_deed_on"
                      ? undefined
                      : parisInput().slice(0, 10)
                  }
                  defaultValue={item?.[name] || ""}
                />
              )}
            </Field>
          ))}
          <Field label="Financement déclaré">
            {(id) => (
              <select
                id={id}
                name="financing"
                defaultValue={item?.financing || "unknown"}
              >
                <option value="unknown">À vérifier</option>
                <option value="requested">Demandé</option>
                <option value="approved">Accord déclaré</option>
                <option value="refused">Refus déclaré</option>
              </select>
            )}
          </Field>
          <Field label="Conditions suspensives / échéances">
            {(id) => (
              <textarea
                id={id}
                name="conditions"
                rows={3}
                maxLength={5000}
                defaultValue={item?.conditions || ""}
              />
            )}
          </Field>
          <div className="radar-full">
            <Field label="Notes de transaction">
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
        <h3 className="radar-section-title">Pièces et actions à vérifier</h3>
        <p className="commercial-status">
          Votre propre liste de contrôle. Cocher une ligne ne vérifie pas
          automatiquement un document.
        </p>
        {checklist.map((row, index) => (
          <div className="finance-check-row" key={row.key}>
            <input
              aria-label={`Pièce vérifiée ${index + 1}`}
              type="checkbox"
              checked={row.done}
              disabled={lock.busy}
              onChange={(e) => {
                setChecklist((rows) =>
                  rows.map((v) =>
                    v.key === row.key ? { ...v, done: e.target.checked } : v,
                  ),
                );
                guard.markDirty();
              }}
            />
            <input
              aria-label={`Pièce ou action ${index + 1}`}
              minLength={2}
              maxLength={180}
              required
              value={row.label}
              disabled={lock.busy}
              onChange={(e) =>
                setChecklist((rows) =>
                  rows.map((v) =>
                    v.key === row.key ? { ...v, label: e.target.value } : v,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Retirer la pièce ${index + 1}`}
              disabled={lock.busy}
              onClick={() => {
                setChecklist((rows) => rows.filter((v) => v.key !== row.key));
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
          disabled={lock.busy || checklist.length >= 30}
          onClick={() => {
            setChecklist((rows) => [
              ...rows,
              { key: crypto.randomUUID(), label: "", done: false },
            ]);
            guard.markDirty();
          }}
        >
          Ajouter une pièce ou action
        </Button>
        <div className="commercial-actions finance-footer">
          <Button
            type="button"
            variant="outline"
            onClick={guard.close}
            disabled={lock.busy}
          >
            Annuler
          </Button>
          <Button disabled={lock.busy}>Enregistrer la transaction</Button>
        </div>
      </form>
    </Modal>
  );
}

function TransactionDocuments({
  item,
  onClose,
}: {
  item: Transaction;
  onClose: () => void;
}) {
  const resource = useResource<{ items: Doc[]; limited: boolean }>(
    "/transactions/" + item.id + "/documents",
  );
  const [error, setError] = useState("");
  async function download(doc: Doc) {
    try {
      saveFile(
        await api<Blob>("/documents/" + doc.id + "/download"),
        doc.filename,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      open
      title={"Documents · " + item.reference}
      onClose={onClose}
      description="Fichiers associés au mandat, au vendeur ou à l’acquéreur. Leur contenu n’est pas vérifié automatiquement."
    >
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {resource.data?.items.map((d) => (
        <p key={d.id} className="commercial-status">
          <Button variant="outline" onClick={() => void download(d)}>
            {d.filename}
          </Button>
        </p>
      ))}
      {resource.data && !resource.data.items.length && (
        <p className="commercial-status">
          Aucun fichier associé. Ajoutez les documents dans le module Documents.
        </p>
      )}
      {resource.data?.limited && (
        <p className="notice">200 fichiers maximum affichés.</p>
      )}
    </Modal>
  );
}

export function TransactionsPage({
  mandates,
  contacts,
  readonly,
  onEditing,
}: {
  mandates: Mandate[];
  contacts: Contact[];
  readonly: boolean;
  onEditing: (value: boolean) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [editor, setEditor] = useState<Transaction | "new" | null>(null);
  const [documents, setDocuments] = useState<Transaction | null>(null);
  const resource = useResource<{ items: Transaction[]; total: number }>(
    "/transactions?offset=" + offset,
  );
  useEditing(!!editor, onEditing);
  return (
    <section className="commercial-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">DU PROJET À LA SIGNATURE</div>
          <h1>Vos ventes, étape par étape.</h1>
          <p>
            Retrouvez les acquéreurs, dates, conditions et pièces de chaque
            transaction.
          </p>
        </div>
        <div className="commercial-actions">
          <Button variant="outline" onClick={resource.refresh}>
            <RefreshCw size={15} />
            Actualiser
          </Button>
          <Button
            disabled={readonly || !mandates.length}
            onClick={() => setEditor("new")}
          >
            <Plus size={15} />
            Nouvelle transaction
          </Button>
        </div>
      </div>
      <div className="notice">
        Un dossier non annulé par mandat. Les étapes sont déclaratives et ne
        changent ni le statut du mandat ni les montants financiers. Créez
        séparément les lignes de rémunération dans Commissions & revenus.
      </div>
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
      {resource.data && (
        <>
          <p className="commercial-status">
            {resource.data.total} dossier(s) · page{" "}
            {Math.floor(offset / 40) + 1}
          </p>
          <div className="commercial-grid">
            {resource.data.items.map((item) => (
              <article key={item.id} className="panel radar-card">
                <div className="match-top">
                  <span className="radar-pill">
                    {transactionStages[item.stage]}
                  </span>
                  <span>{item.reference}</span>
                </div>
                <h2>Mandat {item.mandate_reference}</h2>
                <p>
                  Acquéreur : {item.buyer_name || "à renseigner"}
                  <br />
                  Notaire : {item.notary || "à renseigner"}
                </p>
                <div className="radar-price">{money(item.sale_price)}</div>
                <p>
                  Acte prévu :{" "}
                  {item.expected_deed_on
                    ? dateText(item.expected_deed_on)
                    : "à renseigner"}
                  <br />
                  {item.unchecked} pièce(s)/action(s) à vérifier
                </p>
                {item.overdue && (
                  <p className="finance-alert">
                    Date d’acte prévue dépassée · à vérifier
                  </p>
                )}
                <div className="commercial-actions">
                  <Button
                    variant="outline"
                    disabled={readonly}
                    onClick={() => setEditor(item)}
                  >
                    Modifier la transaction
                  </Button>
                  <Button variant="ghost" onClick={() => setDocuments(item)}>
                    Documents du dossier
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {!resource.data.items.length && (
            <div className="panel radar-empty">
              <h2>Votre prochain dossier de vente.</h2>
              <p>Créez un dossier depuis un mandat déjà enregistré.</p>
            </div>
          )}
          <div className="commercial-actions radar-pagination">
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => setOffset((v) => Math.max(0, v - 40))}
            >
              Page précédente
            </Button>
            <Button
              variant="outline"
              disabled={offset + 40 >= resource.data.total}
              onClick={() => setOffset((v) => v + 40)}
            >
              Page suivante
            </Button>
          </div>
        </>
      )}
      {editor && (
        <TransactionForm
          item={editor === "new" ? undefined : editor}
          mandates={mandates}
          contacts={contacts}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            resource.refresh();
          }}
        />
      )}
      {documents && (
        <TransactionDocuments
          item={documents}
          onClose={() => setDocuments(null)}
        />
      )}
    </section>
  );
}
