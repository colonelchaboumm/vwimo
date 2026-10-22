import { useRef, useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../../api";
import { dateText } from "../../lib/utils";
import { useFormGuard } from "../FormGuard";
import { parisToISO } from "../commercial/CalendarPage";
import {
  Field,
  ResourceState,
  useEditing,
  useResource,
  useSubmitLock,
} from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import {
  activityLabels,
  channelLabels,
  parisInput,
  stageLabels,
  type Prospect,
} from "./types";

function ProspectDialog({
  item,
  readonly,
  onClose,
  onChanged,
}: {
  item: Prospect;
  readonly: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState(item);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [opposed, setOpposed] = useState(item.opposed);
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  const [dirty, setDirty] = useState(false);
  const activityDirty = useRef(false);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const initialTime = useRef(parisInput());
  function edit() {
    setDirty(true);
    guard.markDirty();
    setNotice("");
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const value = await api<Prospect>("/prospects/" + current.id, {
        method: "PUT",
        body: JSON.stringify({
          ...values,
          listing_id: current.listing_id,
          version: current.version,
          opposed,
        }),
      });
      setCurrent(value);
      if (activityDirty.current) guard.markDirty();
      else guard.clean();
      setDirty(false);
      setNotice("Autorisations et notes enregistrées. Aucun envoi déclenché.");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  async function activity(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    setNotice("");
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      const body = {
        ...values,
        occurred_at: parisToISO(String(values.occurred_at)),
      };
      const key = JSON.stringify(body);
      if (pending.current?.key !== key)
        pending.current = { key, id: crypto.randomUUID() };
      const value = await api<Prospect>(
        "/prospects/" + current.id + "/activities",
        {
          method: "POST",
          body: JSON.stringify({
            ...body,
            version: current.version,
            request_id: pending.current.id,
          }),
        },
      );
      setCurrent(value);
      setOpposed(value.opposed);
      pending.current = null;
      form.reset();
      activityDirty.current = false;
      guard.clean();
      setNotice(
        "Activité déclarée enregistrée. L’outil n’a effectué aucun envoi.",
      );
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
      onClose={guard.close}
      title={current.listing.title}
      description="Journal déclaratif d’actions effectuées hors de l’outil. Aucun bouton ne déclenche un envoi."
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
      <form className="commercial-form" onSubmit={save} onChange={edit}>
        <fieldset disabled={readonly || lock.busy} className="radar-form-grid">
          <Field label="Autorisation de contact déclarée">
            {(id) => (
              <select
                id={id}
                name="permission"
                key={current.permission}
                defaultValue={current.permission}
              >
                <option value="unknown">Non vérifiée</option>
                <option value="declared">Justification enregistrée</option>
                <option value="refused">Refusée</option>
              </select>
            )}
          </Field>
          <Field label="Justification / canal autorisé">
            {(id) => (
              <textarea
                id={id}
                name="permission_note"
                maxLength={1000}
                rows={2}
                defaultValue={current.permission_note}
              />
            )}
          </Field>
          <label className="commercial-check">
            <input
              type="checkbox"
              checked={opposed}
              onChange={(e) => setOpposed(e.target.checked)}
            />
            Opposition / arrêt du suivi de contact
          </label>
          <Field label="Notes du prospect">
            {(id) => (
              <textarea
                id={id}
                name="notes"
                rows={3}
                maxLength={5000}
                defaultValue={current.notes}
              />
            )}
          </Field>
        </fieldset>
        <p className="commercial-status">
          Une annonce publique ne vaut pas autorisation de contact. La
          justification enregistrée reste à vérifier selon le canal ; l’outil ne
          certifie pas sa conformité.
        </p>
        {!readonly && (
          <Button disabled={lock.busy}>Enregistrer le suivi</Button>
        )}
      </form>
      <h3 className="radar-section-title">
        Historique déclaré · {current.activity_count}
      </h3>
      {current.history_limited && (
        <p className="notice">
          Les 200 dernières activités sont affichées. Les précédentes restent
          conservées dans la base et prises en compte pour les contrôles.
        </p>
      )}
      <ol className="prospect-timeline">
        {current.activities.map((event) => (
          <li key={event.id}>
            <strong>{activityLabels[event.kind]}</strong>
            <small>
              {new Date(event.occurred_at).toLocaleString("fr-FR", {
                timeZone: "Europe/Paris",
              })}{" "}
              · {channelLabels[event.channel]}
            </small>
            <p>{event.message}</p>
            {event.evidence && <small>Référence : {event.evidence}</small>}
          </li>
        ))}
      </ol>
      {!current.activities.length && (
        <p className="commercial-status">Aucune activité déclarée.</p>
      )}
      {!readonly && (
        <form
          className="commercial-form"
          onSubmit={activity}
          onChange={() => {
            activityDirty.current = true;
            guard.markDirty();
          }}
        >
          <h3 className="radar-section-title">
            Déclarer une activité effectuée
          </h3>
          {dirty && (
            <p className="notice">
              Enregistrez d’abord les modifications du suivi.
            </p>
          )}
          <fieldset disabled={lock.busy || dirty} className="radar-form-grid">
            <Field label="Activité effectuée">
              {(id) => (
                <select id={id} name="kind" defaultValue="note">
                  {Object.entries(activityLabels).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Canal utilisé">
              {(id) => (
                <select id={id} name="channel" defaultValue="other">
                  {Object.entries(channelLabels).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Date de l’activité · heure de Paris">
              {(id) => (
                <input
                  id={id}
                  name="occurred_at"
                  type="datetime-local"
                  required
                  defaultValue={initialTime.current}
                />
              )}
            </Field>
            <Field label="Preuve / référence de l’action effectuée">
              {(id) => (
                <input
                  id={id}
                  name="evidence"
                  maxLength={1000}
                  placeholder="Obligatoire pour contact et relance"
                />
              )}
            </Field>
            <div className="radar-full">
              <Field label="Compte rendu / message effectivement utilisé">
                {(id) => (
                  <textarea
                    id={id}
                    name="message"
                    required
                    minLength={3}
                    maxLength={5000}
                    rows={3}
                  />
                )}
              </Field>
            </div>
          </fieldset>
          <Button disabled={lock.busy || dirty}>
            Enregistrer l’activité déclarée
          </Button>
        </form>
      )}
    </Modal>
  );
}

function ProspectLoader({
  item,
  readonly,
  onClose,
  onChanged,
}: {
  item: Prospect;
  readonly: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const resource = useResource<Prospect>("/prospects/" + item.id);
  if (resource.data)
    return (
      <ProspectDialog
        item={resource.data}
        readonly={readonly}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  return (
    <Modal open onClose={onClose} title="Chargement du suivi">
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
    </Modal>
  );
}

type Result = {
  items: Prospect[];
  total: number;
  contacts_declared_today: number;
  daily_limit: number;
  remaining_target: number;
  stages: Record<string, number>;
  outcomes: Record<string, number>;
  automation_enabled: boolean;
};
export function ProspectingPage({
  readonly,
  onEditing,
}: {
  readonly: boolean;
  onEditing: (value: boolean) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const resource = useResource<Result>("/prospects?offset=" + offset);
  useEditing(!!selected, onEditing);
  const data = resource.data;
  return (
    <section className="commercial-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">DÉVELOPPER VOTRE PORTEFEUILLE</div>
          <h1>Chaque relation compte.</h1>
          <p>
            Qualifiez vos pistes de particuliers et conservez la trace de vos
            démarches.
          </p>
        </div>
        <Button variant="outline" onClick={resource.refresh}>
          <RefreshCw size={15} /> Actualiser
        </Button>
      </div>
      <div className="notice">
        Suivi local et journal déclaratif. Aucun connecteur d’envoi n’est
        activé. Le plafond d’envoi automatique et ses réservations seront
        appliqués lors de l’intégration d’un canal autorisé ; les compteurs
        ci-dessous décrivent vos déclarations.
      </div>
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
      {data && (
        <>
          <div className="prospect-stats">
            {[
              ["Prospects", data.total],
              ["Contacts déclarés aujourd’hui", data.contacts_declared_today],
              ["Repère quotidien", data.daily_limit],
              ["Rendez-vous déclarés", data.outcomes.appointment || 0],
            ].map(([label, value]) => (
              <div className="panel" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="commercial-status">
            Fuseau Europe/Paris · Repère restant : {data.remaining_target} · Les
            déclarations historiques restent possibles même au-delà du repère
            quotidien.
          </p>
          <div className="commercial-grid">
            {data.items.map((item) => (
              <article className="panel radar-card" key={item.id}>
                <div className="match-top">
                  <span className="radar-pill">{stageLabels[item.stage]}</span>
                  {item.opposed && (
                    <span className="prospect-opposed">Opposition</span>
                  )}
                </div>
                <h2>{item.listing.title}</h2>
                <p>
                  {item.listing.city} · {item.listing.source_name}
                </p>
                <p>
                  Autorisation :{" "}
                  {item.permission === "declared"
                    ? "justification enregistrée"
                    : item.permission === "refused"
                      ? "refusée"
                      : "non vérifiée"}
                </p>
                {item.followup_due && (
                  <p className="prospect-followup">
                    {item.followup_ready
                      ? "Relance à examiner depuis le "
                      : "Relance à examiner à partir du "}
                    {dateText(item.followup_due)} · aucun envoi planifié
                  </p>
                )}
                <p>{item.activity_count} activité(s) déclarée(s)</p>
                <Button variant="outline" onClick={() => setSelected(item)}>
                  Ouvrir le suivi
                </Button>
              </article>
            ))}
          </div>
          {!data.items.length && (
            <div className="panel radar-empty">
              <h2>Vos pistes, vos prochaines rencontres.</h2>
              <p>
                Dans Radar immobilier, ajoutez une annonce active de particulier
                en prospection.
              </p>
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
              disabled={offset + 40 >= data.total}
              onClick={() => setOffset((v) => v + 40)}
            >
              Page suivante
            </Button>
          </div>
        </>
      )}
      {selected && (
        <ProspectLoader
          item={selected}
          readonly={readonly}
          onClose={() => setSelected(null)}
          onChanged={resource.refresh}
        />
      )}
    </section>
  );
}
