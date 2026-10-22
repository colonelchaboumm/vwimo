import { useState, type FormEvent } from "react";
import { api } from "../../api";
import type { Contact } from "../../types";
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
import { permissionStates, type Permission, type Exclusion } from "./types";

function PermissionEditor({
  contact,
  current,
  onClose,
  onSaved,
}: {
  contact: Contact;
  current: Permission;
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
      await api("/marketing/permissions/" + contact.id, {
        method: "PUT",
        body: JSON.stringify({
          ...values,
          version: current.version,
          declared_on: values.declared_on || null,
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
      title={"Préférence newsletter · " + contact.name}
      onClose={guard.close}
      description="Déclaration spécifique aux newsletters. Les autorisations de courtage ou de prospection ne sont pas réutilisées."
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
        <p className="commercial-status">
          Adresse actuelle : {current.current_email || "absente"}
          <br />
          Adresse de la dernière déclaration :{" "}
          {current.email_snapshot || "aucune"}
        </p>
        <fieldset disabled={lock.busy} className="radar-form-grid">
          <Field label="Préférence newsletter">
            {(id) => (
              <select id={id} name="state" defaultValue={current.state}>
                {Object.entries(permissionStates).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Date de la préférence newsletter">
            {(id) => (
              <input
                id={id}
                name="declared_on"
                type="date"
                max={parisInput().slice(0, 10)}
                defaultValue={current.declared_on || parisInput().slice(0, 10)}
              />
            )}
          </Field>
          <div className="radar-full">
            <Field label="Justification de la préférence newsletter">
              {(id) => (
                <textarea
                  id={id}
                  name="note"
                  rows={4}
                  maxLength={1000}
                  defaultValue={current.note}
                />
              )}
            </Field>
          </div>
        </fieldset>
        <p className="notice">
          Un refus ou retrait crée une exclusion pour l’adresse actuelle et
          l’ancienne adresse autorisée. Déclarer ensuite un accord ne lève pas
          cette exclusion. Un changement d’e-mail impose une nouvelle
          vérification de l’autorisation.
        </p>
        <Button disabled={lock.busy}>
          Enregistrer la préférence newsletter
        </Button>
      </form>
    </Modal>
  );
}
export function PermissionForm(props: {
  contact: Contact;
  readonly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const resource = useResource<Permission>(
    "/marketing/permissions/" + props.contact.id,
  );
  if (resource.data && props.readonly)
    return (
      <Modal
        open
        title={"Préférence newsletter · " + props.contact.name}
        onClose={props.onClose}
      >
        <p>{permissionStates[resource.data.state]}</p>
        <p className="commercial-status">
          {resource.data.current_email || "Adresse absente"}
        </p>
        <p className="marketing-text">
          {resource.data.note || "Aucune déclaration"}
        </p>
      </Modal>
    );
  return resource.data ? (
    <PermissionEditor {...props} current={resource.data} />
  ) : (
    <Modal open title="Chargement de la préférence" onClose={props.onClose}>
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
    </Modal>
  );
}
export function ExclusionForm({
  item,
  admin,
  onClose,
  onSaved,
}: {
  item?: Exclusion;
  admin: boolean;
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
      await api("/marketing/exclusions" + (item ? "/" + item.id : ""), {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({
          ...values,
          version: item?.version,
          blocked: values.blocked === "on",
          confirm_unblock: values.confirm_unblock === "on",
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
      title={item ? "Modifier l’exclusion e-mail" : "Nouvelle exclusion e-mail"}
      onClose={guard.close}
      description="La liste d’exclusion s’applique à toutes les fiches utilisant la même adresse."
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
          <Field label="Adresse e-mail à exclure">
            {(id) => (
              <input
                id={id}
                name="email"
                type="email"
                required
                maxLength={254}
                defaultValue={item?.email || ""}
                readOnly={!!item}
              />
            )}
          </Field>
          <Field label="Date de l’exclusion / révision">
            {(id) => (
              <input
                id={id}
                name="declared_on"
                type="date"
                required
                max={parisInput().slice(0, 10)}
                defaultValue={parisInput().slice(0, 10)}
              />
            )}
          </Field>
          <div className="radar-full">
            <Field label="Motif de l’exclusion / révision">
              {(id) => (
                <textarea
                  id={id}
                  name="note"
                  rows={4}
                  required
                  minLength={10}
                  maxLength={1000}
                  defaultValue={item?.note || ""}
                />
              )}
            </Field>
          </div>
          <label className="commercial-check">
            <input
              type="checkbox"
              name="blocked"
              defaultChecked={item?.blocked ?? true}
            />
            Bloquer cette adresse
          </label>
          {item && admin && (
            <label className="commercial-check">
              <input type="checkbox" name="confirm_unblock" />
              Je confirme la levée de cette exclusion après vérification.
            </label>
          )}
        </fieldset>
        <p className="notice">
          Seul le propriétaire ou un administrateur peut lever une exclusion.
          Les préférences individuelles « refus » ou « retrait » continuent de
          bloquer l’adresse : une levée ne crée pas d’autorisation newsletter.
        </p>
        <Button disabled={lock.busy}>Enregistrer l’exclusion</Button>
      </form>
    </Modal>
  );
}
