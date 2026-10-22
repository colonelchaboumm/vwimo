import { useRef, useState } from "react";
import { api, saveFile } from "../../api";
import { dateText } from "../../lib/utils";
import { useFormGuard } from "../FormGuard";
import {
  Field,
  ResourceState,
  useResource,
  useSubmitLock,
} from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import type { Campaign, Preview } from "./types";

export function CampaignDetail({
  item,
  readonly,
  onClose,
  onChanged,
}: {
  item: Campaign;
  readonly: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [contact, setContact] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const resource = useResource<Preview>(
    "/marketing/campaigns/" + item.id + "/preview?contact_id=" + contact,
  );
  const value = resource.data;
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  const pending = useRef<{ key: string; id: string } | null>(null);
  function refreshPreview() {
    setContact("");
    setConfirmed(false);
    resource.refresh();
  }
  async function prepare() {
    if (!value || !confirmed || !lock.start()) return;
    setError("");
    const body = {
      contact_id: value.sample.contact_id,
      digest: value.digest,
      confirmed: true,
    };
    const key = JSON.stringify(body);
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      const blob = await api<Blob>(
        "/marketing/campaigns/" + item.id + "/download",
        {
          method: "POST",
          body: JSON.stringify({ ...body, request_id: pending.current.id }),
        },
      );
      saveFile(blob, "newsletter-immo-pilot.eml");
      pending.current = null;
      guard.clean();
      setConfirmed(false);
      setNotice(
        "Fichier EML préparé sur cet ordinateur. Aucun e-mail envoyé. Vérifiez les préférences avant tout envoi hors de l’outil.",
      );
      resource.refresh();
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
      title={item.reference + " · Prévisualisation newsletter"}
      onClose={guard.close}
      description="Audience et préférences revérifiées avant chaque préparation individuelle. Aucun envoi, suivi d’ouverture ou synchronisation Outlook."
    >
      {guard.notice}
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={refreshPreview}
      />
      {error && (
        <div className="error" role="alert">
          {error}
          <Button
            variant="ghost"
            disabled={lock.busy}
            onClick={() => {
              refreshPreview();
            }}
          >
            Actualiser la prévisualisation
          </Button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {value && (
        <>
          <div className="prospect-stats">
            <div className="panel">
              <span>Adresses éligibles dédoublonnées</span>
              <strong>{value.eligible.length}</strong>
            </div>
            <div className="panel">
              <span>Fiches écartées</span>
              <strong>{value.excluded.length}</strong>
            </div>
          </div>
          {value.missing.length > 0 && (
            <p className="notice">
              À compléter avant export : {value.missing.join(" · ")}
            </p>
          )}
          {value.eligible.length > 0 && (
            <Field label="Destinataire de la prévisualisation">
              {(id) => (
                <select
                  id={id}
                  value={value.sample.contact_id}
                  disabled={lock.busy}
                  onChange={(e) => {
                    setContact(e.target.value);
                    setConfirmed(false);
                  }}
                >
                  {value.eligible.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.email}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <section className="marketing-preview">
            <h3>{value.sample.subject || "Objet à renseigner"}</h3>
            <p className="commercial-status">
              Expéditeur : {value.campaign.sender_name || "à renseigner"} ·{" "}
              {value.campaign.sender_email || "à renseigner"}
            </p>
            <p className="marketing-text">
              {value.sample.body || "Message à renseigner"}
            </p>
            <hr />
            <p className="marketing-text">
              {value.campaign.footer || "Signature à renseigner"}
            </p>
            <p className="commercial-status">
              Consigne ajoutée au fichier : pour ne plus recevoir ces messages,
              répondre à{" "}
              {value.campaign.reply_to ||
                value.campaign.sender_email ||
                "l’adresse à renseigner"}
              .
            </p>
          </section>
          <label className="commercial-check">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={
                readonly ||
                lock.busy ||
                !value.sample.contact_id ||
                !!value.missing.length
              }
              onChange={(e) => {
                setConfirmed(e.target.checked);
                guard.markDirty();
              }}
            />
            J’ai vérifié le destinataire, son autorisation newsletter,
            l’expéditeur et le contenu de ce fichier individuel.
          </label>
          <Button
            className="finance-footer"
            disabled={
              readonly ||
              lock.busy ||
              !confirmed ||
              !!value.missing.length ||
              !value.sample.contact_id
            }
            onClick={() => void prepare()}
          >
            Préparer le fichier EML
          </Button>
          <p className="notice">
            Un fichier exporté ne peut plus être rappelé par l’outil. Les
            oppositions reçues par réponse doivent être enregistrées
            manuellement dans Préférences newsletter. Le quota d’envoi de
            prospection n’est pas appliqué aux fichiers locaux : aucun canal
            d’envoi n’est intégré.
          </p>
          <details className="marketing-details">
            <summary>Fiches écartées · {value.excluded.length}</summary>
            <ul>
              {value.excluded.map((c) => (
                <li key={c.id}>
                  <strong>{c.name}</strong> · {c.email || "sans e-mail"}
                  <br />
                  {c.reason}
                </li>
              ))}
            </ul>
          </details>
          <h3 className="radar-section-title">
            Derniers fichiers préparés · 20 maximum
          </h3>
          <ul className="marketing-history">
            {value.exports.map((row) => (
              <li key={row.id}>
                {dateText(row.created_at)} · {row.recipient_email}
                <br />
                Brouillon version {row.campaign_version} · aucun envoi confirmé
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
