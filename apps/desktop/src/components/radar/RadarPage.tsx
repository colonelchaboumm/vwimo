import { useState } from "react";
import { ArrowDownRight, Plus, RefreshCw, Upload } from "lucide-react";
import { api } from "../../api";
import { money, dateText } from "../../lib/utils";
import {
  Field,
  ResourceState,
  useEditing,
  useResource,
  useSubmitLock,
} from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { ListingForm } from "./ListingForm";
import { RadarImport } from "./RadarImport";
import {
  sellerLabels,
  statusLabels,
  type Listing,
  type ListingDetail,
} from "./types";

function Detail({
  identifier,
  onClose,
}: {
  identifier: string;
  onClose: () => void;
}) {
  const resource = useResource<ListingDetail>("/radar/" + identifier);
  const item = resource.data;
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Observations de l’annonce"
      description="Prix et similitudes issus uniquement des données déclarées dans le radar."
    >
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
      {item && (
        <div className="radar-detail">
          <h3>
            {item.title} · {item.city}
          </h3>
          <p>{item.description || "Aucune description enregistrée."}</p>
          <p>
            Source : {item.source_name} ·{" "}
            {item.provenance === "csv" ? "Import CSV" : "Saisie manuelle"}
          </p>
          {item.source_url && (
            <p>
              <a href={item.source_url} target="_blank" rel="noreferrer">
                Consulter la source déclarée
              </a>
            </p>
          )}
          <p>Droits / origine : {item.rights_note || "Non renseignés"}</p>
          <h3>Historique des prix déclarés</h3>
          <ol>
            {item.prices.map((p) => (
              <li key={p.id}>
                <strong>{money(p.price)}</strong> · observation du{" "}
                {dateText(p.observed_on)}
                <small>{p.note}</small>
              </li>
            ))}
          </ol>
          <h3>Doublons possibles · {item.possible_duplicates.length}</h3>
          <p>
            Même commune et type de bien, surface à ±5 %. Il s’agit de pistes à
            vérifier, sans fusion ni preuve d’identité du bien.
          </p>
          <ul>
            {item.possible_duplicates.map((p) => (
              <li key={p.id}>
                {p.title} · {p.source_name} · {p.surface} m² · {money(p.price)}
              </li>
            ))}
          </ul>
          {!item.possible_duplicates.length && (
            <p>Aucune similitude selon ces critères dans le radar actuel.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

export function RadarPage({
  readonly,
  onEditing,
}: {
  readonly: boolean;
  onEditing: (value: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [seller, setSeller] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [editor, setEditor] = useState<Listing | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useSubmitLock();
  const query = new URLSearchParams({
    q,
    seller_type: seller,
    status,
    offset: String(offset),
  });
  const resource = useResource<{
    items: Listing[];
    total: number;
    limit: number;
  }>("/radar?" + query);
  useEditing(!!editor || importing || lock.busy, onEditing);
  async function prospect(item: Listing) {
    if (!lock.start()) return;
    setError("");
    setNotice("");
    try {
      await api("/prospects", {
        method: "POST",
        body: JSON.stringify({ listing_id: item.id }),
      });
      setNotice(
        "Prospect ajouté. Ouvrez Prospection pour déclarer ses autorisations et préparer le suivi. Aucun message envoyé.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  function saved() {
    setEditor(null);
    resource.refresh();
    setNotice("Annonce enregistrée. Les mandats n’ont pas été modifiés.");
  }
  return (
    <section className="commercial-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">VEILLE & CONQUÊTE DE MANDATS</div>
          <h1>Votre radar immobilier.</h1>
          <p>
            Centralisez vos annonces sourcées, suivez les prix et préparez vos
            prochaines prises de contact.
          </p>
        </div>
        <div className="commercial-actions">
          <Button variant="outline" onClick={resource.refresh}>
            <RefreshCw size={15} /> Actualiser
          </Button>
          <Button
            variant="outline"
            disabled={readonly}
            onClick={() => setImporting(true)}
          >
            <Upload size={15} /> Importer CSV
          </Button>
          <Button disabled={readonly} onClick={() => setEditor("new")}>
            <Plus size={16} /> Ajouter une annonce
          </Button>
        </div>
      </div>
      <div className="notice">
        Radar alimenté par saisie et CSV, sans collecte automatique. Les prix
        sont déclarés, pas vérifiés sur les portails. Ces annonces ne sont
        jamais ajoutées automatiquement aux mandats proposés aux acquéreurs.
      </div>
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="commercial-filters panel">
        <Field label="Rechercher dans le radar">
          {(id) => (
            <input
              id={id}
              value={q}
              maxLength={120}
              placeholder="Titre, commune, source, adresse…"
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
            />
          )}
        </Field>
        <Field label="Vendeur radar">
          {(id) => (
            <select
              id={id}
              value={seller}
              onChange={(e) => {
                setSeller(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Tous les vendeurs</option>
              {Object.entries(sellerLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="État radar">
          {(id) => (
            <select
              id={id}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Tous les états</option>
              {Object.entries(statusLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
      {resource.data && (
        <>
          <p className="commercial-status">
            {resource.data.total} annonce(s) · page{" "}
            {Math.floor(offset / 40) + 1}
          </p>
          <div className="commercial-grid">
            {resource.data.items.map((item) => (
              <article className="panel radar-card" key={item.id}>
                <div className="match-top">
                  <span className="radar-pill">
                    {sellerLabels[item.seller_type]}
                  </span>
                  <span>{statusLabels[item.status]}</span>
                </div>
                <h2>{item.title}</h2>
                <p>
                  {item.city}
                  {item.district ? " · " + item.district : ""} ·{" "}
                  {item.property_type} · {item.surface} m²
                </p>
                <div className="radar-price">
                  {money(item.price)}
                  <small>{money(item.price_per_m2)} / m² affiché</small>
                </div>
                <div className="radar-signals">
                  {item.price_drop && (
                    <span>
                      <ArrowDownRight size={14} /> Baisse depuis{" "}
                      {money(item.first_price)}
                    </span>
                  )}
                  {item.age_days !== null && item.age_days >= 30 && (
                    <span>
                      Publication déclarée depuis {item.age_days} jours
                    </span>
                  )}
                  {!item.published_on && (
                    <span>Date de publication inconnue</span>
                  )}
                </div>
                <p>
                  Source : {item.source_name}
                  <br />
                  Observée le {dateText(item.observed_on)}
                </p>
                <div className="commercial-actions">
                  <Button variant="outline" onClick={() => setDetail(item.id)}>
                    Voir les observations
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={readonly}
                    onClick={() => setEditor(item)}
                  >
                    Modifier l’annonce
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      readonly ||
                      lock.busy ||
                      item.seller_type !== "private" ||
                      item.status !== "active"
                    }
                    onClick={() => void prospect(item)}
                  >
                    Ajouter en prospection
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {!resource.data.items.length && (
            <div className="panel radar-empty">
              <h2>Votre prochaine piste commence ici.</h2>
              <p>
                Ajoutez une annonce ou importez votre fichier CSV pour démarrer
                la veille.
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
              disabled={offset + 40 >= resource.data.total}
              onClick={() => setOffset((v) => v + 40)}
            >
              Page suivante
            </Button>
          </div>
        </>
      )}
      {editor && (
        <ListingForm
          item={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
      {detail && <Detail identifier={detail} onClose={() => setDetail("")} />}
      {importing && (
        <RadarImport
          onClose={() => setImporting(false)}
          onSaved={(message) => {
            setImporting(false);
            setNotice(message);
            resource.refresh();
          }}
        />
      )}
    </section>
  );
}
