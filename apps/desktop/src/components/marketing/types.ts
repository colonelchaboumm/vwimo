export type Campaign = {
  id: string;
  version: number;
  reference: string;
  title: string;
  segment: string;
  subject: string;
  body: string;
  sender_name: string;
  sender_email: string | null;
  reply_to: string | null;
  footer: string;
  archived: boolean;
  export_count?: number;
};
export type Permission = {
  contact_id: string;
  state: string;
  version: number;
  declared_on: string | null;
  note: string;
  email_snapshot: string | null;
  current_email?: string | null;
};
export type Exclusion = {
  id: string;
  version: number;
  email: string;
  blocked: boolean;
  note: string;
  declared_on: string;
};
export type Preview = {
  campaign: Campaign;
  eligible: { id: string; name: string; email: string }[];
  excluded: {
    id: string;
    name: string;
    email: string | null;
    reason: string;
  }[];
  digest: string;
  sample: { contact_id: string; subject: string; body: string };
  missing: string[];
  exports: {
    id: string;
    created_at: string;
    recipient_email: string;
    sha256: string;
    campaign_version: number;
  }[];
  delivery_available: false;
};
export const segments: Record<string, string> = {
  buyers: "Acquéreurs actifs",
  sellers: "Vendeurs actifs",
  professional: "Contacts professionnels actifs",
  all: "Tous les contacts actifs",
};
export const permissionStates: Record<string, string> = {
  unknown: "À vérifier",
  declared: "Autorisation newsletter déclarée",
  refused: "Refus déclaré",
  withdrawn: "Autorisation retirée",
};
