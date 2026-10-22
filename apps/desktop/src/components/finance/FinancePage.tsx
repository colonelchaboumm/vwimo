import { useState } from "react";
import { Download, Plus, RefreshCw } from "lucide-react";
import { api, saveFile } from "../../api";
import type { Contact } from "../../types";
import { dateText } from "../../lib/utils";
import { financeMoney as money } from "./types";
import { ResourceState, useEditing, useResource } from "../commercial/shared";
import { Button } from "../ui/button";
import { IncomeForm } from "./IncomeForm";
import { IncomeDetail } from "./IncomeDetail";
import { PlanForm } from "./PlanForm";
import {
  bases,
  categories,
  incomeStatuses,
  type Income,
  type Plan,
  type Transaction,
} from "./types";

type Totals = {
  forecast: string;
  acquired: string;
  received: string;
  outstanding_all_years: string;
};
export function FinancePage({
  contacts,
  role,
  onEditing,
}: {
  contacts: Contact[];
  role: string;
  onEditing: (value: boolean) => void;
}) {
  const readonly = role === "reader";
  const [year, setYear] = useState(new Date().getFullYear());
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState("incomes");
  const [editor, setEditor] = useState<Income | "new" | null>(null);
  const [detail, setDetail] = useState<Income | null>(null);
  const [planForm, setPlanForm] = useState<Plan | "new" | null>(null);
  const [error, setError] = useState("");
  const incomes = useResource<{ items: Income[]; total: number }>(
    "/finance/incomes?offset=" + offset,
  );
  const plans = useResource<{ items: Plan[]; limited: boolean }>(
    "/finance/plans",
  );
  const transactions = useResource<{ items: Transaction[]; total: number }>(
    "/transactions?limit=100",
  );
  const summary = useResource<{ year: number; totals: Record<string, Totals> }>(
    "/finance/summary?year=" + year,
  );
  const summaryData = summary.data;
  useEditing(!!editor || !!detail || !!planForm, onEditing);
  function refresh() {
    incomes.refresh();
    plans.refresh();
    summary.refresh();
    transactions.refresh();
  }
  async function download() {
    setError("");
    try {
      saveFile(
        await api<Blob>("/finance/export/download"),
        "revenus-immo-pilot.csv",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="commercial-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">FINANCE & PARTENAIRES</div>
          <h1>Votre activité prend de la valeur.</h1>
          <p>
            Suivez séparément vos parts vente, entrées de mandat et
            rémunérations de partenaires.
          </p>
        </div>
        <div className="commercial-actions">
          <Button variant="outline" onClick={refresh}>
            <RefreshCw size={15} />
            Actualiser
          </Button>
          <Button variant="outline" onClick={() => void download()}>
            <Download size={15} />
            Exporter les revenus CSV
          </Button>
          <Button
            disabled={
              readonly ||
              plans.loading ||
              transactions.loading ||
              !!plans.error ||
              !!transactions.error
            }
            onClick={() => setEditor("new")}
          >
            <Plus size={15} />
            Nouveau revenu
          </Button>
        </div>
      </div>
      <div className="notice">
        Suivi de montants déclarés, avant calcul de votre fiscalité personnelle.
        TVA, impôt sur le revenu et cotisations sociales sont distincts et ne
        sont pas calculés ici. Les montants HT, TTC et contractuels sont
        présentés séparément. Aucune facture ni déclaration officielle n’est
        émise.
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="commercial-actions finance-tabs">
        <Button
          variant={tab === "incomes" ? "default" : "outline"}
          onClick={() => setTab("incomes")}
        >
          Revenus & encaissements
        </Button>
        <Button
          variant={tab === "plans" ? "default" : "outline"}
          onClick={() => setTab("plans")}
        >
          Barèmes contractuels
        </Button>
      </div>
      {tab === "incomes" ? (
        <>
          <div className="finance-year">
            <label htmlFor="finance-year">
              Année des prévisions, validations et encaissements
            </label>
            <input
              id="finance-year"
              type="number"
              min="1900"
              max="2100"
              value={year}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isInteger(value) && value >= 1900 && value <= 2100)
                  setYear(value);
              }}
            />
          </div>
          <ResourceState
            error={summary.error}
            loading={summary.loading}
            retry={summary.refresh}
          />
          {summaryData &&
            Object.entries(bases).map(([basis, label]) => (
              <div key={basis} className="finance-summary">
                <h2>{label}</h2>
                <div className="prospect-stats">
                  {[
                    [
                      "Prévisions · " + year,
                      summaryData.totals[basis].forecast,
                    ],
                    [
                      "Validés par vous · " + year,
                      summaryData.totals[basis].acquired,
                    ],
                    [
                      "Encaissés déclarés · " + year,
                      summaryData.totals[basis].received,
                    ],
                    [
                      "Reste à encaisser · toutes années",
                      summaryData.totals[basis].outstanding_all_years,
                    ],
                  ].map(([title, value]) => (
                    <div key={title} className="panel">
                      <span>{title}</span>
                      <strong>{money(value)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          <ResourceState
            error={incomes.error}
            loading={incomes.loading}
            retry={incomes.refresh}
          />
          <ResourceState
            error={transactions.error}
            loading={transactions.loading}
            retry={transactions.refresh}
          />
          <ResourceState
            error={plans.error}
            loading={plans.loading}
            retry={plans.refresh}
          />
          <h2 className="radar-section-title">
            Tous les revenus · {incomes.data?.total || 0}
          </h2>
          <p className="commercial-status">
            La liste ci-dessous comprend toutes les années. Les prévisions sont
            des calculs enregistrés ; la validation recalcule le cumul courant.
          </p>
          <div className="commercial-grid">
            {incomes.data?.items.map((item) => (
              <article key={item.id} className="panel radar-card">
                <div className="match-top">
                  <span className="radar-pill">
                    {incomeStatuses[item.status]}
                  </span>
                  <span>{categories[item.category]}</span>
                </div>
                <h2>{item.title}</h2>
                <p>
                  {item.reference} · {item.partner}
                </p>
                <div className="radar-price">
                  {money(item.amount)}
                  <small>{bases[item.amount_basis]}</small>
                </div>
                <p>
                  Règlement prévu : {dateText(item.expected_on)}
                  <br />
                  Validé le :{" "}
                  {item.earned_on ? dateText(item.earned_on) : "non validé"}
                </p>
                {item.status === "acquired" && (
                  <p>
                    Encaissé déclaré : {money(item.paid)}
                    <br />
                    Reste : {money(item.remaining)}
                  </p>
                )}
                {item.overdue && (
                  <p className="finance-alert">
                    Date de règlement prévue dépassée · reste à encaisser
                  </p>
                )}
                <div className="commercial-actions">
                  <Button variant="outline" onClick={() => setDetail(item)}>
                    Calcul et encaissements
                  </Button>
                  {item.status === "forecast" && (
                    <Button
                      variant="ghost"
                      disabled={readonly || !plans.data || !transactions.data}
                      onClick={() => setEditor(item)}
                    >
                      Modifier la prévision
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {incomes.data && !incomes.data.items.length && (
            <div className="panel radar-empty">
              <h2>Vos revenus commencent par vos conditions.</h2>
              <p>
                Ajoutez une rémunération fixe ou créez votre barème à partir de
                votre contrat.
              </p>
            </div>
          )}
          {incomes.data && (
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
                disabled={offset + 40 >= incomes.data.total}
                onClick={() => setOffset((v) => v + 40)}
              >
                Page suivante
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="commercial-actions finance-footer">
            <Button
              disabled={role !== "admin"}
              onClick={() => setPlanForm("new")}
            >
              <Plus size={15} />
              Nouveau barème
            </Button>
          </div>
          <p className="commercial-status">
            Chaque barème dispose de son propre cumul. Les conditions
            enregistrées restent figées ; dupliquez-les pour une nouvelle
            version et renseignez la reprise de cumul si nécessaire.
          </p>
          <ResourceState
            error={plans.error}
            loading={plans.loading}
            retry={plans.refresh}
          />
          {plans.data?.limited && (
            <p className="notice">Les 500 derniers barèmes sont affichés.</p>
          )}
          <div className="commercial-grid">
            {plans.data?.items.map((plan) => (
              <article key={plan.id} className="panel radar-card">
                <span className="radar-pill">
                  {plan.method === "global"
                    ? "Global avec rattrapage"
                    : "Marginal par tranche"}
                </span>
                <h2>{plan.name}</h2>
                <p>
                  {plan.partner}
                  <br />
                  {plan.base_label}
                  <br />
                  {bases[plan.amount_basis]} · cumul{" "}
                  {plan.period === "year" ? "annuel" : "mensuel"}
                </p>
                <ul className="finance-plan-tiers">
                  {plan.tiers.map((tier) => (
                    <li key={tier.threshold}>
                      À partir de {money(tier.threshold)} : {tier.rate} %
                    </li>
                  ))}
                </ul>
                <p>
                  Du {dateText(plan.effective_from)}
                  {plan.effective_to
                    ? " au " + dateText(plan.effective_to)
                    : " · sans fin renseignée"}
                  <br />
                  Reprise saisie : {money(plan.opening_base)}
                  {plan.opening_on ? " au " + dateText(plan.opening_on) : ""}
                </p>
                <Button
                  variant="outline"
                  disabled={role !== "admin"}
                  onClick={() => setPlanForm(plan)}
                >
                  Dupliquer le barème
                </Button>
              </article>
            ))}
          </div>
          {plans.data && !plans.data.items.length && (
            <div className="panel radar-empty">
              <h2>Vos pourcentages, vos contrats.</h2>
              <p>
                Aucun pourcentage fictif n’est prérempli. Enregistrez vos
                conditions réelles ou utilisez un montant fixe par revenu.
              </p>
            </div>
          )}
        </>
      )}
      {editor && plans.data && transactions.data && (
        <IncomeForm
          item={editor === "new" ? undefined : editor}
          plans={plans.data.items}
          transactions={transactions.data.items}
          contacts={contacts}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            refresh();
          }}
        />
      )}
      {detail && (
        <IncomeDetail
          item={detail}
          readonly={readonly}
          onClose={() => setDetail(null)}
          onChanged={() => {
            incomes.refresh();
            summary.refresh();
            plans.refresh();
          }}
        />
      )}
      {planForm && (
        <PlanForm
          copy={planForm === "new" ? undefined : planForm}
          onClose={() => setPlanForm(null)}
          onSaved={() => {
            setPlanForm(null);
            plans.refresh();
          }}
        />
      )}
    </section>
  );
}
