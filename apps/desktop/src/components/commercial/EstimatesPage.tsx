import { useRef, useState, type FormEvent } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { api, saveFile } from "../../api";
import { money } from "../../lib/utils";
import type { Contact } from "../../types";
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
import type { Comparable, EstimateRecord } from "./types";

const statuses = {
  draft: "Brouillon",
  presented: "Présentée",
  accepted: "Acceptée",
  archived: "Archivée",
};
type ComparableRow = Comparable & { key: string };
function EstimateForm({
  item,
  contacts,
  onClose,
  onSaved,
}: {
  item?: EstimateRecord;
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useSubmitLock();
  const guard = useFormGuard(onClose, lock.busy);
  const form = useRef<HTMLFormElement>(null);
  const [basis, setBasis] = useState(item?.basis || "manual");
  const [comparables, setComparables] = useState<ComparableRow[]>(() =>
    (item?.comparables || []).map((c) => ({ ...c, key: crypto.randomUUID() })),
  );
  const [prices, setPrices] = useState({
    low_price: item?.low_price || "",
    central_price: item?.central_price || "",
    high_price: item?.high_price || "",
  });
  const details = item?.details;
  function changeComparable(key: string, values: Partial<Comparable>) {
    setComparables((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...values } : row)),
    );
  }
  function suggest() {
    setError("");
    setNotice("");
    const surface = Number(new FormData(form.current!).get("surface"));
    const valid = comparables.filter(
      (c) => c.kind === basis && Number(c.price) > 0 && Number(c.surface) > 0,
    );
    if (!(surface > 0) || !valid.length || basis === "manual") {
      setError(
        "Renseignez la surface et au moins un comparable du type choisi (vente ou prix affiché).",
      );
      return;
    }
    const values = valid
      .map((c) => Number(c.price) / Number(c.surface))
      .sort((a, b) => a - b);
    const n = values.length;
    const median =
      n % 2 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2;
    setPrices({
      low_price: (values[0] * surface).toFixed(2),
      central_price: (median * surface).toFixed(2),
      high_price: (values[n - 1] * surface).toFixed(2),
    });
    setNotice(
      `Suggestion calculée depuis ${n} référence(s) : prix au m² minimum, médian et maximum × surface. Aucun ajustement de l’état, de la localisation ou de la date. Vérifiez et adaptez les montants avant enregistrement.`,
    );
    guard.markDirty();
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lock.start()) return;
    setError("");
    const f = new FormData(e.currentTarget);
    const val = (key: string) => String(f.get(key) || "");
    const numeric = (key: string) => val(key) || null;
    try {
      await api("/estimates" + (item ? "/" + item.id : ""), {
        method: item ? "PUT" : "POST",
        body: JSON.stringify({
          version: item?.version,
          title: val("title"),
          address: val("address"),
          city: val("city"),
          property_type: val("property_type"),
          surface: val("surface"),
          contact_id: val("contact_id") || null,
          status: val("status"),
          basis,
          ...prices,
          details: {
            district: val("district"),
            rooms: numeric("rooms"),
            bedrooms: numeric("bedrooms"),
            floor: val("floor"),
            construction_year: numeric("construction_year"),
            carrez_surface: numeric("carrez_surface"),
            land_surface: numeric("land_surface"),
            annual_charges: numeric("annual_charges"),
            property_tax: numeric("property_tax"),
            dpe: val("dpe"),
            condition: val("condition"),
            features: val("features"),
            works: val("works"),
          },
          comparables: comparables.map(({ key: _key, ...row }) => ({
            ...row,
            url: row.url || null,
          })),
          analysis: val("analysis"),
        }),
      });
      guard.clean();
      onSaved();
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
      title={item ? "Modifier l’estimation" : "Nouvelle estimation"}
      description="Renseignez vos références et choisissez une fourchette. Aucun prix de marché n’est inventé."
      wide
    >
      <form
        ref={form}
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
            <Field label="Nom du dossier">
              {(id) => (
                <input
                  id={id}
                  name="title"
                  minLength={2}
                  maxLength={180}
                  required
                  defaultValue={item?.title}
                />
              )}
            </Field>
            <Field label="Statut de l’estimation">
              {(id) => (
                <select
                  id={id}
                  name="status"
                  defaultValue={item?.status || "draft"}
                >
                  {Object.entries(statuses).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Adresse du bien">
              {(id) => (
                <input
                  id={id}
                  name="address"
                  minLength={3}
                  maxLength={250}
                  required
                  defaultValue={item?.address}
                />
              )}
            </Field>
            <Field label="Commune">
              {(id) => (
                <input
                  id={id}
                  name="city"
                  minLength={2}
                  maxLength={100}
                  required
                  defaultValue={item?.city}
                />
              )}
            </Field>
            <Field label="Type de bien">
              {(id) => (
                <select
                  id={id}
                  name="property_type"
                  defaultValue={item?.property_type || "Appartement"}
                >
                  {["Appartement", "Maison", "Terrain", "Local", "Autre"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              )}
            </Field>
            <Field label="Surface habitable (m²)">
              {(id) => (
                <input
                  id={id}
                  name="surface"
                  type="number"
                  min="0.01"
                  max="100000"
                  step="0.01"
                  required
                  defaultValue={item?.surface}
                />
              )}
            </Field>
            <Field label="Contact propriétaire">
              {(id) => (
                <select
                  id={id}
                  name="contact_id"
                  defaultValue={item?.contact_id || ""}
                >
                  <option value="">Aucun contact</option>
                  {contacts
                    .filter((c) => ["seller", "both"].includes(c.kind))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              )}
            </Field>
            <Field label="Quartier">
              {(id) => (
                <input
                  id={id}
                  name="district"
                  maxLength={100}
                  defaultValue={details?.district}
                />
              )}
            </Field>
          </div>
          <details className="commercial-details">
            <summary>Caractéristiques, équipements et travaux</summary>
            <div className="form-grid">
              {(
                [
                  ["rooms", "Nombre de pièces", "1", "100"],
                  ["bedrooms", "Nombre de chambres", "0", "100"],
                  [
                    "construction_year",
                    "Année de construction",
                    "1000",
                    "2200",
                  ],
                  ["carrez_surface", "Surface Carrez (m²)", "0.01", "100000"],
                  ["land_surface", "Terrain (m²)", "0", "10000000"],
                  ["annual_charges", "Charges annuelles (€)", "0", "99999999"],
                  ["property_tax", "Taxe foncière (€)", "0", "99999999"],
                ] as const
              ).map(([key, label, min, max]) => (
                <Field key={key} label={label}>
                  {(id) => (
                    <input
                      id={id}
                      name={key}
                      type="number"
                      min={min}
                      max={max}
                      step={
                        ["rooms", "bedrooms", "construction_year"].includes(key)
                          ? "1"
                          : "0.01"
                      }
                      defaultValue={details?.[key] ?? ""}
                    />
                  )}
                </Field>
              ))}
              <Field label="Étage et ascenseur">
                {(id) => (
                  <input
                    id={id}
                    name="floor"
                    maxLength={50}
                    defaultValue={details?.floor}
                  />
                )}
              </Field>
              <Field label="DPE">
                {(id) => (
                  <select
                    id={id}
                    name="dpe"
                    defaultValue={details?.dpe || "Inconnu"}
                  >
                    {[
                      "Inconnu",
                      "A",
                      "B",
                      "C",
                      "D",
                      "E",
                      "F",
                      "G",
                      "Exempté",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="État général">
                {(id) => (
                  <textarea
                    id={id}
                    name="condition"
                    maxLength={500}
                    defaultValue={details?.condition}
                  />
                )}
              </Field>
              <Field label="Atouts et équipements">
                {(id) => (
                  <textarea
                    id={id}
                    name="features"
                    maxLength={2000}
                    placeholder="Garage, cave, terrasse, vue, exposition…"
                    defaultValue={details?.features}
                  />
                )}
              </Field>
              <Field label="Travaux à considérer">
                {(id) => (
                  <textarea
                    id={id}
                    name="works"
                    maxLength={2000}
                    defaultValue={details?.works}
                  />
                )}
              </Field>
            </div>
          </details>
          <div className="commercial-section-heading">
            <h3>Comparables et sources</h3>
            <Button
              type="button"
              variant="outline"
              disabled={comparables.length >= 30}
              onClick={() => {
                setComparables((rows) => [
                  ...rows,
                  {
                    key: crypto.randomUUID(),
                    label: "",
                    source: "",
                    url: null,
                    observed_date: new Date().toLocaleDateString("fr-CA", {
                      timeZone: "Europe/Paris",
                    }),
                    kind: "sale",
                    price: "",
                    surface: "",
                  },
                ]);
                guard.markDirty();
              }}
            >
              <Plus size={15} /> Ajouter un comparable
            </Button>
          </div>
          {!comparables.length && (
            <p className="commercial-status">
              Sans comparable, l’estimation sera présentée comme une évaluation
              manuelle.
            </p>
          )}
          {comparables.map((c, index) => (
            <div className="comparable-row" key={c.key}>
              <div className="commercial-section-heading">
                <h4>Référence {index + 1}</h4>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Retirer le comparable ${index + 1}`}
                  onClick={() => {
                    setComparables((rows) =>
                      rows.filter((r) => r.key !== c.key),
                    );
                    guard.markDirty();
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <div className="form-grid">
                <Field label={`Comparable ${index + 1} · désignation`}>
                  {(id) => (
                    <input
                      id={id}
                      minLength={2}
                      maxLength={180}
                      required
                      value={c.label}
                      onChange={(e) =>
                        changeComparable(c.key, { label: e.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label={`Comparable ${index + 1} · source`}>
                  {(id) => (
                    <input
                      id={id}
                      minLength={2}
                      maxLength={300}
                      required
                      placeholder="DVF, référence d’acte, annonce…"
                      value={c.source}
                      onChange={(e) =>
                        changeComparable(c.key, { source: e.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label={`Comparable ${index + 1} · nature du prix`}>
                  {(id) => (
                    <select
                      id={id}
                      value={c.kind}
                      onChange={(e) =>
                        changeComparable(c.key, {
                          kind: e.target.value as Comparable["kind"],
                        })
                      }
                    >
                      <option value="sale">
                        Vente constatée (source déclarée)
                      </option>
                      <option value="asking">Prix affiché d’une annonce</option>
                    </select>
                  )}
                </Field>
                <Field label={`Comparable ${index + 1} · date observée`}>
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      required
                      value={c.observed_date}
                      onChange={(e) =>
                        changeComparable(c.key, {
                          observed_date: e.target.value,
                        })
                      }
                    />
                  )}
                </Field>
                <Field label={`Comparable ${index + 1} · prix (€)`}>
                  {(id) => (
                    <input
                      id={id}
                      type="number"
                      min="0.01"
                      max="999999999"
                      step="0.01"
                      required
                      value={c.price}
                      onChange={(e) =>
                        changeComparable(c.key, { price: e.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label={`Comparable ${index + 1} · surface (m²)`}>
                  {(id) => (
                    <input
                      id={id}
                      type="number"
                      min="0.01"
                      max="100000"
                      step="0.01"
                      required
                      value={c.surface}
                      onChange={(e) =>
                        changeComparable(c.key, { surface: e.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label={`Comparable ${index + 1} · URL (facultative)`}>
                  {(id) => (
                    <input
                      id={id}
                      type="url"
                      value={c.url || ""}
                      onChange={(e) =>
                        changeComparable(c.key, { url: e.target.value || null })
                      }
                    />
                  )}
                </Field>
              </div>
            </div>
          ))}
          <div className="commercial-section-heading">
            <h3>Votre fourchette de valeur</h3>
          </div>
          <div className="form-grid">
            <Field label="Base de référence">
              {(id) => (
                <select
                  id={id}
                  value={basis}
                  onChange={(e) =>
                    setBasis(e.target.value as EstimateRecord["basis"])
                  }
                >
                  <option value="manual">Évaluation manuelle</option>
                  <option value="sale">Comparables de ventes</option>
                  <option value="asking">Comparables de prix affichés</option>
                </select>
              )}
            </Field>
            <div className="commercial-align-end">
              <Button type="button" variant="outline" onClick={suggest}>
                Suggérer depuis les comparables
              </Button>
            </div>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          <div className="commercial-price-grid">
            {(
              [
                ["low_price", "Valeur basse (€)"],
                ["central_price", "Valeur centrale (€)"],
                ["high_price", "Valeur haute (€)"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                {(id) => (
                  <input
                    id={id}
                    type="number"
                    min="0.01"
                    max="999999999"
                    step="0.01"
                    required
                    value={prices[key]}
                    onChange={(e) =>
                      setPrices((p) => ({ ...p, [key]: e.target.value }))
                    }
                  />
                )}
              </Field>
            ))}
          </div>
          <Field label="Analyse et stratégie de commercialisation">
            {(id) => (
              <textarea
                id={id}
                name="analysis"
                rows={6}
                maxLength={15000}
                defaultValue={item?.analysis}
                placeholder="Points valorisants, points pénalisants, travaux, réserves et stratégie proposée…"
              />
            )}
          </Field>
        </fieldset>
        <div className="commercial-actions">
          <Button
            type="button"
            variant="outline"
            disabled={lock.busy}
            onClick={guard.close}
          >
            Annuler
          </Button>
          <Button disabled={lock.busy}>
            {lock.busy ? "Enregistrement…" : "Enregistrer l’estimation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function EstimatesPage({
  contacts,
  readonly,
  onChanged,
  onEditing,
}: {
  contacts: Contact[];
  readonly: boolean;
  onChanged: () => Promise<void>;
  onEditing: (value: boolean) => void;
}) {
  const resource = useResource<{ items: EstimateRecord[]; limited: boolean }>(
    "/estimates",
  );
  const [editor, setEditor] = useState<EstimateRecord | "new" | null>(null);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");
  const [message, setMessage] = useState("");
  useEditing(editor !== null || !!downloading, onEditing);
  async function download(item: EstimateRecord) {
    setError("");
    setDownloading(item.id);
    try {
      saveFile(
        await api<Blob>(`/estimates/${item.id}/download`),
        `estimation-${item.id}.pdf`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading("");
    }
  }
  const items =
    resource.data?.items.filter(
      (item) =>
        (!status || item.status === status) &&
        `${item.title} ${item.address} ${item.city}`
          .toLocaleLowerCase("fr")
          .includes(filter.toLocaleLowerCase("fr")),
    ) || [];
  return (
    <section className="commercial-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">VOTRE EXPERTISE</div>
          <h1>Un prix, des références.</h1>
          <p>
            Conservez vos avis de valeur et présentez un rapport clair à chaque
            propriétaire.
          </p>
        </div>
        <Button disabled={readonly} onClick={() => setEditor("new")}>
          <Plus size={16} /> Nouvelle estimation
        </Button>
      </div>
      <div className="commercial-filters panel">
        <Field label="Rechercher une estimation">
          {(id) => (
            <input
              id={id}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Bien, adresse, commune…"
            />
          )}
        </Field>
        <Field label="Filtrer les estimations">
          {(id) => (
            <select
              id={id}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tous les statuts</option>
              {Object.entries(statuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <div className="notice">
        Les références sont renseignées par vos soins. Les prix affichés et les
        ventes constatées sont distingués. Aucune collecte DVF ni évaluation IA
        n’est effectuée dans cette version.
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
          Seules les 1 000 estimations les plus récentes sont affichées.
        </div>
      )}
      <div className="commercial-grid">
        {items.map((item) => (
          <article className="panel estimate-card" key={item.id}>
            <span className="badge">{statuses[item.status]}</span>
            <h2>{item.title}</h2>
            <p>
              {item.address}
              <br />
              {item.city} · {item.surface} m²
            </p>
            <strong className="estimate-central">
              {money(item.central_price)}
            </strong>
            <p>
              De {money(item.low_price)} à {money(item.high_price)}
            </p>
            <small>
              {item.comparables.length} comparable(s) ·{" "}
              {item.basis === "manual"
                ? "Évaluation manuelle"
                : item.basis === "sale"
                  ? "Références de ventes"
                  : "Références de prix affichés"}
            </small>
            <div className="commercial-actions">
              <Button
                variant="outline"
                disabled={readonly}
                onClick={() => setEditor(item)}
              >
                Modifier
              </Button>
              <Button
                variant="ghost"
                disabled={!!downloading}
                onClick={() => download(item)}
              >
                <Download size={15} />{" "}
                {downloading === item.id ? "Préparation…" : "Rapport PDF"}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {resource.data && !items.length && (
        <div className="empty">
          <h2>Aucune estimation à afficher.</h2>
          <p>
            Créez votre premier dossier avec vos caractéristiques et vos
            références de comparaison.
          </p>
        </div>
      )}
      {editor && (
        <EstimateForm
          item={editor === "new" ? undefined : editor}
          contacts={contacts}
          onClose={() => setEditor(null)}
          onSaved={() => {
            resource.refresh();
            setMessage("Estimation enregistrée.");
            void onChanged();
          }}
        />
      )}
    </section>
  );
}
