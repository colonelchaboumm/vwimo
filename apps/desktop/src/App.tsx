import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  FileText,
  FolderOpen,
  Handshake,
  House,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Mail,
  Map,
  MapPin,
  Megaphone,
  Moon,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Target,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { api, getSessionGeneration, saveFile, setToken } from "./api";
import {
  normalizeSearch,
  readPreference,
  writePreference,
} from "./lib/preferences";
import { RecordDetails } from "./components/RecordDetails";
import { UpdateCenter } from "./components/UpdateCenter";
import { CalendarPage } from "./components/commercial/CalendarPage";
import { EstimatesPage } from "./components/commercial/EstimatesPage";
import { MatchesPage } from "./components/commercial/MatchesPage";
import "./components/commercial/commercial.css";
import { CharliePage } from "./components/charlie/CharliePage";
import "./components/charlie/charlie.css";
import { RadarPage } from "./components/radar/RadarPage";
import { ProspectingPage } from "./components/radar/ProspectingPage";
import { PropertyMapPage } from "./components/radar/PropertyMapPage";
import { OutlookSetup } from "./components/OutlookSetup";
import { TransactionsPage } from "./components/finance/TransactionsPage";
import { FinancePage } from "./components/finance/FinancePage";
import { PartnersPage } from "./components/partners/PartnersPage";
import { StatisticsPage } from "./components/partners/StatisticsPage";
import { MarketingPage } from "./components/marketing/MarketingPage";
import "./components/marketing/marketing.css";
import "./components/partners/partners.css";
import "./components/finance/finance.css";
import "./components/radar/radar.css";
import { Button } from "./components/ui/button";
import { Modal } from "./components/ui/dialog";
import { ContactForm, DocumentForm, MandateForm } from "./components/Forms";
import { Dashboard } from "./components/Dashboard";
import { dateText, money } from "./lib/utils";
import type {
  Account,
  Audit,
  Bundle,
  Contact,
  DashboardData,
  Doc,
  Mandate,
  Preferences,
} from "./types";
import { kinds, statuses } from "./types";

const navigation: {
  group: string;
  items: { id: string; label: string; icon: typeof Activity; phase?: number }[];
}[] = [
  {
    group: "VOTRE QUOTIDIEN",
    items: [
      { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { id: "charlie", label: "Charlie", icon: Sparkles },
      { id: "prospecting", label: "Prospection", icon: Target },
      { id: "radar", label: "Radar immobilier", icon: Radar },
    ],
  },
  {
    group: "VOTRE PORTEFEUILLE",
    items: [
      { id: "buyers", label: "Acquéreurs", icon: Users },
      { id: "sellers", label: "Vendeurs", icon: House },
      { id: "mandates", label: "Mandats", icon: Building2 },
      { id: "matching", label: "Rapprochements", icon: Handshake },
      { id: "estimates", label: "Estimations", icon: BarChart3 },
      { id: "map", label: "Carte immobilière", icon: Map },
      {
        id: "calendar",
        label: "Agenda local",
        icon: CalendarDays,
      },
    ],
  },
  {
    group: "VOTRE ENTREPRISE",
    items: [
      { id: "transactions", label: "Transactions", icon: Handshake },
      {
        id: "finance",
        label: "Commissions & revenus",
        icon: Wallet,
      },
      {
        id: "referrals",
        label: "Courtage & recommandations",
        icon: Users,
      },
      {
        id: "marketing",
        label: "Marketing & newsletters",
        icon: Megaphone,
      },
      { id: "statistics", label: "Statistiques", icon: Activity },
      { id: "documents", label: "Documents", icon: FolderOpen },
    ],
  },
];
const pageNames: Record<string, string> = {
  dashboard: "Tableau de bord",
  buyers: "Acquéreurs",
  sellers: "Vendeurs",
  mandates: "Mandats",
  documents: "Documents",
  settings: "Paramètres",
  contacts: "Tous les contacts",
  statistics: "Statistiques",
  calendar: "Agenda local",
  estimates: "Estimations",
  matching: "Rapprochements",
  charlie: "Charlie",
  radar: "Radar immobilier",
  prospecting: "Prospection",
  map: "Carte immobilière",
  transactions: "Transactions",
  finance: "Commissions & revenus",
  referrals: "Courtage & recommandations",
  marketing: "Marketing & newsletters",
};
type Editor =
  | { type: "contact"; item?: Contact; kind?: string }
  | { type: "mandate"; item?: Mandate }
  | { type: "document" }
  | null;

function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <House size={23} strokeWidth={1.8} />
      </span>
      <div>
        IMMO PILOT<span>VOTRE IMMOBILIER. AUGMENTÉ.</span>
      </div>
      <b>AI</b>
    </div>
  );
}

