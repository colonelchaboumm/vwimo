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
type Configuration = {
  client_id: string;
  tenant: string;
  version: number;
  configured: boolean;
  connected: boolean;
};
function SetupForm({
  initial,
  onClose,
}: {
  initial: Configuration;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(initial);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    setNotice("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      setCurrent(
        await api<Configuration>("/outlook/config", {
          method: "PUT",
          body: JSON.stringify({ ...values, version: current.version }),
        }),
      );
      guard.clean();
      setNotice(
        "Configuration enregistrée sur ce poste. Aucun compte Microsoft connecté, aucun message envoyé.",
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
      wide
      title="Préparer la connexion Outlook"
      onClose={guard.close}
      description="L’identifiant d’application peut être ajouté plus tard. Cet écran prépare la configuration ; l’authentification et la synchronisation seront intégrées ensuite."
    >
      <div className="notice">
        État :{" "}
        {current.configured ? "identifiant enregistré" : "identifiant à créer"}{" "}
        · Non connecté à Microsoft. Aucun mot de passe Microsoft ni secret
        client n’est demandé ou conservé.
      </div>
      <ol className="outlook-steps">
        <li>
          Dans le centre Microsoft Entra, ouvrir{" "}
          <strong>Inscriptions d’applications → Nouvelle inscription</strong>,
          et donner le nom IMMO PILOT AI.
        </li>
        <li>
          Choisir les types de comptes adaptés : organisation uniquement, ou
          organisations et comptes Microsoft personnels. L’accès au centre
          dépend des règles de votre organisation.
        </li>
        <li>
          Pour la future connexion de bureau, préparer une plateforme{" "}
          <strong>Applications mobiles et de bureau</strong> avec la redirection{" "}
          <code>http://localhost</code>. Ne pas créer de secret client.
        </li>
        <li>
          Copier l’<strong>ID d’application (client)</strong> ci-dessous. Pour
          une seule organisation, copier aussi l’ID d’annuaire (locataire) ;
          sinon utiliser la valeur correspondant aux types de comptes.
        </li>
        <li>
          Enregistrer ici. La connexion interactive, le consentement Microsoft
          Graph et le stockage protégé des jetons restent à intégrer. Aucun
          droit d’accès aux e-mails ou à l’agenda n’est demandé par cet écran.
        </li>
      </ol>
      <p className="commercial-status">
        <a
          href="https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app"
          target="_blank"
          rel="noreferrer"
        >
          Guide Microsoft : inscrire une application
        </a>{" "}
        ·{" "}
        <a
          href="https://learn.microsoft.com/en-us/entra/identity-platform/msal-client-applications"
          target="_blank"
          rel="noreferrer"
        >
          Applications clientes publiques
        </a>
      </p>
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
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        <fieldset className="radar-form-grid" disabled={lock.busy}>
          <Field label="ID d’application Microsoft (client ID)">
            {(id) => (
              <input
                id={id}
                name="client_id"
                maxLength={36}
                autoComplete="off"
                defaultValue={current.client_id}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            )}
          </Field>
          <Field label="Locataire / types de comptes Microsoft">
            {(id) => (
              <input
                id={id}
                name="tenant"
                maxLength={36}
                required
                defaultValue={current.tenant}
                placeholder="common ou ID UUID de l’organisation"
                list="microsoft-tenants"
              />
            )}
          </Field>
          <datalist id="microsoft-tenants">
            <option value="common">Organisations et comptes personnels</option>
            <option value="organizations">Organisations uniquement</option>
            <option value="consumers">Comptes personnels uniquement</option>
          </datalist>
        </fieldset>
        <p className="commercial-status">
          Le client ID et l’ID de locataire sont des identifiants de
          configuration, pas des secrets. Laisser le client ID vide retire la
          préparation enregistrée.
        </p>
        <Button disabled={lock.busy}>Enregistrer la préparation Outlook</Button>
      </form>
    </Modal>
  );
}
export function OutlookSetup({ onClose }: { onClose: () => void }) {
  const resource = useResource<Configuration>("/outlook/config");
  return resource.data ? (
    <SetupForm initial={resource.data} onClose={onClose} />
  ) : (
    <Modal open title="Préparer la connexion Outlook" onClose={onClose}>
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
    </Modal>
  );
}
