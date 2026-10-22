export type ContextKind =
  | "briefing"
  | "contact"
  | "mandate"
  | "estimate"
  | "matching";
export type ContextSource = { kind: string; id: string; label: string };
export type CharlieContext = {
  kind: ContextKind;
  id: string | null;
  data: Record<string, unknown>;
  sources: ContextSource[];
  digest: string;
};
export type CharlieConfig = {
  enabled: boolean;
  model: string;
  configured: boolean;
  key_source: "none" | "windows" | "environment";
  storage_supported: boolean;
  max_output_tokens: number;
  tested_at: string | null;
  key_error: string;
  local_available: boolean;
};
export type Turn = {
  id: string;
  question: string;
  answer: string;
  engine: "local" | "openai";
  model: string;
  status: "running" | "completed" | "failed";
  context: CharlieContext;
  error: string;
  created_at: string;
};
export type Conversation = {
  id: string;
  title: string;
  version: number;
  updated_at: string;
  pending_request_id: string | null;
  pending_since: string | null;
  turns: Turn[];
};
