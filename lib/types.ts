export type Stage = "Discovery" | "Proposal" | "Negotiation" | "Closed Won";
export const STAGES: Stage[] = ["Discovery", "Proposal", "Negotiation", "Closed Won"];
export type DraftStatus = "drafted" | "awaiting_approval" | "sent" | "rejected";
export type CallStatus = "processed" | "input_needed";

export type Deal = {
  id: string;
  account: string;
  name: string;
  stage: Stage;
  value: number;
  due: string;
  owner: string;
  primaryContact: string;
  budget: string;
  timeline: string;
  decisionMaker: string;
  competitors: string;
};

export type Call = {
  id: string;
  title: string;
  date: string;
  duration: string;
  source: "Zoom" | "Gmail" | "Drive" | "Phone";
  summary: string;
  objections: string[];
  commitments: string[];
  dealId: string;
  draftId: string | null;
  status: CallStatus;
  transcriptUrl: string;
};

export type Draft = {
  id: string;
  callId: string;
  to: string;
  subject: string;
  body: string;
  status: DraftStatus;
  gmailDraftId?: string;
};

export type Task = {
  id: string;
  title: string;
  source: string;
  due: string;
  owner: "Rep" | "Client";
  completed: boolean;
};

export type Integration = {
  provider:
    | "Gmail"
    | "Google Calendar"
    | "Zoom"
    | "Google Drive"
    | "Slack"
    | "HubSpot"
    | "Google Sheets";
  connected: boolean;
};

export type WorkspaceConfig = {
  crm: string;
  transcriptTool: string;
  recapDestination: string;
  transcriptFolder: string;
};

export type EventKind = "live" | "draft" | "input" | "muted";

export type ActivityEvent = {
  id: string;
  type: string;
  title: string;
  detail: string;
  kind: EventKind;
  createdAt: string; // ISO
};

export type Stats = { callsLogged: number; draftsSent: number; timeSaved: string };

export type Snapshot = {
  version: number;
  mode: "demo";
  deals: Deal[];
  calls: Call[];
  drafts: Draft[];
  tasks: Task[];
  integrations: Integration[];
  config: WorkspaceConfig;
  events: ActivityEvent[];
  stats: Stats;
};

export type CannedTranscript = {
  id: string;
  title: string;
  attendees: string[];
  body: string;
  source: "Zoom" | "Gmail";
  duration: string;
  dealId: string;
  extraction: {
    summary: string;
    objections: string[];
    commitments: string[];
    tasks: { title: string; due: string; owner: "Rep" | "Client" }[];
    draft: { to: string; subject: string; body: string };
  };
};
