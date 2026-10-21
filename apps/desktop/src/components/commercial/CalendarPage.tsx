import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
} from "lucide-react";
import { api, saveFile } from "../../api";
import type { Contact, Mandate } from "../../types";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { useFormGuard } from "../FormGuard";
import {
  Field,
  ResourceState,
  useEditing,
  useResource,
  useSubmitLock,
} from "./shared";
import type { EventRecord } from "./types";

const kinds = {
  visit: "Visite",
  estimate: "Estimation",
  seller: "Rendez-vous vendeur",
  buyer: "Rendez-vous acquéreur",
  signing: "Signature",
  other: "Autre",
};
const paris = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function inputDate(value: string | Date) {
  const parts = Object.fromEntries(
    paris.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function parisToISO(value: string) {
  const candidates = ["+01:00", "+02:00"]
    .map((offset) => new Date(value + offset))
    .filter(
      (date) => !Number.isNaN(date.valueOf()) && inputDate(date) === value,
    );
  if (candidates.length !== 1)
    throw new Error(
      "Cet horaire est inexistant ou ambigu lors du changement d’heure à Paris. Choisissez un autre horaire.",
    );
  return candidates[0].toISOString();
}
const dayDate = (value: Date) => value.toISOString().slice(0, 10);
function plusDays(value: Date, amount: number) {
  const d = new Date(value);
  d.setUTCDate(d.getUTCDate() + amount);
  return d;
}
const time = (value: string) =>
  new Date(value).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });

