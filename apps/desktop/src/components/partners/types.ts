export type Partner = {
  id: string;
  version: number;
  name: string;
  kind: string;
  representative: string;
  email: string | null;
  phone: string;
  city: string;
  agreement: string;
  notes: string;
  archived: boolean;
};
export type Referral = {
  id: string;
  version: number;
  reference: string;
  title: string;
  kind: string;
  partner_id: string;
  partner_name: string;
  partner_archived: boolean;
  contact_id: string;
  contact_name: string;
  transaction_id: string | null;
  source: string;
  project: string;
  introduced_on: string;
  transferred_on: string | null;
  permission: string;
  permission_on: string | null;
  permission_note: string;
  transmission: {
    partner_name: string;
    contact_name: string;
    permission_on: string;
    permission_note: string;
    transferred_on: string;
  } | null;
  stage: string;
  financing: string;
  outcome: string;
  next_action_on: string | null;
  notes: string;
  overdue: boolean;
};
export const partnerKinds: Record<string, string> = {
  broker: "Courtier",
  moving: "Déménagement",
  agency: "Agence / apporteur",
  notary: "Notaire",
  other: "Autre service",
};
export const referralKinds: Record<string, string> = {
  broker: "Courtage",
  referral: "Recommandation",
  service: "Service partenaire",
};
export const referralStages: Record<string, string> = {
  draft: "En préparation",
  introduced: "Mise en relation déclarée",
  in_progress: "En suivi",
  completed: "Réussi · déclaré",
  unsuccessful: "Sans suite",
  cancelled: "Annulé",
};
export const permissions: Record<string, string> = {
  unknown: "À vérifier",
  granted: "Autorisation déclarée",
  refused: "Refus déclaré",
  withdrawn: "Autorisation retirée",
};
export const financingLabels: Record<string, string> = {
  unknown: "À renseigner",
  requested: "Demande en cours",
  approved: "Accord déclaré",
  refused: "Refus déclaré",
};
