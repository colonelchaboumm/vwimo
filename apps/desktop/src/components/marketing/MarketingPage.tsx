import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { Contact } from "../../types";
import { dateText } from "../../lib/utils";
import { ResourceState, useEditing, useResource } from "../commercial/shared";
import { Button } from "../ui/button";
import { CampaignForm } from "./CampaignForm";
import { CampaignDetail } from "./CampaignDetail";
import { ExclusionForm, PermissionForm } from "./PreferenceForms";
import { segments, type Campaign, type Exclusion } from "./types";

export function MarketingPage({
  contacts,
  role,
  onEditing,
  onChanged,
}: {
  contacts: Contact[];
  role: string;
  onEditing: (v: boolean) => void;
  onChanged: () => void;
}) {
  const readonly = role === "reader";
  const [tab, setTab] = useState("drafts");
  const [archived, setArchived] = useState(false);
  const [offset, setOffset] = useState(0);
  const [exclusionOffset, setExclusionOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contactId, setContactId] = useState("");
  const [editor, setEditor] = useState<{
    item?: Campaign;
    copy?: Campaign;
  } | null>(null);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [permission, setPermission] = useState<Contact | null>(null);
  const [exclusion, setExclusion] = useState<Exclusion | "new" | null>(null);
  const campaigns = useResource<{ items: Campaign[]; total: number }>(
    `/marketing/campaigns?archived=${archived}&offset=${offset}`,
  );
  const exclusions = useResource<{ items: Exclusion[]; total: number }>(
    `/marketing/exclusions?offset=${exclusionOffset}&q=${encodeURIComponent(query)}`,
  );
  useEditing(!!editor || !!detail || !!permission || !!exclusion, onEditing);
  function refresh() {
    campaigns.refresh();
    exclusions.refresh();
  }
  function saved() {
    setEditor(null);
    setExclusion(null);
    setPermission(null);
    refresh();
    onChanged();
  }
  const filtered = contacts
    .filter((c) =>
      (c.name + " " + (c.email || ""))
        .toLocaleLowerCase("fr")
        .includes(contactQuery.toLocaleLowerCase("fr")),
    )
    .slice(0, 100);
  const selected = contacts.find((c) => c.id === contactId);
  return (
    <section className="commercial-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">MARKETING & NEWSLETTERS</div>
          <h1>Vos messages, préparés avec soin.</h1>
          <p>
            Brouillons, autorisations spécifiques et exclusions avant toute
            préparation individuelle.
          </p>
        </div>
        <div className="commercial-actions">
          <Button variant="outline" onClick={refresh}>
            <RefreshCw size={15} />
            Actualiser
          </Button>
          <Button disabled={readonly} onClick={() => setEditor({})}>
            <Plus size={15} />
            Nouveau brouillon
          </Button>
        </div>
      </div>
      <div className="notice">
        Cette version prépare des fichiers EML locaux, sans envoi ni connexion
        Outlook. Seuls les contacts actifs avec une autorisation newsletter
        déclarée pour leur adresse actuelle et sans opposition sont éligibles.
        Les autres bases de prospection ne sont pas prises en charge par ce
        module.
      </div>
      <div className="commercial-actions finance-tabs">
        <Button
          variant={tab === "drafts" ? "default" : "outline"}
          onClick={() => setTab("drafts")}
        >
          Brouillons newsletter
        </Button>
        <Button
          variant={tab === "permissions" ? "default" : "outline"}
          onClick={() => setTab("permissions")}
        >
          Préférences newsletter
        </Button>
        <Button
          variant={tab === "exclusions" ? "default" : "outline"}
          onClick={() => setTab("exclusions")}
        >
          Exclusions e-mail
        </Button>
      </div>
      {tab === "drafts" ? (
        <>
          <label className="commercial-check">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => {
                setArchived(e.target.checked);
                setOffset(0);
              }}
            />
            Afficher les brouillons archivés
          </label>
          <ResourceState
            error={campaigns.error}
            loading={campaigns.loading}
            retry={campaigns.refresh}
          />
          {campaigns.data && (
            <>
              <p className="commercial-status">
                {campaigns.data.total} brouillon(s) · page{" "}
                {Math.floor(offset / 40) + 1}
              </p>
              <div className="commercial-grid">
                {campaigns.data.items.map((item) => (
                  <article className="panel radar-card" key={item.id}>
                    <div className="match-top">
                      <span className="radar-pill">
                        {item.archived ? "Archivé" : "Brouillon local"}
                      </span>
                      <span>{item.reference}</span>
                    </div>
                    <h2>{item.title}</h2>
                    <p>{segments[item.segment]}</p>
                    <p>{item.subject || "Objet à renseigner"}</p>
                    <p>
                      {item.export_count || 0} fichier(s) préparé(s) · aucun
                      envoi confirmé
                    </p>
                    <div className="commercial-actions">
                      <Button variant="outline" onClick={() => setDetail(item)}>
                        Prévisualiser et préparer
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={readonly}
                        onClick={() => setEditor({ item })}
                      >
                        Modifier le brouillon
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={readonly}
                        onClick={() => setEditor({ copy: item })}
                      >
                        Dupliquer le brouillon
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              {!campaigns.data.items.length && (
                <div className="panel radar-empty">
                  <h2>Votre prochaine lettre commence ici.</h2>
                  <p>
                    Enregistrez un brouillon, vérifiez les préférences des
                    contacts et préparez un fichier individuel.
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
                  disabled={offset + 40 >= campaigns.data.total}
                  onClick={() => setOffset((v) => v + 40)}
                >
                  Page suivante
                </Button>
              </div>
            </>
          )}
        </>
      ) : tab === "permissions" ? (
        <section className="panel marketing-settings">
          <h2>Une préférence propre aux newsletters.</h2>
          <p>
            Les autorisations de mise en relation ou de prospection ne valent
            pas autorisation newsletter dans ce module. Choisissez un contact
            pour consulter ou mettre à jour sa déclaration.
          </p>
          <div className="radar-form-grid">
            <label>
              Rechercher un contact newsletter
              <input
                aria-label="Rechercher un contact newsletter"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
              />
            </label>
            <label>
              Contact newsletter
              <select
                aria-label="Contact newsletter"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
              >
                <option value="">Choisir un contact</option>
                {selected && !filtered.some((c) => c.id === selected.id) && (
                  <option value={selected.id}>{selected.name}</option>
                )}
                {filtered.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.email || "sans e-mail"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="commercial-status">
            100 résultats maximum ; affinez la recherche si nécessaire.
          </p>
          <Button
            disabled={!selected}
            onClick={() => selected && setPermission(selected)}
          >
            {readonly
              ? "Consulter la préférence"
              : "Gérer la préférence newsletter"}
          </Button>
        </section>
      ) : (
        <>
          <div className="partner-filters">
            <label>
              Rechercher une adresse exclue
              <input
                aria-label="Rechercher une adresse exclue"
                value={query}
                maxLength={254}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setExclusionOffset(0);
                }}
              />
            </label>
            <Button disabled={readonly} onClick={() => setExclusion("new")}>
              Nouvelle exclusion
            </Button>
          </div>
          <ResourceState
            error={exclusions.error}
            loading={exclusions.loading}
            retry={exclusions.refresh}
          />
          {exclusions.data && (
            <>
              <p className="commercial-status">
                {exclusions.data.total} adresse(s) enregistrée(s) · page{" "}
                {Math.floor(exclusionOffset / 40) + 1}
              </p>
              <div className="commercial-grid">
                {exclusions.data.items.map((item) => (
                  <article className="panel radar-card" key={item.id}>
                    <span className="radar-pill">
                      {item.blocked ? "Exclusion active" : "Exclusion levée"}
                    </span>
                    <h2 className="marketing-email">{item.email}</h2>
                    <p>{dateText(item.declared_on)}</p>
                    <p className="marketing-text">{item.note}</p>
                    <Button
                      variant="outline"
                      disabled={readonly}
                      onClick={() => setExclusion(item)}
                    >
                      Modifier l’exclusion
                    </Button>
                  </article>
                ))}
              </div>
              {!exclusions.data.items.length && (
                <div className="panel radar-empty">
                  <h2>Aucune exclusion dans cette recherche.</h2>
                  <p>
                    Les refus et retraits enregistrés créent automatiquement une
                    exclusion d’adresse.
                  </p>
                </div>
              )}
              <div className="commercial-actions radar-pagination">
                <Button
                  variant="outline"
                  disabled={!exclusionOffset}
                  onClick={() => setExclusionOffset((v) => Math.max(0, v - 40))}
                >
                  Page précédente
                </Button>
                <Button
                  variant="outline"
                  disabled={exclusionOffset + 40 >= exclusions.data.total}
                  onClick={() => setExclusionOffset((v) => v + 40)}
                >
                  Page suivante
                </Button>
              </div>
            </>
          )}
        </>
      )}
      {editor && (
        <CampaignForm
          {...editor}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
      {detail && (
        <CampaignDetail
          item={detail}
          readonly={readonly}
          onClose={() => setDetail(null)}
          onChanged={() => {
            refresh();
            onChanged();
          }}
        />
      )}
      {permission && (
        <PermissionForm
          contact={permission}
          readonly={readonly}
          onClose={() => setPermission(null)}
          onSaved={saved}
        />
      )}
      {exclusion && (
        <ExclusionForm
          item={exclusion === "new" ? undefined : exclusion}
          admin={role === "admin"}
          onClose={() => setExclusion(null)}
          onSaved={saved}
        />
      )}
    </section>
  );
}
