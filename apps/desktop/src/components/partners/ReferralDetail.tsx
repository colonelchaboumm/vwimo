import { dateText } from "../../lib/utils";
import { ResourceState, useResource } from "../commercial/shared";
import { Modal } from "../ui/dialog";
import {
  bases,
  financeMoney,
  incomeStatuses,
  type Income,
} from "../finance/types";
import {
  permissions,
  referralStages,
  financingLabels,
  type Referral,
} from "./types";

type Detail = Referral & {
  events: {
    id: string;
    created_at: string;
    actor_name: string;
    changes: {
      created: boolean;
      fields: string[];
      stage: { before: string | null; after: string };
      permission: { before: string | null; after: string };
    };
  }[];
  events_limited: boolean;
  incomes: Income[];
  incomes_limited: boolean;
};
export function ReferralDetail({
  item,
  onClose,
}: {
  item: Referral;
  onClose: () => void;
}) {
  const resource = useResource<Detail>("/referrals/" + item.id);
  const value = resource.data;
  return (
    <Modal
      open
      wide
      title={item.reference + " · " + item.title}
      onClose={onClose}
      description="Historique local et rémunérations liées. Aucun envoi externe ni facture n’est effectué."
    >
      <ResourceState
        error={resource.error}
        loading={resource.loading}
        retry={resource.refresh}
      />
      {value && (
        <>
          <dl className="partner-facts">
            <dt>Partenaire</dt>
            <dd>
              {value.partner_name}
              {value.partner_archived ? " · archivé" : ""}
            </dd>
            <dt>Contact</dt>
            <dd>{value.contact_name}</dd>
            <dt>Origine</dt>
            <dd>{value.source}</dd>
            <dt>Projet</dt>
            <dd>{value.project}</dd>
            <dt>Ouverture</dt>
            <dd>{dateText(value.introduced_on)}</dd>
            <dt>Étape</dt>
            <dd>{referralStages[value.stage]}</dd>
            <dt>Autorisation actuelle</dt>
            <dd>
              {permissions[value.permission]}
              {value.permission_on ? " · " + dateText(value.permission_on) : ""}
              <p>{value.permission_note}</p>
            </dd>
            {value.kind === "broker" && (
              <>
                <dt>Financement</dt>
                <dd>{financingLabels[value.financing]}</dd>
              </>
            )}
            <dt>Prochaine action</dt>
            <dd>
              {value.next_action_on
                ? dateText(value.next_action_on)
                : "À renseigner"}
            </dd>
            <dt>Résultat</dt>
            <dd>{value.outcome || "À renseigner"}</dd>
          </dl>
          {value.transmission && (
            <section className="finance-calculation">
              <h3>Mise en relation déclarée conservée</h3>
              <p>
                {dateText(value.transmission.transferred_on)} ·{" "}
                {value.transmission.contact_name} →{" "}
                {value.transmission.partner_name}
              </p>
              <p>
                Autorisation déclarée le{" "}
                {dateText(value.transmission.permission_on)} :{" "}
                {value.transmission.permission_note}
              </p>
              <p>
                Cette trace conserve votre déclaration au moment de
                l’enregistrement. Elle ne confirme pas un envoi technique ni la
                validité d’un justificatif.
              </p>
            </section>
          )}
          <h3 className="radar-section-title">Rémunérations liées</h3>
          {!value.incomes.length && (
            <p className="commercial-status">
              Aucune rémunération liée. Dans Commissions & revenus, choisissez
              ce dossier lors de la création ou modification d’une prévision.
            </p>
          )}
          <ul className="finance-payments">
            {value.incomes.map((income) => (
              <li key={income.id}>
                <strong>
                  {income.reference} · {financeMoney(income.amount)}
                </strong>
                <br />
                {incomeStatuses[income.status]} · {bases[income.amount_basis]}
                <br />
                Encaissé déclaré : {financeMoney(income.paid)}
              </li>
            ))}
          </ul>
          {value.incomes_limited && (
            <p className="notice">
              200 revenus maximum affichés ; consultez aussi Commissions &
              revenus.
            </p>
          )}
          <h3 className="radar-section-title">Historique du dossier</h3>
          <ol className="partner-history">
            {value.events.map((event) => (
              <li key={event.id}>
                <strong>
                  {event.changes.created
                    ? "Dossier créé"
                    : "Dossier mis à jour"}
                </strong>
                <span>
                  {dateText(event.created_at)} · {event.actor_name}
                </span>
                <p>
                  Étape : {referralStages[event.changes.stage.after]}
                  <br />
                  Autorisation : {permissions[event.changes.permission.after]}
                </p>
              </li>
            ))}
          </ol>
          {value.events_limited && (
            <p className="notice">200 événements les plus récents affichés.</p>
          )}
          {value.notes && (
            <p className="commercial-status partner-notes">{value.notes}</p>
          )}
        </>
      )}
    </Modal>
  );
}
