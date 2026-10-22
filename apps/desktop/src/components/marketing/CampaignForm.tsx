import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { useFormGuard } from "../FormGuard";
import { Field, useSubmitLock } from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { segments, type Campaign } from "./types";

export function CampaignForm({
  item,
  copy,
  onClose,
  onSaved,
}: {
  item?: Campaign;
  copy?: Campaign;
  onClose: () => void;
  onSaved: () => void;
}) {
  const seed = item || copy;
  const [error, setError] = useState("");
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/marketing/campaigns" + (item ? "/" + item.id : ""), {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({
          ...values,
          version: item?.version,
          sender_email: values.sender_email || null,
          reply_to: values.reply_to || null,
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
      title={
        item
          ? "Modifier le brouillon newsletter"
          : "Nouveau brouillon newsletter"
      }
      onClose={guard.close}
      description="Enregistrement local. Vous pourrez préparer un fichier individuel après contrôle des préférences ; aucun envoi n’est exécuté."
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
          <Field label="Référence de campagne">
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
          <Field label="Nom du brouillon">
            {(id) => (
              <input
                id={id}
                name="title"
                required
                minLength={3}
                maxLength={180}
                defaultValue={
                  copy ? copy.title + " · copie" : item?.title || ""
                }
              />
            )}
          </Field>
          <Field label="Segment newsletter">
            {(id) => (
              <select
                id={id}
                name="segment"
                defaultValue={seed?.segment || "buyers"}
              >
                {Object.entries(segments).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Objet du message">
            {(id) => (
              <input
                id={id}
                name="subject"
                maxLength={180}
                defaultValue={seed?.subject || ""}
              />
            )}
          </Field>
          <Field label="Nom de l’expéditeur">
            {(id) => (
              <input
                id={id}
                name="sender_name"
                maxLength={180}
                defaultValue={seed?.sender_name || ""}
              />
            )}
          </Field>
          <Field label="E-mail de l’expéditeur">
            {(id) => (
              <input
                id={id}
                name="sender_email"
                type="email"
                maxLength={254}
                defaultValue={seed?.sender_email || ""}
              />
            )}
          </Field>
          <Field label="Adresse de réponse (facultatif)">
            {(id) => (
              <input
                id={id}
                name="reply_to"
                type="email"
                maxLength={254}
                defaultValue={seed?.reply_to || ""}
              />
            )}
          </Field>
          <div className="radar-full">
            <Field label="Texte de la newsletter">
              {(id) => (
                <textarea
                  id={id}
                  name="body"
                  rows={9}
                  maxLength={20000}
                  defaultValue={seed?.body || ""}
                />
              )}
            </Field>
          </div>
          <div className="radar-full">
            <Field label="Signature, identité et consignes de désinscription">
              {(id) => (
                <textarea
                  id={id}
                  name="footer"
                  rows={4}
                  maxLength={5000}
                  defaultValue={seed?.footer || ""}
                />
              )}
            </Field>
          </div>
          <label className="commercial-check">
            <input
              name="archived"
              type="checkbox"
              defaultChecked={item?.archived || false}
            />
            Archiver ce brouillon
          </label>
        </fieldset>
        <p className="notice">
          La variable {"{nom}"} insère le nom complet du contact dans l’objet et
          le texte. Les brouillons incomplets peuvent être enregistrés ;
          l’export exige un objet, un message, un expéditeur et une signature.
          Le fichier contiendra aussi une consigne de désinscription par réponse
          à l’e-mail de l’expéditeur ou à l’adresse de réponse renseignée.
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
          <Button disabled={lock.busy}>Enregistrer le brouillon</Button>
        </div>
      </form>
    </Modal>
  );
}