function Login({
  onLogin,
  message,
}: {
  onLogin: (a: Account) => void;
  message?: string;
}) {
  const [mode, setMode] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const health = useCallback(() => {
    setError("");
    api<{ mode: string; setup_required: boolean }>("/health")
      .then((r) => {
        setMode(r.mode);
        setSetupRequired(r.setup_required === true);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(health, [health]);
  async function login(demo: boolean, e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    setBusy(true);
    const data = e
      ? Object.fromEntries(new FormData(e.currentTarget))
      : undefined;
    try {
      const result = await api<{
        token: string;
        user: Omit<Account, "mode">;
        mode: string;
      }>(
        demo
          ? "/auth/demo"
          : setupRequired
            ? "/auth/register-local"
            : "/auth/login",
        {
          method: "POST",
          body: data ? JSON.stringify(data) : undefined,
        },
      );
      setToken(result.token);
      onLogin({ ...result.user, mode: result.mode });
    } catch (err) {
      setError((err as Error).message);
      // Une inscription peut être confirmée en base même si sa réponse est perdue.
      if (setupRequired) {
        void api<{ setup_required: boolean }>("/health")
          .then((r) => setSetupRequired(r.setup_required === true))
          .catch(() => {});
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="login-screen">
      <div className="login-story">
        <Brand />
        <div>
          <div className="eyebrow">
            L’IMMOBILIER, AVEC UNE LONGUEUR D’AVANCE
          </div>
          <h1>
            Vos relations.
            <br />
            Vos projets.
            <br />
            <em>Votre prochain chapitre.</em>
          </h1>
          <p>
            Un espace pensé pour les conseillers immobiliers qui font la
            différence, chaque jour.
          </p>
          <div className="login-territory">
            <MapPin size={17} />
            Annecy & Grand Annecy
          </div>
        </div>
        <small>IMMO PILOT AI · Version 0.10 · Votre activité, réunie</small>
      </div>
      <div className="login-form-wrap">
        <div className="login-form">
          <span className="brand-icon">
            <House />
          </span>
          <h2>
            {setupRequired
              ? "Créez votre espace privé."
              : "Bienvenue dans votre espace."}
          </h2>
          <p>
            {mode === "local"
              ? "Votre compte et vos dossiers restent sur cet ordinateur. Aucun hébergement nécessaire."
              : "Retrouvez vos clients, vos mandats et vos priorités."}
          </p>
          <form onSubmit={(e) => login(false, e)}>
            {setupRequired && (
              <label className="field">
                <span>Votre nom</span>
                <input
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={120}
                  required
                  disabled={busy}
                />
              </label>
            )}
            <label className="field">
              <span>Adresse e-mail</span>
              <input
                name="email"
                type="email"
                autoComplete="username"
                disabled={busy}
                required
                placeholder="vous@agence.fr"
              />
            </label>
            <label className="field">
              <span id="login-password-label">Mot de passe</span>
              <input
                name="password"
                type="password"
                aria-labelledby="login-password-label"
                aria-describedby={
                  setupRequired ? "login-password-help" : undefined
                }
                autoComplete={
                  setupRequired ? "new-password" : "current-password"
                }
                minLength={setupRequired ? 12 : 1}
                maxLength={256}
                disabled={busy}
                required
              />
              {setupRequired && (
                <small id="login-password-help">
                  12 caractères minimum. Choisissez un mot de passe unique.
                </small>
              )}
            </label>
            {setupRequired && (
              <label className="field">
                <span>Confirmer le mot de passe</span>
                <input
                  name="password_confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={256}
                  required
                  disabled={busy}
                />
              </label>
            )}
            <Button disabled={busy || !mode}>
              {busy
                ? "Veuillez patienter…"
                : setupRequired
                  ? "Créer mon compte local"
                  : "Se connecter"}{" "}
              <ArrowRight size={17} />
            </Button>
          </form>
          {mode === "local" && (
            <p className="local-account-note">
              L’adresse e-mail sert uniquement d’identifiant. Aucun message
              n’est envoyé et aucune récupération par e-mail n’est disponible.
              Conservez votre mot de passe en lieu sûr.
            </p>
          )}
          {mode === "demo" && (
            <div className="demo-entry">
              <span>EXPLORER EN TOUTE TRANQUILLITÉ</span>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => login(true)}
              >
                Ouvrir l’espace de démonstration <ArrowRight size={17} />
              </Button>
              <small>Données fictives, base isolée, aucun envoi externe.</small>
            </div>
          )}
          {(error || message) && (
            <div className="error" role="alert">
              {error || message}
            </div>
          )}
          {!mode && (
            <Button variant="ghost" onClick={health}>
              <RefreshCw size={16} />
              Réessayer la connexion
            </Button>
          )}
          <div className="login-security">
            <ShieldCheck size={15} />
            {mode === "local"
              ? "Mot de passe protégé par une empreinte Argon2id"
              : "Connexion sécurisée par session personnelle"}
          </div>
          <div className="login-update">
            <UpdateCenter blocked={busy} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [data, setData] = useState<Bundle | null>(null);
  const [page, setPage] = useState("dashboard");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<Editor>(null);
  const [commercialEditing, setCommercialEditing] = useState(false);
  const [charlieEditing, setCharlieEditing] = useState(false);
  const [outlookSetup, setOutlookSetup] = useState(false);
  const [toast, setToast] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [automationBusy, setAutomationBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sort, setSort] = useState("name");
  const filters = useRef<
    Record<string, { filter: string; status: string; sort: string }>
  >({});
  const loadSequence = useRef(0);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [dark, setDark] = useState(
    () => readPreference("immo-theme") === "dark",
  );
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    writePreference("immo-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const cb = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifications(false);
      }
    };
    window.addEventListener("keydown", cb);
    return () => window.removeEventListener("keydown", cb);
  }, []);
  useEffect(() => {
    const cb = () => {
      loadSequence.current++;
      setOutlookSetup(false);
      setToken("");
      setAccount(null);
      setData(null);
      setEditor(null);
      setSearch("");
      setFilter("");
      setStatus("");
      setPage("dashboard");
      setSearchOpen(false);
      setNotifications(false);
      setToast("");
      filters.current = {};
      setLoading(false);
      setLastUpdated(null);
      setSort("name");
      setError("");
      setAutomationBusy(false);
      setLoginMessage(
        "Votre session a expiré. Reconnectez-vous pour continuer.",
      );
    };
    window.addEventListener("session-expired", cb);
    return () => window.removeEventListener("session-expired", cb);
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const reload = useCallback(async () => {
    const generation = getSessionGeneration();
    const sequence = ++loadSequence.current;
    const current = () =>
      sequence === loadSequence.current &&
      generation === getSessionGeneration();
    setLoading(true);
    setError("");
    try {
      const [contacts, mandates, documents, dashboard, settings, audit] =
        await Promise.all([
          api<Contact[]>("/contacts"),
          api<Mandate[]>("/mandates"),
          api<Doc[]>("/documents"),
          api<DashboardData>("/dashboard"),
          api<Preferences>("/settings"),
          api<Audit[]>("/audit"),
        ]);
      if (!current()) return false;
      setData({ contacts, mandates, documents, dashboard, settings, audit });
      setLastUpdated(new Date());
      return true;
    } catch (e) {
      if (current()) setError((e as Error).message);
      return false;
    } finally {
      if (current()) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (account) void reload();
  }, [account, reload]);
  function navigate(next: string) {
    filters.current[page] = { filter, status, sort };
    setPage(next);
    setFilter(filters.current[next]?.filter || "");
    setStatus(filters.current[next]?.status || "");
    setSort(filters.current[next]?.sort || "name");
    setNotifications(false);
    setSearchOpen(false);
  }
  async function saved() {
    const generation = getSessionGeneration();
    const refreshed = await reload();
    if (generation !== getSessionGeneration()) return;
    setToast(
      refreshed
        ? "Votre dossier a été enregistré."
        : "Enregistrement confirmé. La liste reste à actualiser.",
    );
  }
  async function logout() {
    let message = "";
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      message =
        "Déconnexion locale effectuée. Le serveur n’a pas confirmé la révocation ; la session distante expirera automatiquement.";
    } finally {
      setOutlookSetup(false);
      loadSequence.current++;
      setToken("");
      setAccount(null);
      setData(null);
      setEditor(null);
      setSearch("");
      setSearchOpen(false);
      setNotifications(false);
      setPage("dashboard");
      setFilter("");
      setStatus("");
      setError("");
      setToast("");
      setLoading(false);
      filters.current = {};
      setLastUpdated(null);
      setSort("name");
      setAutomationBusy(false);
      setLoginMessage(message);
    }
  }
  async function download(d: Doc) {
    const generation = getSessionGeneration();
    try {
      saveFile(await api<Blob>(`/documents/${d.id}/download`), d.filename);
      setToast("Téléchargement préparé.");
    } catch (e) {
      if (generation === getSessionGeneration()) setError((e as Error).message);
    }
  }
  async function stopAutomation() {
    if (!data || automationBusy) return;
    const generation = getSessionGeneration();
    setAutomationBusy(true);
    try {
      await api("/settings/automation", {
        method: "PUT",
        body: JSON.stringify({ enabled: !data.settings.automation.enabled }),
      });
      const refreshed = await reload();
      if (generation === getSessionGeneration())
        setToast(
          refreshed
            ? "Préférence d’automatisation enregistrée."
            : "Préférence enregistrée. Actualisez les données.",
        );
    } catch (e) {
      if (generation === getSessionGeneration()) setError((e as Error).message);
    } finally {
      if (generation === getSessionGeneration()) setAutomationBusy(false);
    }
  }
  if (!account)
    return (
      <Login
        message={loginMessage}
        onLogin={(a) => {
          setLoginMessage("");
          setAccount(a);
        }}
      />
    );
  const readonly = account.role === "reader";
  const openMandate = (m: Mandate) => setEditor({ type: "mandate", item: m });
  const visibleContacts = (data?.contacts || [])
    .filter(
      (c) =>
        (page !== "buyers" || ["buyer", "both"].includes(c.kind)) &&
        (page !== "sellers" || ["seller", "both"].includes(c.kind)) &&
        normalizeSearch(
          `${c.name} ${c.city} ${c.email || ""} ${c.phone}`,
        ).includes(normalizeSearch(filter)),
    )
    .sort((a, b) =>
      sort === "budget"
        ? Number(b.criteria?.budget_max || 0) -
          Number(a.criteria?.budget_max || 0)
        : a.name.localeCompare(b.name, "fr"),
    );
  const visibleMandates = (data?.mandates || [])
    .filter(
      (m) =>
        (!status || m.status === status) &&
        normalizeSearch(
          `${m.reference} ${m.property.title} ${m.property.city} ${m.seller_name}`,
        ).includes(normalizeSearch(filter)),
    )
    .sort((a, b) =>
      sort === "price"
        ? Number(b.price) - Number(a.price)
        : sort === "expiry"
          ? a.end_date.localeCompare(b.end_date)
          : a.reference.localeCompare(b.reference, "fr", { numeric: true }),
    );
  const visibleDocs = (data?.documents || []).filter((d) =>
    normalizeSearch(`${d.filename} ${d.category}`).includes(
      normalizeSearch(filter),
    ),
  );
  const foundContacts = search
    ? data?.contacts
        .filter((c) =>
          normalizeSearch(
            `${c.name} ${c.city} ${c.email || ""} ${c.phone}`,
          ).includes(normalizeSearch(search)),
        )
        .slice(0, 5) || []
    : [];
  const foundMandates = search
    ? data?.mandates
        .filter((m) =>
          normalizeSearch(
            `${m.reference} ${m.property.title} ${m.property.city} ${m.property.address}`,
          ).includes(normalizeSearch(search)),
        )
        .slice(0, 5) || []
    : [];
  const foundDocs = search
    ? data?.documents
        .filter((d) =>
          normalizeSearch(d.filename).includes(normalizeSearch(search)),
        )
        .slice(0, 5) || []
    : [];
  function exportContacts() {
    const escape = (v: string | null) =>
      '"' +
      (v || "").replace(/^(?=\s*[=+@\-\t\r\n])/, "'").replaceAll('"', '""') +
      '"';
    const rows = [
      ["Nom", "Profil", "Email", "Téléphone", "Commune"],
      ...visibleContacts.map((c) => [c.name, c.kind, c.email, c.phone, c.city]),
    ];
    saveFile(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(escape).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
      `contacts-${account?.mode}.csv`,
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace">
          <span className="workspace-avatar">A</span>
          <div>
            Mon espace immobilier<small>Annecy & Grand Annecy</small>
          </div>
          <MapPin size={14} />
        </div>
        <nav>
          {navigation.map((section) => (
            <div className="nav-group" key={section.group}>
              <div className="nav-group-name">{section.group}</div>
              {section.items
                .filter((item) => !item.phase)
                .map((item) => (
                  <button
                    key={item.id}
                    className={`nav-item ${page === item.id ? "selected" : ""}`}
                    disabled={!!item.phase}
                    aria-label={item.label}
                    aria-current={page === item.id ? "page" : undefined}
                    title={
                      item.phase
                        ? `Disponible en phase ${item.phase}`
                        : item.label
                    }
                    onClick={() => navigate(item.id)}
                  >
                    <item.icon size={17} />
                    <span>{item.label}</span>
                    {item.phase ? (
                      <small>P{item.phase}</small>
                    ) : item.id === "mandates" && data ? (
                      <small>{data.dashboard.active}</small>
                    ) : null}
                  </button>
                ))}
            </div>
          ))}
          {navigation.some((section) =>
            section.items.some((item) => item.phase),
          ) && (
            <details className="future-nav">
              <summary>
                Prochaines fonctionnalités <ChevronDown size={14} />
              </summary>
              {navigation
                .flatMap((section) => section.items)
                .filter((item) => item.phase)
                .map((item) => (
                  <div className="future-item" key={item.id}>
                    <item.icon size={16} />
                    <span>{item.label}</span>
                    <small>Phase {item.phase}</small>
                  </div>
                ))}
            </details>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${page === "settings" ? "selected" : ""}`}
            onClick={() => navigate("settings")}
            aria-label="Paramètres"
          >
            <Settings size={17} />
            Paramètres
          </button>
          <div className="user-profile">
            <span className="avatar">
              {account.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{account.name.split(" · ")[0]}</strong>
              <small>
                {readonly ? "Accès en lecture seule" : "Conseiller immobilier"}
              </small>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Se déconnecter"
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Mon espace <span>/</span>
            <strong>{pageNames[page]}</strong>
          </div>
          <div className="global-search">
            <Search size={16} />
            <input
              ref={searchRef}
              aria-label="Rechercher dans les dossiers"
              placeholder="Rechercher un dossier, un contact…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            <kbd>Ctrl K</kbd>
            {searchOpen && search && (
              <div className="search-results">
                <div className="search-title">
                  Résultats de recherche
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Fermer les résultats"
                    onClick={() => setSearchOpen(false)}
                  >
                    <X size={15} />
                  </Button>
                </div>
                {foundContacts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setEditor({ type: "contact", item: c });
                      setSearchOpen(false);
                    }}
                  >
                    <Users size={17} />
                    <span>
                      {c.name}
                      <small>{c.city} · Contact</small>
                    </span>
                  </button>
                ))}
                {foundMandates.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      openMandate(m);
                      setSearchOpen(false);
                    }}
                  >
                    <Building2 size={17} />
                    <span>
                      {m.reference}
                      <small>{m.property.title}</small>
                    </span>
                  </button>
                ))}
                {foundDocs.map((d) => (
                  <button key={d.id} onClick={() => download(d)}>
                    <FileText size={17} />
                    <span>
                      {d.filename}
                      <small>Document · Télécharger</small>
                    </span>
                  </button>
                ))}
                {!foundContacts.length &&
                  !foundMandates.length &&
                  !foundDocs.length && <p>Aucun dossier trouvé.</p>}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <UpdateCenter
              blocked={
                !!editor ||
                commercialEditing ||
                charlieEditing ||
                outlookSetup ||
                automationBusy ||
                loading
              }
            />
            <Button
              size="icon"
              variant="ghost"
              disabled={loading}
              aria-label="Actualiser les données"
              onClick={reload}
            >
              <RefreshCw size={18} className={loading ? "spin" : ""} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={
                dark ? "Activer le mode clair" : "Activer le mode sombre"
              }
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <div className="notification-wrap">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Notifications"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={18} />
                {!!data?.dashboard.priorities.length && (
                  <i className="notification-dot" />
                )}
              </Button>
              {notifications && (
                <div className="notification-panel">
                  <h3>Vos notifications</h3>
                  {data?.dashboard.priorities.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const m = data.mandates.find((m) => m.id === p.id);
                        if (m) openMandate(m);
                        setNotifications(false);
                      }}
                    >
                      <strong>{p.title}</strong>
                      <small>
                        {p.reference} · {p.detail}
                      </small>
                    </button>
                  ))}
                  {!data?.dashboard.priorities.length && (
                    <p>Aucune notification.</p>
                  )}
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("charlie")}
            >
              <Sparkles size={15} />
              Charlie
            </Button>
          </div>
        </header>
        {account.mode === "demo" && (
          <div className="demo-banner">
            <span>
              <span className="demo-dot" />
              ESPACE DE DÉMONSTRATION
            </span>
            <p>Données fictives · stockage séparé · aucun message envoyé</p>
            <button onClick={() => navigate("settings")}>
              En savoir plus <ArrowRight size={13} />
            </button>
          </div>
        )}
        <main>
          {error && (
            <div className="error page-error" role="alert">
              {error}
              <Button variant="ghost" size="sm" onClick={reload}>
                Réessayer
              </Button>
            </div>
          )}
          {!data && (
            <div className="empty">
              <LoaderCircle className={loading ? "spin" : ""} />
              <h2>
                {loading
                  ? "Chargement de votre espace…"
                  : "Données indisponibles"}
              </h2>
            </div>
          )}
          {data && (
            <>
              <div hidden={page !== "charlie"}>
                <CharliePage
                  active={page === "charlie"}
                  contacts={data.contacts}
                  mandates={data.mandates}
                  role={account.role}
                  onEditing={setCharlieEditing}
                />
              </div>
              {page === "radar" && (
                <RadarPage
                  readonly={readonly}
                  onEditing={setCommercialEditing}
                />
              )}
              {page === "prospecting" && (
                <ProspectingPage
                  readonly={readonly}
                  onEditing={setCommercialEditing}
                />
              )}
              {page === "map" && <PropertyMapPage />}
              {page === "marketing" && (
                <MarketingPage
                  contacts={data.contacts}
                  role={account.role}
                  onEditing={setCommercialEditing}
                  onChanged={() => {
                    void reload();
                  }}
                />
              )}
              {page === "referrals" && (
                <PartnersPage
                  contacts={data.contacts}
                  readonly={readonly}
                  onEditing={setCommercialEditing}
                  onChanged={() => {
                    void reload();
                  }}
                />
              )}
              {page === "transactions" && (
                <TransactionsPage
                  contacts={data.contacts}
                  mandates={data.mandates}
                  readonly={readonly}
                  onEditing={setCommercialEditing}
                />
              )}
              {page === "finance" && (
                <FinancePage
                  contacts={data.contacts}
                  role={account.role}
                  onEditing={setCommercialEditing}
                />
              )}
              {page === "calendar" && (
                <CalendarPage
                  contacts={data.contacts}
                  mandates={data.mandates}
                  readonly={readonly}
                  onChanged={async () => {
                    await reload();
                  }}
                  onEditing={setCommercialEditing}
                  openContact={(item) => setEditor({ type: "contact", item })}
                  openMandate={openMandate}
                />
              )}
              {page === "estimates" && (
                <EstimatesPage
                  contacts={data.contacts}
                  readonly={readonly}
                  onChanged={async () => {
                    await reload();
                  }}
                  onEditing={setCommercialEditing}
                />
              )}
              {page === "matching" && (
                <MatchesPage
                  contacts={data.contacts}
                  mandates={data.mandates}
                  openContact={(item) => setEditor({ type: "contact", item })}
                  openMandate={openMandate}
                />
              )}
              {page === "dashboard" && (
                <Dashboard
                  data={data}
                  openMandate={openMandate}
                  navigate={navigate}
                  newMandate={() => setEditor({ type: "mandate" })}
                  readonly={readonly}
                  name={account.name.split(" · ")[0]}
                  syncLabel={
                    error
                      ? "Actualisation impossible · données précédentes"
                      : loading
                        ? "Actualisation en cours…"
                        : `Actualisé à ${lastUpdated?.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) || "—"}`
                  }
                />
              )}
              {["buyers", "sellers", "contacts"].includes(page) && (
                <>
                  <PageHeading
                    eyebrow="VOTRE PORTEFEUILLE"
                    title={pageNames[page]}
                    description="Des relations durables, des dossiers toujours à portée de main."
                  >
                    <Button variant="outline" onClick={exportContacts}>
                      <Download size={16} />
                      Exporter CSV
                    </Button>
                    <Button
                      disabled={readonly}
                      onClick={() =>
                        setEditor({
                          type: "contact",
                          kind: page === "sellers" ? "seller" : "buyer",
                        })
                      }
                    >
                      <Plus size={17} />
                      Nouveau contact
                    </Button>
                  </PageHeading>
                  <div className="page-tabs">
                    <button
                      className={page === "buyers" ? "active" : ""}
                      onClick={() => navigate("buyers")}
                    >
                      Acquéreurs <span>{data.dashboard.buyers}</span>
                    </button>
                    <button
                      className={page === "sellers" ? "active" : ""}
                      onClick={() => navigate("sellers")}
                    >
                      Vendeurs <span>{data.dashboard.sellers}</span>
                    </button>
                    <button
                      className={page === "contacts" ? "active" : ""}
                      onClick={() => navigate("contacts")}
                    >
                      Tous les contacts
                    </button>
                  </div>
                  <div className="panel">
                    <TableTools
                      value={filter}
                      onChange={setFilter}
                      count={visibleContacts.length}
                      label="contacts"
                    >
                      <select
                        aria-label="Trier les contacts"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="name">Nom · A à Z</option>
                        <option value="budget">Budget décroissant</option>
                      </select>
                    </TableTools>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Contact</th>
                            <th>Commune</th>
                            <th>Coordonnées</th>
                            <th>
                              {page === "buyers"
                                ? "Budget & projet"
                                : "Origine"}
                            </th>
                            <th>Fiche</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleContacts.map((c) => (
                            <tr key={c.id}>
                              <td>
                                <div className="person-cell">
                                  <span className="avatar">
                                    {c.name
                                      .split(" ")
                                      .map((x) => x[0])
                                      .slice(0, 2)
                                      .join("")}
                                  </span>
                                  <div>
                                    <strong>{c.name}</strong>
                                    <small>
                                      {c.kind === "buyer"
                                        ? "Acquéreur"
                                        : c.kind === "seller"
                                          ? "Vendeur"
                                          : c.kind === "both"
                                            ? "Vendeur & acquéreur"
                                            : "Professionnel"}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="location">
                                  <MapPin size={13} />
                                  {c.city || "À renseigner"}
                                </span>
                              </td>
                              <td>
                                <span>{c.email || "E-mail à renseigner"}</span>
                                <small>
                                  {c.phone || "Téléphone à renseigner"}
                                </small>
                              </td>
                              <td>
                                {page === "buyers" && c.criteria ? (
                                  <>
                                    <strong>
                                      {money(c.criteria.budget_max)}
                                    </strong>
                                    <small>
                                      {c.criteria.sectors ||
                                        "Secteur à préciser"}
                                    </small>
                                  </>
                                ) : (
                                  c.source
                                )}
                              </td>
                              <td>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setEditor({ type: "contact", item: c })
                                  }
                                >
                                  Ouvrir <ArrowRight size={15} />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!visibleContacts.length && (
                      <Empty text="Aucun contact ne correspond. Ajoutez votre premier dossier ou modifiez la recherche." />
                    )}
                  </div>
                </>
              )}
              {page === "mandates" && (
                <>
                  <PageHeading
                    eyebrow="VOTRE PORTEFEUILLE"
                    title="Mandats"
                    description="Chaque bien, chaque étape, une vision claire de votre activité."
                  >
                    <Button
                      disabled={readonly}
                      onClick={() => setEditor({ type: "mandate" })}
                    >
                      <Plus size={17} />
                      Nouveau mandat
                    </Button>
                  </PageHeading>
                  <div className="summary-pills">
                    <span>
                      <b>{data.dashboard.active}</b> mandats en cours
                    </span>
                    <span>
                      <b>{data.dashboard.exclusive}</b> exclusifs
                    </span>
                    <span>
                      <b>{data.dashboard.partner}</b> intercabinet
                    </span>
                    <span>
                      <b>{money(data.dashboard.portfolio)}</b> en portefeuille
                    </span>
                  </div>
                  <div className="panel">
                    <TableTools
                      value={filter}
                      onChange={setFilter}
                      count={visibleMandates.length}
                      label="mandats"
                    >
                      <select
                        aria-label="Trier les mandats"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="name">Référence</option>
                        <option value="price">Prix décroissant</option>
                        <option value="expiry">Échéance la plus proche</option>
                      </select>
                      <select
                        aria-label="Filtrer par statut"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="">Tous les statuts</option>
                        {Object.entries(statuses).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </TableTools>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Bien & référence</th>
                            <th>Vendeur</th>
                            <th>Prix de vente</th>
                            <th>Type / statut</th>
                            <th>Échéance</th>
                            <th>Fiche</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleMandates.map((m) => (
                            <tr key={m.id}>
                              <td>
                                <strong>{m.property.title}</strong>
                                <small>
                                  {m.reference} · {m.property.city} ·{" "}
                                  {m.property.surface} m²
                                </small>
                              </td>
                              <td>{m.seller_name}</td>
                              <td>
                                <strong>{money(m.price)}</strong>
                                <small>
                                  {money(
                                    Number(m.price) /
                                      Number(m.property.surface),
                                  )}{" "}
                                  / m²
                                </small>
                              </td>
                              <td>
                                <span className={`badge badge-${m.status}`}>
                                  {statuses[m.status]}
                                </span>
                                <small>{kinds[m.kind]}</small>
                              </td>
                              <td>{dateText(m.end_date)}</td>
                              <td>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openMandate(m)}
                                >
                                  Ouvrir <ArrowRight size={15} />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!visibleMandates.length && (
                      <Empty text="Aucun mandat. Créez une fiche vendeur, puis ajoutez votre premier bien." />
                    )}
                  </div>
                </>
              )}
              {page === "documents" && (
                <>
                  <PageHeading
                    eyebrow="VOTRE BIBLIOTHÈQUE"
                    title="Documents"
                    description="Les pièces de vos dossiers, conservées et reliées à vos clients."
                  >
                    <Button
                      disabled={readonly}
                      onClick={() => setEditor({ type: "document" })}
                    >
                      <Plus size={17} />
                      Ajouter un document
                    </Button>
                  </PageHeading>
                  <div className="panel">
                    <TableTools
                      value={filter}
                      onChange={setFilter}
                      count={visibleDocs.length}
                      label="documents"
                    />
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Document</th>
                            <th>Catégorie</th>
                            <th>Dossier associé</th>
                            <th>Ajouté le</th>
                            <th>Taille</th>
                            <th>Fichier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleDocs.map((d) => (
                            <tr key={d.id}>
                              <td>
                                <div className="document-cell">
                                  <FileText size={20} />
                                  <strong>{d.filename}</strong>
                                </div>
                              </td>
                              <td>{d.category}</td>
                              <td>
                                {data.mandates.find(
                                  (m) => m.id === d.mandate_id,
                                )?.reference ||
                                  data.contacts.find(
                                    (c) => c.id === d.contact_id,
                                  )?.name ||
                                  "Non associé"}
                              </td>
                              <td>{dateText(d.created_at)}</td>
                              <td>
                                {Math.max(1, Math.round(d.size / 1024))} Ko
                              </td>
                              <td>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => download(d)}
                                >
                                  <Download size={15} />
                                  Télécharger
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!visibleDocs.length && (
                      <Empty text="Votre bibliothèque est prête. Importez un mandat, un diagnostic ou une pièce de dossier." />
                    )}
                  </div>
                </>
              )}
              {page === "statistics" && <StatisticsPage />}
              {page === "settings" && (
                <>
                  <PageHeading
                    eyebrow="VOTRE ESPACE"
                    title="Paramètres & connexions"
                    description="Gardez la maîtrise de vos données et de vos automatisations."
                  />
                  <div className="settings-grid">
                    <section className="panel info-panel">
                      <h2>
                        <ShieldCheck size={20} />
                        Environnement de travail
                      </h2>
                      <dl>
                        <dt>Mode</dt>
                        <dd>
                          {account.mode === "demo"
                            ? "Démonstration · données fictives"
                            : account.mode === "local"
                              ? "Espace personnel local"
                              : "Données réelles"}
                        </dd>
                        <dt>Base de données</dt>
                        <dd>
                          {data.settings.database === "sqlite"
                            ? account.mode === "local"
                              ? "SQLite · sur cet ordinateur"
                              : "SQLite · démonstration locale"
                            : "PostgreSQL"}
                        </dd>
                        <dt>Compte</dt>
                        <dd>{account.email}</dd>
                        <dt>Fuseau horaire</dt>
                        <dd>Europe/Paris</dd>
                        <dt>Version</dt>
                        <dd>0.10.0 · Newsletters et préférences</dd>
                      </dl>
                      <p>
                        {account.mode === "local"
                          ? "Votre compte et vos dossiers sont enregistrés sur cet ordinateur. Le mot de passe n’est jamais stocké en clair. Cette connexion protège l’accès dans l’application ; elle ne chiffre pas les fichiers du disque. L’ancienne démonstration reste conservée séparément."
                          : "L’espace personnel local ne nécessite aucun serveur externe. Le mode partagé PostgreSQL reste disponible avec une configuration dédiée."}
                      </p>
                    </section>
                    <section className="panel info-panel">
                      <h2>
                        <Target size={20} />
                        Préférences de prospection
                      </h2>
                      <p className="settings-status">
                        <span
                          className={`live-dot ${data.settings.automation.enabled ? "" : "stopped"}`}
                        />
                        {data.settings.automation.enabled
                          ? "Préférence générale activée"
                          : "Automatisations arrêtées"}
                      </p>
                      <dl>
                        <dt>Plafond quotidien</dt>
                        <dd>
                          {data.settings.automation.daily_limit} messages,
                          relances incluses
                        </dd>
                        <dt>Première relance</dt>
                        <dd>
                          Après {data.settings.automation.followup_days} jours ·
                          1 maximum
                        </dd>
                        <dt>Secteur</dt>
                        <dd>{data.settings.automation.sector}</dd>
                      </dl>
                      <div className="notice">
                        Moteur d’envoi prévu en phase 3. Aucun connecteur n’est
                        autorisé à envoyer et aucun message ne part depuis cette
                        version.
                      </div>
                      <Button
                        disabled={readonly || automationBusy}
                        variant={
                          data.settings.automation.enabled
                            ? "destructive"
                            : "outline"
                        }
                        onClick={stopAutomation}
                      >
                        <Square size={14} />
                        {data.settings.automation.enabled
                          ? "Arrêter les automatisations"
                          : "Réactiver la préférence"}
                      </Button>
                    </section>
                  </div>
                  <section className="panel connections">
                    <div className="panel-heading">
                      <div>
                        <h2>Connexions externes</h2>
                        <p>
                          Charlie se configure depuis sa page. Les autres
                          intégrations restent à développer.
                        </p>
                      </div>
                    </div>
                    {data.settings.connectors.map((c, i) => (
                      <div className="connection" key={c.name}>
                        <span className="connection-icon">
                          {i === 0 ? (
                            <Sparkles />
                          ) : i === 1 ? (
                            <Mail />
                          ) : (
                            <Radar />
                          )}
                        </span>
                        <div>
                          <strong>{c.name}</strong>
                          <small>
                            {i === 0
                              ? "Connexion facultative depuis Charlie · clé protégée sous Windows"
                              : i === 2
                                ? "Saisie et import CSV · aucune collecte automatique"
                                : "Intégration et autorisations à configurer · Phase 2"}
                          </small>
                        </div>
                        {i === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("charlie")}
                          >
                            Ouvrir Charlie
                          </Button>
                        )}
                        {i === 1 && account.role === "admin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOutlookSetup(true)}
                          >
                            Préparer Outlook
                          </Button>
                        )}
                        <span className="quiet-tag">
                          {c.status === "verified"
                            ? "Test confirmé"
                            : c.status === "configured"
                              ? "Configuré"
                              : c.status === "local"
                                ? "Mode local"
                                : "Non connecté"}
                        </span>
                      </div>
                    ))}
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Journal des actions</h2>
                        <p>
                          Les 100 dernières opérations enregistrées par le
                          serveur
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={reload}>
                        <RefreshCw size={15} />
                        Actualiser
                      </Button>
                    </div>
                    <div className="audit-list">
                      {data.audit.map((a) => (
                        <div key={a.id}>
                          <span className="audit-dot" />
                          <strong>{a.action}</strong>
                          <span>{a.entity_id.slice(0, 8)}</span>
                          <time>
                            {new Date(a.created_at).toLocaleString("fr-FR", {
                              timeZone: "Europe/Paris",
                            })}
                          </time>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <span className="live-dot" />
            {loading
              ? "Actualisation…"
              : error
                ? "Actualisation indisponible"
                : data
                  ? account.mode === "local"
                    ? "Données conservées sur cet ordinateur"
                    : "Données persistées sur le serveur"
                  : "Service indisponible"}
          </span>
          <span>
            IMMO PILOT AI <b>0.10</b>
          </span>
        </footer>
      </div>
      {editor &&
        data &&
        (readonly ? (
          <Modal
            open
            onClose={() => setEditor(null)}
            title="Dossier · lecture seule"
          >
            <RecordDetails
              item={editor.type === "document" ? undefined : editor.item}
            />
          </Modal>
        ) : editor.type === "contact" ? (
          <ContactForm
            contact={editor.item}
            defaultKind={editor.kind || "buyer"}
            onClose={() => setEditor(null)}
            onSaved={saved}
          />
        ) : editor.type === "mandate" ? (
          <MandateForm
            mandate={editor.item}
            contacts={data.contacts}
            onClose={() => setEditor(null)}
            onSaved={saved}
          />
        ) : (
          <DocumentForm
            contacts={data.contacts}
            mandates={data.mandates}
            onClose={() => setEditor(null)}
            onSaved={saved}
          />
        ))}
      {outlookSetup && <OutlookSetup onClose={() => setOutlookSetup(false)} />}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="welcome page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>
          {title}
          <span>.</span>
        </h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function TableTools({
  value,
  onChange,
  count,
  label,
  children,
}: {
  value: string;
  onChange: (s: string) => void;
  count: number;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="table-tools">
      <div className="local-search">
        <Search size={16} />
        <input
          aria-label="Filtrer la liste"
          placeholder="Rechercher dans la liste…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {children}
      <span className="spacer" />
      <span>
        {count} {label}
      </span>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <FolderOpen size={32} />
      <p>{text}</p>
    </div>
  );
}
