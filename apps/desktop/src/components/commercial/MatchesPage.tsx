import { useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import type { Contact, Mandate } from "../../types";
import { money } from "../../lib/utils";
import { Button } from "../ui/button";
import { Field, ResourceState, useResource } from "./shared";
import type { Match } from "./types";

export function MatchesPage({
  contacts,
  mandates,
  openContact,
  openMandate,
}: {
  contacts: Contact[];
  mandates: Mandate[];
  openContact: (contact: Contact) => void;
  openMandate: (mandate: Mandate) => void;
}) {
  const [buyer, setBuyer] = useState("");
  const [mandate, setMandate] = useState("");
  const [all, setAll] = useState(false);
  const query = new URLSearchParams();
  if (buyer) query.set("buyer_id", buyer);
  if (mandate) query.set("mandate_id", mandate);
  const revision = [...contacts, ...mandates]
    .map((item) => `${item.id}:${item.version}`)
    .join("|");
  const resource = useResource<{
    items: Match[];
    total: number;
    limited: boolean;
  }>("/matches?" + query.toString(), revision);
  const items =
    resource.data?.items.filter((item) => all || item.compatible) || [];
  return (
    <section className="commercial-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">INTELLIGENCE COMMERCIALE</div>
          <h1>Les bonnes rencontres.</h1>
          <p>
            Rapprochez les critères de vos acquéreurs des mandats que vous
            pouvez commercialiser.
          </p>
        </div>
        <Button variant="outline" onClick={resource.refresh}>
          <RefreshCw size={16} /> Actualiser
        </Button>
      </div>
      <div className="commercial-filters panel">
        <Field label="Acquéreur">
          {(id) => (
            <select
              id={id}
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
            >
              <option value="">Tous les acquéreurs</option>
              {contacts
                .filter((c) => ["buyer", "both"].includes(c.kind))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          )}
        </Field>
        <Field label="Mandat">
          {(id) => (
            <select
              id={id}
              value={mandate}
              onChange={(e) => setMandate(e.target.value)}
            >
              <option value="">Tous les mandats commercialisables</option>
              {mandates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.reference} · {m.property.title}
                </option>
              ))}
            </select>
          )}
        </Field>
        <label className="commercial-check">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => setAll(e.target.checked)}
          />{" "}
          Afficher aussi les écarts
        </label>
      </div>
      <div className="notice">
        Le score décrit trois contrôles : budget, surface et commune. Les
        chambres, le financement et les critères libres restent à vérifier.
        Seuls les mandats actifs ou sous offre, non expirés et autorisés sont
        analysés. Aucun message n’est envoyé.
      </div>
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
      {resource.data?.limited && (
        <div className="notice">
          500 résultats affichés sur {resource.data.total}. Sélectionnez un
          acquéreur ou un mandat pour affiner.
        </div>
      )}
      <div className="commercial-grid">
        {items.map((item) => (
          <article
            className="panel match-card"
            key={item.buyer_id + item.mandate_id}
          >
            <div className="match-top">
              <span className={item.compatible ? "badge badge-green" : "badge"}>
                {item.compatible ? "Piste à vérifier" : "Écart identifié"}
              </span>
              <strong>{item.score} %</strong>
            </div>
            <h2>{item.buyer_name}</h2>
            <p>
              {item.reference} · {item.title}
            </p>
            <strong>
              {money(item.price)} · {item.city}
            </strong>
            <ul className="match-checks">
              {item.checks.map((s) => (
                <li key={s}>✓ {s}</li>
              ))}
              {item.failures.map((s) => (
                <li className="match-failure" key={s}>
                  Écart : {s}
                </li>
              ))}
            </ul>
            <details>
              <summary>Points à vérifier ({item.to_verify.length})</summary>
              <ul>
                {item.to_verify.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </details>
            <div className="commercial-actions">
              <Button
                variant="outline"
                onClick={() => {
                  const c = contacts.find((c) => c.id === item.buyer_id);
                  if (c) openContact(c);
                }}
              >
                Acquéreur
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const m = mandates.find((m) => m.id === item.mandate_id);
                  if (m) openMandate(m);
                }}
              >
                Mandat <ArrowRight size={15} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {resource.data && !items.length && (
        <div className="empty">
          <h2>Aucun rapprochement à afficher.</h2>
          <p>
            Renseignez les critères acquéreurs et ajoutez un mandat
            commercialisable, ou affichez les écarts.
          </p>
        </div>
      )}
    </section>
  );
}
