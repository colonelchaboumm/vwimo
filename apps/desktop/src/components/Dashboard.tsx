import {
  ArrowDownRight,
  ArrowRight,
  Building2,
  FileText,
  MapPin,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  Clock3,
  CheckCircle2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "../lib/utils";
import type { Bundle, Mandate } from "../types";
import { kinds, statuses } from "../types";
import { Button } from "./ui/button";

export function Dashboard({
  data,
  openMandate,
  navigate,
  newMandate,
  readonly,
  name,
  syncLabel,
}: {
  data: Bundle;
  openMandate: (m: Mandate) => void;
  navigate: (page: string) => void;
  newMandate: () => void;
  readonly: boolean;
  name: string;
  syncLabel: string;
}) {
  const d = data.dashboard;
  const chart = d.months.map((m) => ({
    ...m,
    label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(
      new Date(m.month + "-15"),
    ),
  }));
  const metrics = [
    {
      label: "Mandats en portefeuille",
      value: d.active,
      detail: `${d.exclusive} exclusifs · ${d.simple} simples · ${d.partner} intercabinet`,
      icon: Building2,
      tag: "En cours",
    },
    {
      label: "Acquéreurs à accompagner",
      value: d.buyers,
      detail: "Des projets à concrétiser",
      icon: Users,
      tag: "Portefeuille",
    },
    {
      label: "Valeur du portefeuille",
      value: money(d.portfolio),
      detail: "Prix affichés des mandats en cours",
      icon: TrendingUp,
      tag: "Prix de vente",
    },
    {
      label: "Honoraires potentiels",
      value: money(d.fees_potential),
      detail: "Avant partage · non acquis",
      icon: FileText,
      tag: "Prévisionnel",
    },
  ];
  return (
    <>
      <div className="welcome">
        <div>
          <div className="eyebrow">
            {new Intl.DateTimeFormat("fr-FR", {
              timeZone: "Europe/Paris",
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </div>
          <h1>
            Bonjour, {name}
            <span>.</span>
          </h1>
          <p>Vos projets avancent. Voici l’essentiel de votre activité.</p>
        </div>
        <Button onClick={newMandate} disabled={readonly}>
          <Plus size={17} />
          Nouveau mandat
        </Button>
      </div>
      <div className="overview-strip">
        <span>
          <span className="live-dot" />
          {syncLabel}
        </span>
        <span>
          <MapPin size={14} /> Annecy & Grand Annecy
        </span>
      </div>
      <div className="metrics">
        {metrics.map((m, i) => (
          <article className="metric" key={m.label}>
            <div className="metric-top">
              <span className={`metric-icon metric-icon-${i}`}>
                <m.icon size={19} />
              </span>
              <span className="metric-tag">{m.tag}</span>
            </div>
            <p>{m.label}</p>
            <strong>{m.value}</strong>
            <small>{m.detail}</small>
          </article>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Votre dynamique commerciale</h2>
              <p>Mandats signés au cours des six derniers mois</p>
            </div>
            <span className="quiet-tag">6 derniers mois</span>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chart}
                margin={{ top: 12, right: 16, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#007aff" stopOpacity={0.2} />
                    <stop
                      offset="100%"
                      stopColor="#007aff"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="4 5"
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  dy={12}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v) => [v, "Mandats signés"]}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--panel)",
                    color: "var(--text)",
                  }}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="count"
                  stroke="#007aff"
                  strokeWidth={2.5}
                  fill="url(#chartFill)"
                  dot={{
                    r: 4,
                    fill: "#007aff",
                    strokeWidth: 3,
                    stroke: "var(--panel)",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footer">
            <span>
              <span className="legend-dot" />
              Mandats signés
            </span>
            <span>Source : votre portefeuille</span>
          </div>
        </section>
        <section className="panel priorities">
          <div className="panel-heading">
            <div>
              <h2>
                Vos prochaines actions{" "}
                <span className="count">{d.priorities.length}</span>
              </h2>
              <p>Les dossiers qui méritent votre attention</p>
            </div>
            <Clock3 size={19} />
          </div>
          <div className="priority-list">
            {d.priorities.length ? (
              d.priorities.slice(0, 3).map((a, i) => (
                <button
                  className="priority-item"
                  key={a.id}
                  onClick={() => {
                    const m = data.mandates.find((m) => m.id === a.id);
                    if (m) openMandate(m);
                  }}
                >
                  <span className={`priority-number ${a.level}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{a.title}</strong>
                    <small>
                      {a.reference} · {a.detail}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))
            ) : (
              <div className="empty compact">
                <CheckCircle2 />
                <p>Aucune échéance prioritaire détectée.</p>
              </div>
            )}
          </div>
          <div className="priority-note">
            <Sparkles size={15} />
            <span>Rappels calculés sur les dates de vos mandats.</span>
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel portfolio-panel">
          <div className="panel-heading">
            <div>
              <h2>Au cœur de votre portefeuille</h2>
              <p>Vos derniers mandats, prêts à avancer</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("mandates")}
            >
              Tout voir <ArrowRight size={15} />
            </Button>
          </div>
          <div className="mini-mandates">
            {data.mandates.slice(0, 3).map((m, i) => (
              <button
                key={m.id}
                className="mini-mandate"
                onClick={() => openMandate(m)}
              >
                <div className={`property-art art-${i}`} aria-hidden="true">
                  <Building2 size={36} strokeWidth={1} />
                  <span>{m.property.property_type}</span>
                </div>
                <div className="mini-property-info">
                  <span className="tiny-label">
                    {m.reference} · {kinds[m.kind]}
                  </span>
                  <strong>{m.property.title}</strong>
                  <span className="location">
                    <MapPin size={12} />
                    {m.property.city} · {m.property.surface} m²
                  </span>
                  <div>
                    <b>{money(m.price)}</b>
                    <span className={`badge badge-${m.status}`}>
                      {statuses[m.status]}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {!data.mandates.length && (
            <div className="empty">Votre premier mandat apparaîtra ici.</div>
          )}
        </section>
        <section className="charlie-card">
          <div className="charlie-orb">
            <Sparkles size={25} />
          </div>
          <span className="tiny-label">VOTRE FUTUR COPILOTE</span>
          <h2>
            Faites place
            <br />à Charlie.
          </h2>
          <p>
            Un assistant pour préparer vos rendez-vous et faire avancer vos
            dossiers.
          </p>
          <div className="coming-label">Intégration prévue · Phase 2</div>
          <Button variant="ghost" onClick={() => navigate("settings")}>
            Voir les connexions <ArrowDownRight size={17} />
          </Button>
        </section>
      </div>
      <div className="dashboard-footnote">
        Les montants affichés proviennent de vos mandats. Les honoraires
        potentiels ne constituent pas un revenu encaissé.
      </div>
    </>
  );
}
