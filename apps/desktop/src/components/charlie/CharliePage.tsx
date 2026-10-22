import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Copy,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api } from "../../api";
import type { Contact, Mandate } from "../../types";
import type { EstimateRecord } from "../commercial/types";
import {
  Field,
  ResourceState,
  useEditing,
  useResource,
  useSubmitLock,
} from "../commercial/shared";
import { Button } from "../ui/button";
import { CharlieConfig } from "./CharlieConfig";
import type {
  CharlieConfig as Configuration,
  CharlieContext,
  ContextKind,
  Conversation,
} from "./types";

const labels = {
  briefing: "Briefing de l’activité",
  contact: "Fiche contact",
  mandate: "Mandat",
  estimate: "Estimation",
  matching: "Rapprochements d’un acquéreur",
};
export function CharliePage({
  contacts,
  mandates,
  role,
  onEditing,
  active,
}: {
  contacts: Contact[];
  mandates: Mandate[];
  role: string;
  onEditing: (value: boolean) => void;
  active: boolean;
}) {
  const readonly = role === "reader";
  const config = useResource<Configuration>("/charlie/config");
  const list = useResource<{ items: Conversation[]; limited: boolean }>(
    "/charlie/conversations",
  );
  const estimates = useResource<{ items: EstimateRecord[] }>("/estimates");
  const [selected, setSelected] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [contextKind, setContextKind] = useState<ContextKind>("briefing");
  const [contextId, setContextId] = useState("");
  const [engine, setEngine] = useState<"local" | "openai">("local");
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [configOpen, setConfigOpen] = useState<Configuration | null>(null);
  const [deleting, setDeleting] = useState(false);
  const lock = useSubmitLock();
  const [loadingConversation, setLoadingConversation] = useState(false);
  const request = useRef<{
    key: string;
    payload: Record<string, unknown>;
  } | null>(null);
  const messagesView = useRef<HTMLDivElement>(null);
  const draft = useRef(question);
  draft.current = question;
  useEditing(!!configOpen || lock.busy || !!question.trim(), onEditing);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (draft.current.trim()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, []);
  const query = new URLSearchParams({ kind: contextKind });
  if (contextId) query.set("identifier", contextId);
  const context = useResource<CharlieContext>(
    "/charlie/context?" + query.toString(),
    String(active),
  );
  useEffect(() => {
    setConsent(false);
  }, [context.data?.digest, engine]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setDeleting(false);
    if (!selected) {
      setConversation(null);
      setLoadingConversation(false);
      return () => controller.abort();
    }
    setLoadingConversation(true);
    setConversation(null);
    api<Conversation>("/charlie/conversations/" + selected, {
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setConversation(value);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingConversation(false);
      });
    return () => controller.abort();
  }, [selected]);
  useEffect(() => {
    const view = messagesView.current;
    if (view) view.scrollTo({ top: view.scrollHeight, behavior: "auto" });
  }, [conversation?.turns.length]);
  const serverBusy =
    !!conversation?.pending_request_id &&
    !!conversation.pending_since &&
    Date.parse(conversation.pending_since) > Date.now() - 120000;
  async function newConversation() {
    if (!lock.start()) return;
    setError("");
    try {
      const value = await api<Conversation>("/charlie/conversations", {
        method: "POST",
        body: "{}",
      });
      setSelected(value.id);
      list.refresh();
      context.refresh();
      setNotice("");
      request.current = null;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  async function refresh() {
    context.refresh();
    if (!selected || !lock.start()) return;
    setError("");
    try {
      const value = await api<Conversation>("/charlie/conversations/" + selected);
      setConversation(value);
      if (request.current && !value.pending_request_id &&
          !value.turns.some((turn) => turn.id === request.current?.payload.request_id)) {
        request.current.payload.version = value.version;
      }
      list.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!conversation || !context.data || !question.trim() || !lock.start())
      return;
    setError("");
    setNotice("");
    const key = JSON.stringify({
      question: question.trim(),
      engine,
      digest: context.data.digest,
      conversation: conversation.id,
    });
    if (!request.current || request.current.key !== key)
      request.current = {
        key,
        payload: {
          request_id: crypto.randomUUID(),
          version: conversation.version,
          question: question.trim(),
          engine,
          context_kind: contextKind,
          context_id: contextId || null,
          context_digest: context.data.digest,
          allow_external: engine === "openai" && consent,
        },
      };
    try {
      const value = await api<Conversation>(
        `/charlie/conversations/${conversation.id}/messages`,
        { method: "POST", body: JSON.stringify(request.current.payload) },
        70000,
      );
      setConversation(value);
      list.refresh();
      request.current = null;
      const last = value.turns.at(-1);
      if (last?.status === "failed") setError(last.error);
      else setQuestion("");
      setConsent(false);
    } catch (e) {
      setError(
        (e as Error).message +
          " L’identifiant de cette demande est conservé pour une nouvelle tentative identique ; actualisez d’abord l’historique.",
      );
    } finally {
      lock.end();
    }
  }
  async function remove() {
    if (!conversation || !lock.start()) return;
    setError("");
    try {
      await api(
        `/charlie/conversations/${conversation.id}?version=${conversation.version}`,
        { method: "DELETE" },
      );
      setSelected("");
      setConversation(null);
      setDeleting(false);
      list.refresh();
      request.current = null;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.end();
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Texte copié. Relisez-le avant toute utilisation.");
    } catch {
      setNotice(
        "Copie automatique indisponible. Sélectionnez le texte pour le copier manuellement.",
      );
    }
  }
  const options =
    contextKind === "mandate"
      ? mandates.map((m) => ({
          id: m.id,
          label: m.reference + " · " + m.property.title,
        }))
      : contextKind === "estimate"
        ? (estimates.data?.items || []).map((v) => ({
            id: v.id,
            label: v.title,
          }))
        : contacts
            .filter(
              (c) =>
                contextKind !== "matching" ||
                ["buyer", "both"].includes(c.kind),
            )
            .map((c) => ({ id: c.id, label: c.name }));
  return (
    <section className="charlie-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">VOTRE ASSISTANT IMMOBILIER</div>
          <h1>Charlie, à vos côtés.</h1>
          <p>
            Préparez vos rendez-vous, résumez un dossier et rédigez des
            brouillons à relire.
          </p>
        </div>
        {role === "admin" && (
          <Button
            variant="outline"
            disabled={lock.busy || config.loading || !config.data}
            onClick={() => setConfigOpen(config.data)}
          >
            <Settings2 size={16} /> Configurer OpenAI
          </Button>
        )}
      </div>
      <div className="notice">
        {engine === "local"
          ? "Mode local : synthèses et modèles de texte fondés sur des règles métier, sans modèle d’IA et sans envoi externe."
          : "Mode OpenAI : chaque appel transmet uniquement votre message courant et le contexte affiché après confirmation. Les échanges précédents restent dans l’outil. Appels facturés par votre compte API."}{" "}
        Charlie reste en lecture seule ; aucun e-mail n’est envoyé ni dossier
        modifié.
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
      <ResourceState
        error={config.error}
        loading={config.loading}
        retry={config.refresh}
      />
      <div className="charlie-workspace">
        <aside className="panel charlie-history">
          <div className="charlie-history-heading">
            <h2>Mes conversations</h2>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Nouvelle conversation"
              disabled={readonly || lock.busy}
              onClick={newConversation}
            >
              <Plus size={18} />
            </Button>
          </div>
          <ResourceState
            error={list.error}
            loading={list.loading}
            retry={list.refresh}
          />
          {list.data?.limited && (
            <p className="commercial-status">
              100 conversations récentes affichées.
            </p>
          )}
          {list.data?.items.map((item) => (
            <button
              key={item.id}
              className={
                "charlie-history-item " +
                (selected === item.id ? "selected" : "")
              }
              disabled={lock.busy}
              onClick={() => setSelected(item.id)}
            >
              <MessageCircle size={14} />
              <span>{item.title}</span>
            </button>
          ))}
          {!list.loading && !list.data?.items.length && (
            <p className="commercial-status">
              Créez une conversation pour commencer. L’historique est privé à
              votre compte dans cet espace.
            </p>
          )}
        </aside>
        <div className="panel charlie-chat">
          <div className="charlie-context-controls">
            <Field label="Moteur de Charlie">
              {(id) => (
                <select
                  id={id}
                  disabled={lock.busy}
                  value={engine}
                  onChange={(e) => {
                    setEngine(e.target.value as "local" | "openai");
                    request.current = null;
                  }}
                >
                  <option value="local">Local · règles métier</option>
                  <option
                    value="openai"
                    disabled={!config.data?.configured || !config.data.enabled}
                  >
                    OpenAI · {config.data?.model || "non configuré"}
                  </option>
                </select>
              )}
            </Field>
            <Field label="Type de contexte">
              {(id) => (
                <select
                  id={id}
                  disabled={lock.busy}
                  value={contextKind}
                  onChange={(e) => {
                    setContextKind(e.target.value as ContextKind);
                    setContextId("");
                    setConsent(false);
                    request.current = null;
                  }}
                >
                  {Object.entries(labels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {contextKind !== "briefing" && (
              <Field label="Dossier pour Charlie">
                {(id) => (
                  <select
                    id={id}
                    disabled={lock.busy}
                    value={contextId}
                    onChange={(e) => {
                      setContextId(e.target.value);
                      setConsent(false);
                      request.current = null;
                    }}
                  >
                    <option value="">Sélectionner un dossier</option>
                    {options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
          </div>
          <ResourceState
            error={
              contextKind !== "briefing" && !contextId ? "" : context.error
            }
            loading={context.loading}
            retry={context.refresh}
          />
          {context.data && (
            <details className="charlie-context">
              <summary>
                Voir le contexte utilisé · {labels[contextKind]}
              </summary>
              <p>
                Données enregistrées, susceptibles de contenir des notes non
                vérifiées. Les champs e-mail et téléphone des contacts et le
                contenu des documents ne sont pas lus. Les notes peuvent
                contenir des informations personnelles : vérifiez l’aperçu.
              </p>
              <pre>{JSON.stringify(context.data.data, null, 2)}</pre>
              <Button
                variant="ghost"
                size="sm"
                disabled={lock.busy}
                onClick={() => {
                  setConsent(false);
                  context.refresh();
                }}
              >
                Actualiser le contexte
              </Button>
            </details>
          )}
          <div className="charlie-chat-heading">
            <strong>{conversation?.title || "Nouvelle conversation"}</strong>
            <div className="commercial-actions">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Actualiser la conversation"
                disabled={!selected || lock.busy}
                onClick={refresh}
              >
                <RefreshCw size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Supprimer la conversation"
                disabled={readonly || !conversation || lock.busy || serverBusy}
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
          {deleting && (
            <div className="notice" role="alert">
              Supprimer cette conversation et ses échanges de cet espace ? Les
              sauvegardes existantes restent distinctes.
              <div className="commercial-actions">
                <Button
                  variant="destructive"
                  disabled={lock.busy}
                  onClick={remove}
                >
                  Confirmer la suppression de la conversation
                </Button>
                <Button variant="ghost" onClick={() => setDeleting(false)}>
                  Conserver
                </Button>
              </div>
            </div>
          )}
          <div
            className="charlie-messages"
            ref={messagesView}
            aria-label="Échanges avec Charlie"
          >
            {loadingConversation && (
              <p role="status">Chargement de la conversation…</p>
            )}
            {!selected && (
              <div className="charlie-welcome">
                <Sparkles size={34} />
                <h2>Un dossier, une prochaine action.</h2>
                <p>
                  Choisissez votre contexte puis créez une conversation. Le mode
                  local propose un briefing, des synthèses et des modèles de
                  texte.
                </p>
                <Button
                  disabled={readonly || lock.busy}
                  onClick={newConversation}
                >
                  Créer une conversation
                </Button>
              </div>
            )}
            {conversation?.turns.map((turn) => (
              <article className="charlie-turn" key={turn.id}>
                <div className="charlie-question">
                  <small>Vous</small>
                  <p>{turn.question}</p>
                </div>
                <div className="charlie-answer">
                  <div className="charlie-answer-title">
                    <strong>Charlie</strong>
                    <small>
                      {turn.engine === "local"
                        ? "Local · règles métier"
                        : "OpenAI · " + turn.model}
                    </small>
                  </div>
                  {turn.status === "running" ? (
                    <p role="status">
                      Demande en cours ou à vérifier. Actualisez l’historique ;
                      ne créez pas une seconde demande identique.
                    </p>
                  ) : turn.status === "failed" ? (
                    <div className="error" role="alert">
                      {turn.error}
                    </div>
                  ) : (
                    <>
                      <p>{turn.answer}</p>
                      <div className="charlie-source-list">
                        Contexte utilisé :{" "}
                        {turn.context.sources.length
                          ? turn.context.sources.map((source) => (
                              <span key={source.kind + source.id}>
                                {source.label}
                              </span>
                            ))
                          : "briefing de l’activité enregistrée"}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copy(turn.answer)}
                      >
                        <Copy size={14} /> Copier le texte
                      </Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          {conversation && (
            <form className="charlie-composer" onSubmit={send}>
              <div className="charlie-suggestions">
                {(contextKind === "mandate"
                  ? [
                      "Résume ce mandat",
                      "Prépare un brouillon d’annonce",
                      "Prépare un brouillon d’e-mail",
                    ]
                  : contextKind === "matching"
                    ? ["Quels mandats correspondent à cet acquéreur ?"]
                    : contextKind === "estimate"
                      ? ["Résume cette estimation"]
                      : contextKind === "contact"
                        ? ["Prépare mon rendez-vous avec ce contact"]
                        : ["Prépare mon briefing du jour"]
                ).map((value) => (
                  <button
                    type="button"
                    disabled={lock.busy || readonly}
                    key={value}
                    onClick={() => {
                      setQuestion(value);
                      setConsent(false);
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <label htmlFor="charlie-question">Votre message à Charlie</label>
              <textarea
                id="charlie-question"
                maxLength={4000}
                rows={3}
                required
                value={question}
                disabled={readonly || lock.busy || serverBusy}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  setConsent(false);
                }}
                placeholder="Choisissez une suggestion ou posez une question sur le contexte sélectionné…"
              />
              {engine === "openai" && (
                <label className="commercial-check">
                  <input
                    type="checkbox"
                    checked={consent}
                    disabled={lock.busy || context.loading || !context.data}
                    onChange={(e) => setConsent(e.target.checked)}
                  />{" "}
                  J’autorise l’envoi de ce message et du contexte affiché à
                  OpenAI.
                </label>
              )}
              <div className="commercial-actions">
                <small>
                  {question.length}/4 000 ·{" "}
                  {engine === "openai"
                    ? "Historique non transmis"
                    : "Aucun appel externe"}
                </small>
                <Button
                  disabled={
                    readonly ||
                    lock.busy ||
                    serverBusy ||
                    loadingConversation ||
                    !context.data ||
                    context.loading ||
                    !question.trim() ||
                    (engine === "openai" &&
                      (!consent ||
                        !config.data?.enabled ||
                        !config.data.configured))
                  }
                >
                  <Send size={15} />
                  {lock.busy
                    ? "Préparation…"
                    : engine === "local"
                      ? "Préparer en local"
                      : "Transmettre à OpenAI"}
                </Button>
              </div>
            </form>
          )}
          {readonly && (
            <p className="notice">
              Accès en lecture seule : la création de conversations et les
              demandes à Charlie sont désactivées.
            </p>
          )}
        </div>
      </div>
      {configOpen && (
        <CharlieConfig
          config={configOpen}
          onClose={() => setConfigOpen(null)}
          onChanged={config.refresh}
        />
      )}
    </section>
  );
}
