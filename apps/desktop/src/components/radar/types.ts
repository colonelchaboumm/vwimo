export type Listing = {
  id: string;
  version: number;
  title: string;
  source_name: string;
  source_url: string;
  rights_note: string;
  provenance: string;
  city: string;
  district: string;
  address: string;
  property_type: string;
  seller_type: string;
  status: string;
  price: string;
  surface: string;
  rooms: number | null;
  published_on: string | null;
  observed_on: string;
  latitude: string | null;
  longitude: string | null;
  description: string;
  price_per_m2: string;
  first_price: string;
  price_drop: boolean;
  age_days: number | null;
};
export type ListingDetail = Listing & {
  prices: { id: string; price: string; observed_on: string; note: string }[];
  possible_duplicates: Listing[];
};
export type Activity = {
  id: string;
  kind: string;
  channel: string;
  occurred_at: string;
  message: string;
  evidence: string;
};
export type Prospect = {
  id: string;
  version: number;
  listing_id: string;
  listing: Listing;
  stage: string;
  permission: string;
  permission_note: string;
  opposed: boolean;
  notes: string;
  activities: Activity[];
  activity_count: number;
  history_limited: boolean;
  followup_due: string | null;
  followup_ready: boolean;
};
export const sellerLabels: Record<string, string> = {
  private: "Particulier",
  professional: "Professionnel",
  unknown: "À vérifier",
};
export const statusLabels: Record<string, string> = {
  active: "Active",
  removed: "Retirée",
  sold: "Vendue (déclarée)",
};
export const stageLabels: Record<string, string> = {
  qualified: "À préparer",
  contacted: "Contact déclaré",
  replied: "Réponse",
  appointment: "Rendez-vous",
  estimate: "Estimation",
  won: "Mandat déclaré",
  excluded: "Exclu",
};
export const activityLabels: Record<string, string> = {
  initial: "Premier contact effectué",
  followup: "Relance effectuée",
  reply: "Réponse reçue",
  refusal: "Refus / opposition",
  appointment: "Rendez-vous obtenu",
  estimate: "Estimation réalisée",
  mandate: "Mandat obtenu",
  note: "Note de suivi",
};
export const channelLabels: Record<string, string> = {
  phone: "Téléphone",
  email: "E-mail",
  portal: "Messagerie du portail",
  meeting: "Rendez-vous",
  other: "Autre",
};
export function parisInput(value = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
