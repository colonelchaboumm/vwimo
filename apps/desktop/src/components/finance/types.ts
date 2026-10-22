export type Transaction = {
  id: string;
  version: number;
  reference: string;
  mandate_id: string;
  mandate_reference: string;
  buyer_id: string | null;
  buyer_name: string;
  stage: string;
  sale_price: string;
  notary: string;
  offer_on: string | null;
  compromise_on: string | null;
  expected_deed_on: string | null;
  deed_on: string | null;
  financing: string;
  conditions: string;
  checklist: { label: string; done: boolean }[];
  notes: string;
  overdue: boolean;
  unchecked: number;
};
export type Plan = {
  id: string;
  name: string;
  partner: string;
  base_label: string;
  amount_basis: string;
  method: string;
  period: string;
  effective_from: string;
  effective_to: string | null;
  opening_base: string;
  opening_on: string | null;
  tiers: { threshold: string; rate: string }[];
  notes: string;
};
export type Calculation = {
  method: string;
  amount: string;
  cumulative_before?: string;
  cumulative_after?: string;
  base?: string;
  base_label?: string;
  plan_name?: string;
  period_start?: string;
  period_end_exclusive?: string;
  adjustment: string;
  adjustment_reason?: string;
  rounding?: string;
  before_rate?: string;
  after_rate?: string;
  entitlement_before?: string;
  entitlement_after?: string;
  segments?: { base: string; rate: string; commission_unrounded: string }[];
};
export type Income = {
  id: string;
  version: number;
  reference: string;
  title: string;
  category: string;
  partner: string;
  transaction_id: string | null;
  contact_id: string | null;
  plan_id: string | null;
  base_amount: string;
  fixed_amount: string | null;
  adjustment: string;
  adjustment_reason: string;
  amount_basis: string;
  amount: string;
  expected_on: string;
  earned_on: string | null;
  status: string;
  calculation: Calculation;
  justification: string;
  notes: string;
  paid: string;
  remaining: string;
  overdue: boolean;
};
export type Payment = {
  id: string;
  paid_on: string;
  amount: string;
  reference: string;
};
export const transactionStages: Record<string, string> = {
  marketing: "Commercialisation",
  visits: "Visites",
  offer: "Offre",
  accepted: "Offre acceptée",
  file: "Dossier en préparation",
  compromise: "Compromis",
  conditions: "Conditions suspensives",
  financing: "Financement",
  signed: "Vente signée (déclarée)",
  cancelled: "Annulée",
};
export const categories: Record<string, string> = {
  sale: "Part vente",
  mandate: "Part entrée de mandat",
  broker: "Courtier",
  moving: "Déménagement",
  referral: "Recommandation",
  other: "Autre partenaire",
};
export const bases: Record<string, string> = {
  contract: "Montant contractuel · TVA non déterminée",
  ht: "HT déclaré",
  ttc: "TTC déclaré",
};
export const incomeStatuses: Record<string, string> = {
  forecast: "Prévision",
  acquired: "Validé par vous",
  cancelled: "Prévision annulée",
};
export const financeMoney = (value: number | string) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
