import type { Contact, Mandate } from "../types";
import { kinds, statuses } from "../types";
import { dateText, money } from "../lib/utils";

export function RecordDetails({
  item,
}: {
  item: Contact | Mandate | undefined;
}) {
  if (!item)
    return (
      <p className="notice">Ce compte dispose d’un accès en lecture seule.</p>
    );
  const entries: [string, string][] =
    "property" in item
      ? [
          ["Bien", item.property.title],
          ["Référence", item.reference],
          ["Adresse", item.property.address],
          ["Commune", item.property.city],
          ["Vendeur", item.seller_name],
          ["Surface", `${item.property.surface} m²`],
          ["Pièces", String(item.property.rooms)],
          ["DPE", item.property.dpe],
          ["Prix", money(item.price)],
          ["Honoraires", money(item.fees)],
          ["Type de mandat", kinds[item.kind]],
          ["Statut", statuses[item.status]],
          ["Signature", dateText(item.signed_date)],
          ["Échéance", dateText(item.end_date)],
          ["Notes", item.notes],
        ]
      : [
          ["Nom", item.name],
          ["E-mail", item.email || "Non renseigné"],
          ["Téléphone", item.phone || "Non renseigné"],
          ["Commune", item.city],
          ["Origine", item.source],
          ["Notes", item.notes],
          ...(item.criteria
            ? ([
                ["Budget maximum", money(item.criteria.budget_max)],
                ["Secteurs", item.criteria.sectors],
                ["Critères impératifs", item.criteria.mandatory],
              ] as [string, string][])
            : []),
        ];
  return (
    <dl className="record-details">
      {entries
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}
