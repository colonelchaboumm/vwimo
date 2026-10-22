import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { useFormGuard } from "../FormGuard";
import { Field, useSubmitLock } from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { partnerKinds, type Partner } from "./types";

export function PartnerForm({
  item,
  onClose,
  onSaved,
}: {
  item?: Partner;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/partners" + (item ? "/" + item.id : ""), {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({
          ...values,
          version: item?.version,
          email: values.email || null,
          archived: values.archived === "on",
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
      title={item ? "Modifier le partenaire" : "Nouveau partenaire"}
      onClose={guard.close}
      description="Coordonnées et conditions déclarées. Aucun contrôle d’agrément ni échange externe n’est effectué."
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
          <Field label="Nom / société du partenaire">
            {(id) => (
              <input
                id={id}
                name="name"
                required
                minLength={2}
                maxLength={180}
                defaultValue={item?.name || ""}
              />
            )}
          </Field>
          <Field label="Type de partenaire">
            {(id) => (
              <select id={id} name="kind" defaultValue={item?.kind || "broker"}>
                {Object.entries(partnerKinds).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Interlocuteur">
            {(id) => (
              <input
                id={id}
                name="representative"
                maxLength={180}
                defaultValue={item?.representative || ""}
              />
            )}
          </Field>
          <Field label="E-mail du partenaire">
            {(id) => (
              <input
                id={id}
                name="email"
                type="email"
                maxLength={254}
                defaultValue={item?.email || ""}
              />
            )}
          </Field>
          <Field label="Téléphone du partenaire">
            {(id) => (
              <input
                id={id}
                name="phone"
                type="tel"
                maxLength={30}
                defaultValue={item?.phone || ""}
              />
            )}
          </Field>
          <Field label="Ville du partenaire">
            {(id) => (
              <input
                id={id}
                name="city"
                maxLength={100}
                defaultValue={item?.city || ""}
              />
            )}
          </Field>
          <div className="radar-full">
            <Field label="Accord / conditions du partenariat">
              {(id) => (
                <textarea
                  id={id}
                  name="agreement"
                  rows={4}
                  maxLength={5000}
                  defaultValue={item?.agreement || ""}
                />
              )}
            </Field>
          </div>
          <div className="radar-full">
            <Field label="Notes du partenaire">
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
          <label className="commercial-check">
            <input
              type="checkbox"
              name="archived"
              defaultChecked={item?.archived || false}
            />
            Archiver ce partenaire (historique conservé)
          </label>
        </fieldset>
        <div className="notice">
          Les rémunérations se configurent dans Commissions & revenus, selon vos
          accords réels. Une fiche partenaire ne vaut pas autorisation d’exercer
          ou d’envoyer des données.
        </div>
        <div className="commercial-actions finance-footer">
          <Button
            type="button"
            variant="outline"
            disabled={lock.busy}
            onClick={guard.close}
          >
            Annuler
          </Button>
          <Button disabled={lock.busy}>Enregistrer le partenaire</Button>
        </div>
      </form>
    </Modal>
  );
}
