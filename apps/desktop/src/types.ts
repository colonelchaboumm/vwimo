export type Criteria = {
  budget_min: string;
  budget_max: string;
  min_surface: string;
  bedrooms: number;
  sectors: string;
  financing: string;
  mandatory: string;
};
export type Contact = {
  id: string;
  version: number;
  name: string;
  email: string | null;
  phone: string;
  kind: "buyer" | "seller" | "both" | "professional";
  city: string;
  source: string;
  notes: string;
  provenance: string;
  criteria: Criteria | null;
};
export type Property = {
  title: string;
  address: string;
  city: string;
  property_type: string;
  surface: string;
  rooms: number;
  dpe: string;
};
export type Mandate = {
  id: string;
  version: number;
  reference: string;
  seller_id: string;
  seller_name: string;
  kind: string;
  status: string;
  signed_date: string;
  end_date: string;
  price: string;
  fees: string;
  partner_name: string;
  partner_terms: string;
  commercialization_authorized: boolean;
  notes: string;
  provenance: string;
  property: Property;
};
export type Doc = {
  id: string;
  filename: string;
  category: string;
  size: number;
  created_at: string;
  contact_id: string | null;
  mandate_id: string | null;
};
export type Priority = {
  id: string;
  reference: string;
  title: string;
  detail: string;
  level: string;
};
export type DashboardData = {
  active: number;
  exclusive: number;
  simple: number;
  partner: number;
  buyers: number;
  sellers: number;
  documents: number;
  portfolio: string;
  fees_potential: string;
  priorities: Priority[];
  months: { month: string; count: number }[];
  status_counts: Record<string, number>;
};
export type Preferences = {
  mode: string;
  database: string;
  sending_available: boolean;
  automation: {
    enabled: boolean;
    daily_limit: number;
    followups: boolean;
    followup_days: number;
    timezone: string;
    sector: string;
  };
  connectors: { name: string; status: string; can_send: boolean }[];
};
export type Audit = {
  id: string;
  action: string;
  created_at: string;
  entity_id: string;
  details: Record<string, unknown>;
};
export type Bundle = {
  contacts: Contact[];
  mandates: Mandate[];
  documents: Doc[];
  dashboard: DashboardData;
  settings: Preferences;
  audit: Audit[];
};
export type Account = {
  name: string;
  email: string;
  role: string;
  mode: string;
};
export const statuses: Record<string, string> = {
  preparation: "Préparation",
  active: "Actif",
  offer: "Sous offre",
  compromise: "Sous compromis",
  sold: "Vendu",
  expired: "Expiré",
  withdrawn: "Retiré",
};
export const kinds: Record<string, string> = {
  exclusive: "Exclusif",
  simple: "Simple",
  partner: "Intercabinet",
};