function EventForm({
  item,
  day,
  contacts,
  mandates,
  onClose,
  onSaved,
}: {
  item?: EventRecord;
  day: string;
  contacts: Contact[];
  mandates: Mandate[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    const f = new FormData(e.currentTarget);
    const val = (name: string) => String(f.get(name) || "");
    try {
      await api("/calendar" + (item ? "/" + item.id : ""), {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({
          version: item?.version,
          title: val("title"),
          kind: val("kind"),
          starts_at: parisToISO(val("starts_at")),
          ends_at: parisToISO(val("ends_at")),
          location: val("location"),
          notes: val("notes"),
          contact_id: val("contact_id") || null,
          mandate_id: val("mandate_id") || null,
        }),
      });
      guard.clean();
      onSaved("Rendez-vous enregistré.");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  async function remove() {
    if (!item || !lock.start()) return;
    setError("");
    try {
      await api(`/calendar/${item.id}?version=${item.version}`, {
        method: "DELETE",
      });
      guard.clean();
      onSaved("Rendez-vous supprimé.");
      onClose();
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
      title={item ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
      description="Horaires en Europe/Paris. Ce rendez-vous reste dans l’agenda local."
      wide
    >
      <form
        onSubmit={submit}
        onChange={guard.markDirty}
        className="commercial-form"
      >
        {guard.notice}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <fieldset disabled={lock.busy}>
          <div className="form-grid">
            <Field label="Titre">
              {(id) => (
                <input
                  id={id}
                  name="title"
                  required
                  minLength={2}
                  maxLength={180}
                  defaultValue={item?.title}
                />
              )}
            </Field>
            <Field label="Type de rendez-vous">
              {(id) => (
                <select
                  id={id}
                  name="kind"
                  defaultValue={item?.kind || "visit"}
                >
                  {Object.entries(kinds).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Début · heure de Paris">
              {(id) => (
                <input
                  id={id}
                  name="starts_at"
                  type="datetime-local"
                  required
                  defaultValue={
                    item ? inputDate(item.starts_at) : day + "T09:00"
                  }
                />
              )}
            </Field>
            <Field label="Fin · heure de Paris">
              {(id) => (
                <input
                  id={id}
                  name="ends_at"
                  type="datetime-local"
                  required
                  defaultValue={item ? inputDate(item.ends_at) : day + "T10:00"}
                />
              )}
            </Field>
            <Field label="Lieu">
              {(id) => (
                <input
                  id={id}
                  name="location"
                  maxLength={300}
                  defaultValue={item?.location}
                />
              )}
            </Field>
            <Field label="Contact associé">
              {(id) => (
                <select
                  id={id}
                  name="contact_id"
                  defaultValue={item?.contact_id || ""}
                >
                  <option value="">Aucun contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Mandat associé">
              {(id) => (
                <select
                  id={id}
                  name="mandate_id"
                  defaultValue={item?.mandate_id || ""}
                >
                  <option value="">Aucun mandat</option>
                  {mandates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.reference} · {m.property.title}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Notes de préparation">
              {(id) => (
                <textarea
                  id={id}
                  name="notes"
                  rows={4}
                  maxLength={10000}
                  defaultValue={item?.notes}
                />
              )}
            </Field>
          </div>
        </fieldset>
        {removing && (
          <div className="notice" role="alert">
            Supprimer définitivement ce rendez-vous ?{" "}
            <Button
              type="button"
              variant="destructive"
              disabled={lock.busy}
              onClick={remove}
            >
              Confirmer la suppression
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
        )}
        <div className="commercial-actions">
          {item && (
            <Button
              type="button"
              variant="destructive"
              disabled={lock.busy}
              onClick={() => setRemoving(true)}
            >
              Supprimer le rendez-vous
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={lock.busy}
            onClick={guard.close}
          >
            Annuler
          </Button>
          <Button disabled={lock.busy}>
            {lock.busy ? "Enregistrement…" : "Enregistrer le rendez-vous"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CalendarPage({
  contacts,
  mandates,
  readonly,
  onChanged,
  onEditing,
  openContact,
  openMandate,
}: {
  contacts: Contact[];
  mandates: Mandate[];
  readonly: boolean;
  onChanged: () => Promise<void>;
  onEditing: (value: boolean) => void;
  openContact: (contact: Contact) => void;
  openMandate: (mandate: Mandate) => void;
}) {
  const [selected, setSelected] = useState(() =>
    inputDate(new Date()).slice(0, 10),
  );
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [editor, setEditor] = useState<EventRecord | "new" | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  useEditing(editor !== null || exporting, onEditing);
  const { days, start, end } = useMemo(() => {
    let first = new Date(selected + "T12:00:00Z");
    if (view === "month") first.setUTCDate(1);
    if (view !== "day") first = plusDays(first, -(first.getUTCDay() + 6) % 7);
    const count = view === "day" ? 1 : view === "week" ? 7 : 42;
    const days = Array.from({ length: count }, (_, n) => plusDays(first, n));
    return {
      days,
      start: parisToISO(dayDate(first) + "T00:00"),
      end: parisToISO(dayDate(plusDays(first, count)) + "T00:00"),
    };
  }, [selected, view]);
  const query = new URLSearchParams({ from_at: start, to_at: end }).toString();
  const resource = useResource<{ items: EventRecord[]; limited: boolean }>(
    "/calendar?" + query,
  );
  const events = resource.data?.items || [];
  function move(direction: number) {
    const d = new Date(selected + "T12:00:00Z");
    if (view === "month") {
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + direction);
    } else d.setUTCDate(d.getUTCDate() + direction * (view === "week" ? 7 : 1));
    setSelected(dayDate(d));
  }
  async function exportCalendar() {
    setExporting(true);
    setError("");
    try {
      saveFile(
        await api<Blob>("/calendar/export/download?" + query),
        "agenda-immo-pilot.ics",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <section className="commercial-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">VOTRE QUOTIDIEN</div>
          <h1>Chaque rendez-vous compte.</h1>
          <p>
            Visites, estimations et signatures, réunies dans votre agenda local.
          </p>
        </div>
        <div className="commercial-actions">
          <Button
            variant="outline"
            disabled={exporting}
            onClick={exportCalendar}
          >
            <Download size={16} /> Exporter ICS
          </Button>
          <Button disabled={readonly} onClick={() => setEditor("new")}>
            <Plus size={16} /> Nouveau rendez-vous
          </Button>
        </div>
      </div>
      <div className="notice">
        Agenda local · Europe/Paris. L’export ICS peut être importé dans
        Outlook. La synchronisation Microsoft, les récurrences et les
        notifications Windows ne sont pas encore actives.
      </div>
      <div className="calendar-toolbar panel">
        <div className="commercial-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Période précédente"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={17} />
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelected(inputDate(new Date()).slice(0, 10))}
          >
            Aujourd’hui
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Période suivante"
            onClick={() => move(1)}
          >
            <ChevronRight size={17} />
          </Button>
          <input
            type="date"
            min="2000-01-01"
            max="2100-12-31"
            aria-label="Date de l’agenda"
            value={selected}
            onChange={(e) => {
              if (e.target.value && e.target.validity.valid)
                setSelected(e.target.value);
            }}
          />
        </div>
        <div className="commercial-actions">
          {(
            [
              ["day", "Jour"],
              ["week", "Semaine"],
              ["month", "Mois"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={view === key ? "default" : "ghost"}
              onClick={() => setView(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
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
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
      {resource.data?.limited && (
        <div className="notice">
          Plus de 1 000 rendez-vous sur cette période. Choisissez une vue plus
          courte.
        </div>
      )}
      <div className={`calendar-grid calendar-${view}`}>
        {days.map((day) => {
          const key = dayDate(day);
          const a = parisToISO(key + "T00:00"),
            b = parisToISO(dayDate(plusDays(day, 1)) + "T00:00");
          const rows = events.filter(
            (e) =>
              Date.parse(e.starts_at) < Date.parse(b) &&
              Date.parse(e.ends_at) > Date.parse(a),
          );
          return (
            <article
              key={key}
              className={
                "calendar-day panel " +
                (key === inputDate(new Date()).slice(0, 10) ? "is-today" : "")
              }
            >
              <button
                className="calendar-date"
                onClick={() => {
                  setSelected(key);
                  setView("day");
                }}
              >
                {day.toLocaleDateString("fr-FR", {
                  timeZone: "UTC",
                  weekday: "short",
                  day: "numeric",
                  month: view === "month" ? undefined : "short",
                })}
              </button>
              {rows.map((event) => (
                <div className="calendar-event" key={event.id}>
                  <button
                    onClick={() => {
                      if (!readonly) setEditor(event);
                    }}
                    disabled={readonly}
                  >
                    <span>
                      {time(event.starts_at)} – {time(event.ends_at)}
                    </span>
                    <strong>{event.title}</strong>
                    <small>
                      {kinds[event.kind]}
                      {event.location ? " · " + event.location : ""}
                    </small>
                  </button>
                  {view === "day" && (
                    <>
                      <p>{event.notes}</p>
                      <div className="commercial-actions">
                        {event.contact_id && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              const c = contacts.find(
                                (c) => c.id === event.contact_id,
                              );
                              if (c) openContact(c);
                            }}
                          >
                            Ouvrir le contact
                          </Button>
                        )}
                        {event.mandate_id && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              const m = mandates.find(
                                (m) => m.id === event.mandate_id,
                              );
                              if (m) openMandate(m);
                            }}
                          >
                            Ouvrir le mandat
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {!rows.length && view !== "month" && !resource.loading && (
                <p className="commercial-status">
                  <CalendarDays size={16} /> Aucun rendez-vous
                </p>
              )}
            </article>
          );
        })}
      </div>
      {editor && (
        <EventForm
          item={editor === "new" ? undefined : editor}
          day={selected}
          contacts={contacts}
          mandates={mandates}
          onClose={() => setEditor(null)}
          onSaved={(confirmation) => {
            resource.refresh();
            setMessage(confirmation);
            void onChanged();
          }}
        />
      )}
    </section>
  );
}
