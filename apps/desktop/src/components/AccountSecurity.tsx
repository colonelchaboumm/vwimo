import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useFormGuard } from "./FormGuard";
import {
  Field,
  ResourceState,
  useResource,
  useSubmitLock,
} from "./commercial/shared";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import "./account-security.css";

type Sessions = {
  total: number;
  limit: number;
  items: { created_at: string; expires_at: string; current: boolean }[];
};
const date = (value: string) =>
  new Date(value).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });

export function AccountSecurity({
  onClose,
  onSignedOut,
}: {
  onClose: () => void;
  onSignedOut: (message: string) => void;
}) {
  const resource = useResource<Sessions>("/auth/sessions");
  const [action, setAction] = useState("password");
  const [error, setError] = useState("");
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lock.start()) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError("");
    try {
      await api(
        `/auth/${action === "password" ? "change-password" : "revoke-sessions"}`,
        {
          method: "POST",
          body: JSON.stringify({
            current_password: fields.get("current_password"),
            confirmed: true,
            ...(action === "password"
              ? {
                  new_password: fields.get("new_password"),
                  password_confirmation: fields.get("password_confirmation"),
                }
              : {}),
          }),
        },
      );
      form.reset();
      guard.clean();
      onSignedOut(
        action === "password"
          ? "Mot de passe modifié. Toutes les sessions sont fermées. Connectez-vous avec votre nouveau mot de passe."
          : "Toutes les sessions sont fermées. Vous pouvez vous reconnecter.",
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      lock.end();
    }
  }
  return (
    <Modal
      open
      title="Sécurité de mon compte"
      onClose={guard.close}
      description="Vos identifiants restent enregistrés dans la base de votre espace."
    >
      {guard.notice}
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
      {resource.data && (
        <section aria-label="Sessions de mon compte">
          <h3>{resource.data.total} session(s) active(s)</h3>
          <p>
            Une session représente une connexion à l’outil, pas nécessairement
            un appareil différent. Horaires Europe/Paris.
          </p>
          <ul className="account-sessions">
            {resource.data.items.map((row, index) => (
              <li key={`${row.created_at}-${index}`}>
                <strong>
                  {row.current ? "Cette connexion" : "Autre connexion"}
                </strong>
                <small>
                  Ouverte le {date(row.created_at)} · expire le{" "}
                  {date(row.expires_at)}
                </small>
              </li>
            ))}
          </ul>
          {resource.data.total > resource.data.limit && (
            <p>
              Les {resource.data.limit} sessions les plus récentes sont
              affichées. L’action ci-dessous les ferme toutes.
            </p>
          )}
        </section>
      )}
      <form onSubmit={submit} onChange={guard.markDirty}>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <fieldset disabled={lock.busy}>
          <Field label="Action de sécurité">
            {(id) => (
              <select
                id={id}
                value={action}
                onChange={(event) => {
                  setAction(event.target.value);
                  setError("");
                }}
              >
                <option value="password">Changer mon mot de passe</option>
                <option value="revoke">Fermer toutes mes sessions</option>
              </select>
            )}
          </Field>
          <Field label="Mot de passe actuel">
            {(id) => (
              <input
                id={id}
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
              />
            )}
          </Field>
          {action === "password" && (
            <>
              <Field label="Nouveau mot de passe">
                {(id) => (
                  <input
                    id={id}
                    name="new_password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={256}
                  />
                )}
              </Field>
              <Field label="Confirmer le nouveau mot de passe">
                {(id) => (
                  <input
                    id={id}
                    name="password_confirmation"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={256}
                  />
                )}
              </Field>
              <p>
                12 caractères minimum. Les espaces font partie du mot de passe.
                Aucun e-mail de récupération n’est envoyé.
              </p>
            </>
          )}
          <label className="checkbox">
            <input type="checkbox" required name="confirmed" />
            Je confirme la fermeture de toutes mes sessions, y compris celle-ci.
            Mes dossiers seront conservés.
          </label>
        </fieldset>
        <p>
          Une opération déjà autorisée et en cours n’est pas annulée. Si la
          réponse se perd, reconnectez-vous pour vérifier le résultat avant de
          recommencer.
        </p>
        <Button disabled={lock.busy} variant="destructive">
          {lock.busy
            ? "Confirmation en cours…"
            : action === "password"
              ? "Modifier le mot de passe et me déconnecter"
              : "Fermer toutes mes sessions"}
        </Button>
      </form>
    </Modal>
  );
}
