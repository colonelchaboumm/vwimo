import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { useFormGuard } from "../FormGuard";
import { Field, useSubmitLock } from "../commercial/shared";
import type { CharlieConfig as Configuration } from "./types";

export function CharlieConfig({
  config,
  onClose,
  onChanged,
}: {
  config: Configuration;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [current, setCurrent] = useState(config);
  const [enabled, setEnabled] = useState(config.enabled);
  const [removing, setRemoving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    setMessage("");
    const form = e.currentTarget;
    const values = new FormData(form);
    try {
      const value = await api<Configuration>("/charlie/config", {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          model: String(values.get("model")),
          max_output_tokens: Number(values.get("max_output_tokens")),
          api_key: String(values.get("api_key") || "") || null,
        }),
      });
      const keyInput = form.elements.namedItem("api_key");
      if (keyInput instanceof HTMLInputElement) keyInput.value = "";
      setCurrent(value);
      guard.clean();
      setDirty(false);
      onChanged();
      setMessage(
        "Configuration enregistrée. Utilisez le test ci-dessous pour vérifier la connexion réelle.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  async function testConnection() {
    if (!lock.start()) return;
    setError("");
    setMessage("");
    try {
      const result = await api<{ status: string; tested_at: string }>(
        "/charlie/test",
        { method: "POST" },
        70000,
      );
      setCurrent((value) => ({ ...value, tested_at: result.tested_at }));
      setMessage(
        "Connexion confirmée par une réponse réelle d’OpenAI. Aucun dossier n’a été transmis par ce test.",
      );
      onChanged();
    } catch (e) {
      setError((e as Error).message);
      setCurrent((value) => ({ ...value, tested_at: null }));
    } finally {
      lock.end();
    }
  }
  async function remove() {
    if (!lock.start()) return;
    setError("");
    setMessage("");
    try {
      const value = await api<Configuration>("/charlie/config", {
        method: "DELETE",
      });
      setCurrent(value);
      setEnabled(false);
      setRemoving(false);
      guard.clean();
      setDirty(false);
      onChanged();
      setMessage(
        "Connexion désactivée et clé enregistrée dans l’outil supprimée.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  return (
    <Modal
      open
      onClose={guard.close}
      title="Connexion OpenAI"
      description="Configuration facultative. Charlie propose aussi des fonctions locales sans clé API."
    >
      <form
        className="commercial-form"
        onSubmit={save}
        onChange={() => {
          guard.markDirty();
          setDirty(true);
        }}
      >
        {guard.notice}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        <div className="notice">
          Les appels utilisent votre compte API OpenAI et peuvent être facturés
          par OpenAI. Le test transmet uniquement une courte demande de
          confirmation. La clé ne vous sera jamais réaffichée.
        </div>
        {current.key_error && (
          <div className="error" role="alert">
            {current.key_error}
          </div>
        )}
        <fieldset disabled={lock.busy} className="charlie-config-fields">
          <label className="commercial-check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{" "}
            Activer la connexion OpenAI
          </label>
          <Field label="Clé API OpenAI">
            {(id) => (
              <input
                id={id}
                name="api_key"
                type="password"
                autoComplete="off"
                maxLength={512}
                disabled={!current.storage_supported}
                placeholder={
                  current.configured
                    ? "Laisser vide pour conserver la clé"
                    : "Saisir votre clé API"
                }
              />
            )}
          </Field>
          <p className="commercial-status">
            {current.storage_supported
              ? "La clé saisie est chiffrée pour votre session Windows et conservée localement. Après un changement de profil Windows, il peut être nécessaire de la saisir à nouveau."
              : "Le serveur doit fournir IMMO_OPENAI_API_KEY. Aucun stockage en clair depuis l’interface n’est proposé."}
          </p>
          {current.key_source === "environment" && (
            <p className="commercial-status">
              Une clé est fournie par l’environnement du backend. La
              désactivation coupe les appels mais ne modifie pas cette variable.
            </p>
          )}
          <Field label="Modèle OpenAI">
            {(id) => (
              <input
                id={id}
                name="model"
                required
                maxLength={120}
                pattern="[A-Za-z0-9][A-Za-z0-9._:\-]*"
                defaultValue={current.model}
              />
            )}
          </Field>
          <Field label="Limite de sortie par réponse (tokens)">
            {(id) => (
              <input
                id={id}
                name="max_output_tokens"
                type="number"
                min={256}
                max={8192}
                step={1}
                required
                defaultValue={current.max_output_tokens}
              />
            )}
          </Field>
          <p className="commercial-status">
            La disponibilité du modèle dépend de votre projet API. La limite de
            sortie inclut le raisonnement lorsque le modèle en utilise.
          </p>
        </fieldset>
        <div className="commercial-actions">
          <Button
            type="button"
            variant="outline"
            disabled={lock.busy}
            onClick={guard.close}
          >
            Fermer
          </Button>
          <Button disabled={lock.busy}>Enregistrer la connexion</Button>
        </div>
        <div className="charlie-config-test">
          <strong>
            {current.tested_at
              ? "Dernier test confirmé : " +
                new Date(current.tested_at).toLocaleString("fr-FR")
              : "Connexion réelle non confirmée"}
          </strong>
          <Button
            type="button"
            variant="outline"
            disabled={
              lock.busy || dirty || !current.enabled || !current.configured
            }
            onClick={testConnection}
          >
            {lock.busy
              ? "Veuillez patienter…"
              : "Tester la connexion (appel API)"}
          </Button>
        </div>
        <div className="notice">
          Une demande à OpenAI transmet seulement votre message courant et le
          contexte affiché après confirmation. L’historique des échanges reste
          dans l’outil. L’option de stockage des réponses OpenAI est désactivée
          ; des règles de conservation du fournisseur peuvent néanmoins
          s’appliquer.{" "}
          <a
            href="https://developers.openai.com/api/docs/guides/your-data"
            target="_blank"
            rel="noreferrer"
          >
            Politique de données OpenAI
          </a>
          .
        </div>
        {!removing ? (
          <Button
            type="button"
            variant="ghost"
            disabled={lock.busy}
            onClick={() => setRemoving(true)}
          >
            Désactiver et supprimer la clé locale
          </Button>
        ) : (
          <div className="notice" role="alert">
            Confirmer la désactivation et la suppression de la clé enregistrée
            dans l’outil ?
            <div className="commercial-actions">
              <Button
                type="button"
                variant="destructive"
                disabled={lock.busy}
                onClick={remove}
              >
                Confirmer la suppression de la clé
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={lock.busy}
                onClick={() => setRemoving(false)}
              >
                Conserver
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
