import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ResourceState, useResource } from "../commercial/shared";
import { Button } from "../ui/button";
import {
  bases,
  categories,
  financeMoney,
  transactionStages,
} from "../finance/types";
import { parisInput } from "../radar/types";
import { referralStages } from "./types";

type Amounts = { forecast: string; acquired: string; received: string };
type Data = {
  year: number;
  stocks: {
    contacts: number;
    partners: number;
    mandates: Record<string, number>;
    transactions: Record<string, number>;
    referrals: Record<string, number>;
  };
  annual: {
    signed_count: number;
    sale_volume: string;
    compromise_to_deed_days: string | null;
    delay_samples: number;
    prospect_activities: Record<string, number>;
    calendar_entries: Record<string, number>;
    referrals_opened: number;
  };
  financial: Record<
    string,
    {
      months: (Amounts & { month: number })[];
      categories: Record<string, Amounts>;
    }
  >;
};
const mandateLabels: Record<string, string> = {
  preparation: "En préparation",
  active: "Actifs",
  offer: "Avec offre",
  compromise: "Sous compromis",
  sold: "Vendus",
  expired: "Expirés",
  withdrawn: "Retirés",
};
const activityLabels: Record<string, string> = {
  initial: "Contacts initiaux déclarés",
  followup: "Relances déclarées",
  reply: "Réponses déclarées",
  refusal: "Refus déclarés",
  appointment: "Rendez-vous déclarés",
  estimate: "Estimations déclarées",
  mandate: "Mandats déclarés",
  note: "Notes enregistrées",
};
const calendarLabels: Record<string, string> = {
  visit: "Visites planifiées",
  estimate: "Estimations planifiées",
  seller: "Rendez-vous vendeurs",
  buyer: "Rendez-vous acquéreurs",
  signing: "Signatures planifiées",
  other: "Autres rendez-vous",
};
function Counts({
  title,
  values,
  labels,
}: {
  title: string;
  values: Record<string, number>;
  labels: Record<string, string>;
}) {
  return (
    <section className="panel pilotage-panel">
      <h2>{title}</h2>
      {Object.entries(labels).map(([key, label]) => (
        <p className="pilotage-row" key={key}>
          <span>{label}</span>
          <strong>{values[key] || 0}</strong>
        </p>
      ))}
    </section>
  );
}
export function StatisticsPage() {
  const [year, setYear] = useState(Number(parisInput().slice(0, 4)));
  const [basis, setBasis] = useState("contract");
  const resource = useResource<Data>("/pilotage?year=" + year);
  const data = resource.data;
  const finance = data?.financial[basis];
  return (
    <section className="commercial-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">PILOTAGE DE VOTRE ACTIVITÉ</div>
          <h1>Vos chiffres, en perspective.</h1>
          <p>
            Portefeuille actuel, activité annuelle et revenus enregistrés, avec
            leurs périmètres.
          </p>
        </div>
        <Button variant="outline" onClick={resource.refresh}>
          <RefreshCw size={15} />
          Actualiser
        </Button>
      </div>
      <div className="notice">
        Ces indicateurs décrivent vos dossiers locaux. Les actions de
        prospection sont déclarées, les rendez-vous sont planifiés et les ventes
        sont déclarées signées. Aucun taux de conversion causal, facture, impôt
        ou cotisation n’est déduit.
      </div>
      <div className="finance-year">
        <label htmlFor="pilotage-year">
          Année des événements et des montants
        </label>
        <input
          id="pilotage-year"
          type="number"
          min="1900"
          max="2100"
          value={year}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isInteger(v) && v >= 1900 && v <= 2100) setYear(v);
          }}
        />
      </div>
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
      {data && (
        <>
          <h2 className="radar-section-title">Dans l’année {year}</h2>
          <div className="prospect-stats">
            <div className="panel">
              <span>Ventes déclarées signées</span>
              <strong>{data.annual.signed_count}</strong>
            </div>
            <div className="panel">
              <span>Volume des prix de vente · pas un revenu</span>
              <strong>{financeMoney(data.annual.sale_volume)}</strong>
            </div>
            <div className="panel">
              <span>Compromis → acte · délai moyen</span>
              <strong>
                {data.annual.compromise_to_deed_days !== null
                  ? data.annual.compromise_to_deed_days + " j"
                  : "Non calculable"}
              </strong>
              <small>
                {data.annual.delay_samples} vente(s) avec les deux dates
              </small>
            </div>
            <div className="panel">
              <span>Dossiers partenaires ouverts</span>
              <strong>{data.annual.referrals_opened}</strong>
            </div>
          </div>
          <p className="pilotage-caption">
            Les ventes sont sélectionnées par date d’acte effectuée et étape
            actuelle « Vente signée ». Le délai utilise les seules ventes dont
            les dates de compromis et d’acte sont renseignées.
          </p>
          <div className="pilotage-grid">
            <Counts
              title="Journal de prospection · année"
              values={data.annual.prospect_activities}
              labels={activityLabels}
            />
            <Counts
              title="Agenda · année du début"
              values={data.annual.calendar_entries}
              labels={calendarLabels}
            />
          </div>
          <h2 className="radar-section-title">
            Portefeuille actuel · toutes années
          </h2>
          <p className="pilotage-caption">
            {data.stocks.contacts} contacts actifs · {data.stocks.partners}{" "}
            partenaires actifs. Les répartitions ci-dessous reflètent l’état
            actuel ; le sélecteur d’année ne les filtre pas.
          </p>
          <div className="pilotage-grid">
            <Counts
              title="Mandats · état actuel"
              values={data.stocks.mandates}
              labels={mandateLabels}
            />
            <Counts
              title="Transactions · état actuel"
              values={data.stocks.transactions}
              labels={transactionStages}
            />
            <Counts
              title="Mises en relation · état actuel"
              values={data.stocks.referrals}
              labels={referralStages}
            />
          </div>
          <h2 className="radar-section-title">
            Revenus et encaissements · {year}
          </h2>
          <div className="finance-year">
            <label htmlFor="pilotage-basis">Nature des montants</label>
            <select
              id="pilotage-basis"
              value={basis}
              onChange={(e) => setBasis(e.target.value)}
            >
              {Object.entries(bases).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <p className="pilotage-caption">
            Prévisions : date prévue de règlement, calcul conservé au dernier
            enregistrement. Validés : date de validation du revenu. Encaissés :
            date du versement déclaré, même pour un revenu validé une autre
            année. Ces colonnes se lisent séparément et ne s’additionnent pas.
            Les bases HT, TTC et contractuelles restent séparées.
          </p>
          {finance && (
            <>
              <div
                className="pilotage-table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Revenus mensuels"
              >
                <table className="pilotage-table">
                  <caption>Répartition mensuelle · {bases[basis]}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Mois</th>
                      <th scope="col">Prévisions</th>
                      <th scope="col">Validés par vous</th>
                      <th scope="col">Encaissés déclarés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.months.map((row) => (
                      <tr key={row.month}>
                        <th scope="row">
                          {new Intl.DateTimeFormat("fr-FR", {
                            month: "long",
                            timeZone: "UTC",
                          }).format(new Date(Date.UTC(year, row.month - 1, 1)))}
                        </th>
                        <td>{financeMoney(row.forecast)}</td>
                        <td>{financeMoney(row.acquired)}</td>
                        <td>{financeMoney(row.received)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                className="pilotage-table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Revenus par origine"
              >
                <table className="pilotage-table">
                  <caption>Répartition par origine · {bases[basis]}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Origine</th>
                      <th scope="col">Prévisions</th>
                      <th scope="col">Validés par vous</th>
                      <th scope="col">Encaissés déclarés</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(categories).map(([key, label]) => {
                      const row = finance.categories[key];
                      return (
                        <tr key={key}>
                          <th scope="row">{label}</th>
                          <td>{financeMoney(row?.forecast || "0")}</td>
                          <td>{financeMoney(row?.acquired || "0")}</td>
                          <td>{financeMoney(row?.received || "0")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
