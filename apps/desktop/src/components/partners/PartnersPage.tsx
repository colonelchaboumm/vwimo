import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { Contact } from "../../types";
import { dateText } from "../../lib/utils";
import { ResourceState, useEditing, useResource } from "../commercial/shared";
import { Button } from "../ui/button";
import { Modal } from "../ui/dialog";
import { PartnerForm } from "./PartnerForm";
import { ReferralForm } from "./ReferralForm";
import { ReferralDetail } from "./ReferralDetail";
import {
  partnerKinds,
  permissions,
  referralKinds,
  referralStages,
  type Partner,
  type Referral,
} from "./types";

export function PartnersPage({
  contacts,
  readonly,
  onEditing,
  onChanged,
}: {
  contacts: Contact[];
  readonly: boolean;
  onEditing: (value: boolean) => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState("referrals");
  const [query, setQuery] = useState("");
  const [partnerQuery, setPartnerQuery] = useState("");
  const [stage, setStage] = useState("");
  const [archived, setArchived] = useState(false);
  const [offset, setOffset] = useState(0);
  const [partnerOffset, setPartnerOffset] = useState(0);
  const [partnerEditor, setPartnerEditor] = useState<Partner | "new" | null>(
    null,
  );
  const [partnerDetail, setPartnerDetail] = useState<Partner | null>(null);
  const [editor, setEditor] = useState<{
    item?: Referral;
    initialPartner?: Partner;
  } | null>(null);
  const [detail, setDetail] = useState<Referral | null>(null);
  const referrals = useResource<{ items: Referral[]; total: number }>(
    `/referrals?offset=${offset}&q=${encodeURIComponent(query)}&stage=${stage}`,
  );
  const partners = useResource<{ items: Partner[]; total: number }>(
    `/partners?offset=${partnerOffset}&archived=${archived}&q=${encodeURIComponent(partnerQuery)}`,
  );
  useEditing(!!editor || !!partnerEditor, onEditing);
  function refresh() {
    referrals.refresh();
    partners.refresh();
  }
  function saved() {
    setEditor(null);
    setPartnerEditor(null);
    refresh();
    onChanged();
  }
  return (
    <section className="commercial-page">
      <div className="commercial-heading">
        <div>
          <div className="eyebrow">VOTRE RÉSEAU, VOS DOSSIERS</div>
          <h1>Des relations qui font avancer vos projets.</h1>
          <p>
            Courtiers, recommandations et services partenaires, avec un
            historique et des rémunérations liées.
          </p>
        </div>
        <div className="commercial-actions">
          <Button variant="outline" onClick={refresh}>
            <RefreshCw size={15} />
            Actualiser
          </Button>
          <Button
            disabled={readonly || !contacts.length}
            onClick={() => setEditor({})}
          >
            <Plus size={15} />
            Nouveau dossier partenaire
          </Button>
        </div>
      </div>
      <div className="notice">
        Suivi déclaratif local : aucune donnée client n’est transmise et aucun
        message n’est envoyé. Vérifiez l’autorisation du client, les accords et
        les conditions d’exercice avant toute mise en relation effectuée hors de
        l’outil.
      </div>
      <div className="commercial-actions finance-tabs">
        <Button
          variant={tab === "referrals" ? "default" : "outline"}
          onClick={() => setTab("referrals")}
        >
          Mises en relation
        </Button>
        <Button
          variant={tab === "partners" ? "default" : "outline"}
          onClick={() => setTab("partners")}
        >
          Annuaire partenaires
        </Button>
      </div>
      {tab === "referrals" ? (
        <>
          <div className="partner-filters">
            <label>
              Rechercher un dossier partenaire
              <input
                aria-label="Rechercher un dossier partenaire"
                value={query}
                maxLength={180}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            <label>
              Filtrer l’étape
              <select
                aria-label="Filtrer l’étape partenaire"
                value={stage}
                onChange={(e) => {
                  setStage(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">Toutes les étapes</option>
                {Object.entries(referralStages).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ResourceState
            error={referrals.error}
            loading={referrals.loading}
            retry={referrals.refresh}
          />
          {referrals.data && (
            <>
              <p className="commercial-status">
                {referrals.data.total} dossier(s) · page{" "}
                {Math.floor(offset / 40) + 1}
              </p>
              <div className="commercial-grid">
                {referrals.data.items.map((item) => (
                  <article className="panel radar-card" key={item.id}>
                    <div className="match-top">
                      <span className="radar-pill">
                        {referralKinds[item.kind]}
                      </span>
                      <span>{item.reference}</span>
                    </div>
                    <h2>{item.title}</h2>
                    <p>
                      {item.contact_name}
                      <br />
                      {item.partner_name}
                      {item.partner_archived ? " · archivé" : ""}
                    </p>
                    <p>
                      {referralStages[item.stage]}
                      <br />
                      {permissions[item.permission]}
                    </p>
                    <p>
                      Prochaine action :{" "}
                      {item.next_action_on
                        ? dateText(item.next_action_on)
                        : "à renseigner"}
                    </p>
                    {item.overdue && (
                      <p className="finance-alert">
                        Action à examiner · date dépassée
                      </p>
                    )}
                    <div className="commercial-actions">
                      <Button variant="outline" onClick={() => setDetail(item)}>
                        Historique et revenus
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={readonly}
                        onClick={() => setEditor({ item })}
                      >
                        Modifier la mise en relation
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              {!referrals.data.items.length && (
                <div className="panel radar-empty">
                  <h2>Vos prochaines mises en relation.</h2>
                  <p>
                    Ajoutez un partenaire dans l’annuaire, puis créez un dossier
                    pour un contact déjà enregistré.
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
                  disabled={offset + 40 >= referrals.data.total}
                  onClick={() => setOffset((v) => v + 40)}
                >
                  Page suivante
                </Button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="partner-filters">
            <label>
              Rechercher dans l’annuaire
              <input
                aria-label="Rechercher dans l’annuaire"
                value={partnerQuery}
                maxLength={180}
                onChange={(e) => {
                  setPartnerQuery(e.target.value);
                  setPartnerOffset(0);
                }}
              />
            </label>
            <label className="commercial-check">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => {
                  setArchived(e.target.checked);
                  setPartnerOffset(0);
                }}
              />
              Afficher les partenaires archivés
            </label>
            <Button disabled={readonly} onClick={() => setPartnerEditor("new")}>
              <Plus size={15} />
              Nouveau partenaire
            </Button>
          </div>
          <ResourceState
            error={partners.error}
            loading={partners.loading}
            retry={partners.refresh}
          />
          {partners.data && (
            <>
              <p className="commercial-status">
                {partners.data.total} partenaire(s) · page{" "}
                {Math.floor(partnerOffset / 40) + 1}
              </p>
              <div className="commercial-grid">
                {partners.data.items.map((item) => (
                  <article className="panel radar-card" key={item.id}>
                    <div className="match-top">
                      <span className="radar-pill">
                        {partnerKinds[item.kind]}
                      </span>
                      {item.archived && <span>Archivé</span>}
                    </div>
                    <h2>{item.name}</h2>
                    <p>
                      {item.representative || "Interlocuteur à renseigner"}
                      <br />
                      {item.city || "Ville à renseigner"}
                    </p>
                    <p className="partner-notes">
                      {item.email || "E-mail à renseigner"}
                      <br />
                      {item.phone || "Téléphone à renseigner"}
                    </p>
                    <div className="commercial-actions">
                      <Button
                        variant="outline"
                        onClick={() => setPartnerDetail(item)}
                      >
                        Fiche partenaire
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={readonly}
                        onClick={() => setPartnerEditor(item)}
                      >
                        Modifier le partenaire
                      </Button>
                      {!item.archived && (
                        <Button
                          variant="ghost"
                          disabled={readonly || !contacts.length}
                          onClick={() => setEditor({ initialPartner: item })}
                        >
                          Créer une mise en relation
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!partners.data.items.length && (
                <div className="panel radar-empty">
                  <h2>Votre réseau commence ici.</h2>
                  <p>
                    Enregistrez les coordonnées et les conditions réelles de vos
                    partenaires.
                  </p>
                </div>
              )}
              <div className="commercial-actions radar-pagination">
                <Button
                  variant="outline"
                  disabled={!partnerOffset}
                  onClick={() => setPartnerOffset((v) => Math.max(0, v - 40))}
                >
                  Page précédente
                </Button>
                <Button
                  variant="outline"
                  disabled={partnerOffset + 40 >= partners.data.total}
                  onClick={() => setPartnerOffset((v) => v + 40)}
                >
                  Page suivante
                </Button>
              </div>
            </>
          )}
        </>
      )}
      {partnerEditor && (
        <PartnerForm
          item={partnerEditor === "new" ? undefined : partnerEditor}
          onClose={() => setPartnerEditor(null)}
          onSaved={saved}
        />
      )}
      {editor && (
        <ReferralForm
          {...editor}
          contacts={contacts}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
      {detail && (
        <ReferralDetail item={detail} onClose={() => setDetail(null)} />
      )}
      {partnerDetail && (
        <Modal
          open
          title={partnerDetail.name}
          onClose={() => setPartnerDetail(null)}
          description={partnerKinds[partnerDetail.kind]}
        >
          <dl className="partner-facts">
            <dt>Interlocuteur</dt>
            <dd>{partnerDetail.representative || "À renseigner"}</dd>
            <dt>E-mail</dt>
            <dd>{partnerDetail.email || "À renseigner"}</dd>
            <dt>Téléphone</dt>
            <dd>{partnerDetail.phone || "À renseigner"}</dd>
            <dt>Ville</dt>
            <dd>{partnerDetail.city || "À renseigner"}</dd>
            <dt>Accord / conditions</dt>
            <dd className="partner-notes">
              {partnerDetail.agreement || "À renseigner"}
            </dd>
            <dt>Notes</dt>
            <dd className="partner-notes">
              {partnerDetail.notes || "À renseigner"}
            </dd>
          </dl>
        </Modal>
      )}
    </section>
  );
}
