import crypto from "node:crypto";
import {
  calls as seedCalls,
  deals as seedDeals,
  drafts as seedDrafts,
  integrations as seedIntegrations,
  tasks as seedTasks,
} from "./demo-data";
import {
  STAGES,
  type ActivityEvent,
  type Call,
  type Deal,
  type Draft,
  type EventKind,
  type Integration,
  type Snapshot,
  type Stage,
  type Stats,
  type Task,
  type WorkspaceConfig,
} from "./types";

export type DB = {
  version: number;
  deals: Deal[];
  calls: Call[];
  drafts: Draft[];
  tasks: Task[];
  integrations: Integration[];
  config: WorkspaceConfig;
  events: ActivityEvent[];
  stats: { callsLogged: number; draftsSent: number };
  processedFingerprints: Set<string>;
  cannedCursor: number;
};

function nowIso(offsetMin = 0): string {
  return new Date(Date.now() - offsetMin * 60_000).toISOString();
}

function seed(): DB {
  return {
    version: 1,
    deals: seedDeals.map((d) => ({ ...d })),
    calls: seedCalls.map((c) => ({ ...c, draftId: c.draftId ?? null })),
    drafts: seedDrafts.map((d) => ({ ...d })),
    tasks: seedTasks.map((t) => ({ ...t })),
    integrations: seedIntegrations.map((i) => ({ ...i })),
    config: {
      crm: "HubSpot",
      transcriptTool: "Zoom",
      recapDestination: "Slack channel",
      transcriptFolder: "Gravity Transcripts",
    },
    // Events are derived from the seeded entities (newest first) so the feed
    // is consistent with the data it describes, with now-relative timestamps.
    events: [
      { id: crypto.randomUUID(), type: "call_logged", title: "Acme Corp Initial Discovery", detail: "Zoom · Today, 10:00 AM", kind: "live", createdAt: nowIso(30) },
      { id: crypto.randomUUID(), type: "draft_sent", title: "Follow-up sent to grace.ng@globalnet.com", detail: "Gmail · Today, 9:20 AM", kind: "draft", createdAt: nowIso(40) },
      { id: crypto.randomUUID(), type: "call_logged", title: "Globex Initial Pitch", detail: "Zoom · Today, 9:15 AM", kind: "live", createdAt: nowIso(45) },
      { id: crypto.randomUUID(), type: "call_logged", title: "Stark Ind. Pilot Sync", detail: "Phone · Yesterday, 4:15 PM", kind: "input", createdAt: nowIso(60 * 26) },
    ],
    // Stats are derived from the actual seeded entities, so every number shown
    // in the UI is verifiable against the data behind it.
    stats: {
      callsLogged: seedCalls.length,
      draftsSent: seedDrafts.filter((d) => d.status === "sent").length,
    },
    processedFingerprints: new Set<string>(),
    cannedCursor: 0,
  };
}

// Next.js dev bundles route handlers separately, so a module-level `db` would
// give every route its own in-memory database (mutations land in one copy,
// reads come from another). Keeping the singleton on globalThis makes every
// bundled copy — and every HMR reload — share one source of truth.
const GLOBAL_KEY = "__gravity_live_store__";
type StoreHolder = { db: DB | null; listeners: Set<() => void> };

function holder(): StoreHolder {
  const g = globalThis as { [GLOBAL_KEY]?: StoreHolder };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { db: null, listeners: new Set() };
  return g[GLOBAL_KEY];
}

export function getDb(): DB {
  const h = holder();
  if (!h.db) h.db = seed();
  return h.db;
}

/** Test-only: wipe the singleton so each test starts from seed state. */
export function __reset(): void {
  holder().db = null;
}

function commit(): void {
  const s = getDb();
  s.version += 1;
  for (const fn of holder().listeners) fn();
}

function formatTimeSaved(calls: number, drafts: number): string {
  const minutes = calls * 10 + drafts * 5;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function stats(): Stats {
  const s = getDb().stats;
  return { callsLogged: s.callsLogged, draftsSent: s.draftsSent, timeSaved: formatTimeSaved(s.callsLogged, s.draftsSent) };
}

export function snapshot(): Snapshot {
  const s = getDb();
  return {
    version: s.version,
    mode: "demo",
    deals: s.deals,
    calls: s.calls,
    drafts: s.drafts,
    tasks: s.tasks,
    integrations: s.integrations,
    config: s.config,
    events: s.events,
    stats: stats(),
  };
}

export function subscribe(fn: () => void): () => void {
  holder().listeners.add(fn);
  return () => {
    holder().listeners.delete(fn);
  };
}

export function logEvent(type: string, title: string, detail: string, kind: EventKind): void {
  const s = getDb();
  s.events.unshift({ id: crypto.randomUUID(), type, title, detail, kind, createdAt: new Date().toISOString() });
  if (s.events.length > 40) s.events.length = 40;
  commit();
}

// ---- Deals ----------------------------------------------------------------

export function getDeal(id: string): Deal | undefined {
  return getDb().deals.find((d) => d.id === id);
}

export function moveDeal(id: string, stage: Stage): Deal {
  const s = getDb();
  const deal = s.deals.find((d) => d.id === id);
  if (!deal) throw new Error("Deal not found");
  if (!STAGES.includes(stage)) throw new Error(`Invalid stage: ${stage}`);
  if (deal.stage === stage) return deal;
  deal.stage = stage;
  commit();
  logEvent("deal_moved", `${deal.account} → ${stage}`, "Pipeline · just now", "muted");
  return deal;
}

export function updateDeal(id: string, patch: Partial<Pick<Deal, "name" | "account" | "value" | "due" | "primaryContact">>): Deal {
  const s = getDb();
  const deal = s.deals.find((d) => d.id === id);
  if (!deal) throw new Error("Deal not found");
  Object.assign(deal, patch);
  commit();
  return deal;
}

export function createDeal(input: { account: string; name: string; value: number; stage: Stage; primaryContact?: string; due?: string }): Deal {
  const s = getDb();
  if (!input.account.trim() || !input.name.trim()) throw new Error("Account and deal name are required");
  if (!Number.isFinite(input.value) || input.value < 0) throw new Error("Deal value must be a non-negative number");
  if (!STAGES.includes(input.stage)) throw new Error(`Invalid stage: ${input.stage}`);
  const deal: Deal = {
    id: `deal_${crypto.randomUUID().slice(0, 8)}`,
    account: input.account.trim(),
    name: input.name.trim(),
    stage: input.stage,
    value: input.value,
    due: input.due?.trim() || "Pending",
    owner: "Demo Rep",
    primaryContact: input.primaryContact?.trim() || "Not specified",
    budget: "Not specified",
    timeline: "Not specified",
    decisionMaker: input.primaryContact?.trim() || "Not specified",
    competitors: "Not specified",
  };
  s.deals.unshift(deal);
  commit();
  logEvent("deal_created", `${deal.account} — ${deal.name} created`, "Pipeline · just now", "muted");
  return deal;
}

// ---- Calls ----------------------------------------------------------------

export function getCall(id: string): Call | undefined {
  return getDb().calls.find((c) => c.id === id);
}

export function createCall(input: Omit<Call, "id" | "status" | "transcriptUrl"> & { id?: string }): Call {
  const s = getDb();
  const call: Call = {
    id: input.id ?? `call_${crypto.randomUUID().slice(0, 8)}`,
    title: input.title,
    date: input.date,
    duration: input.duration,
    source: input.source,
    summary: input.summary,
    objections: input.objections,
    commitments: input.commitments,
    dealId: input.dealId,
    draftId: input.draftId ?? null,
    status: "processed",
    transcriptUrl: "#demo-transcript",
  };
  s.calls.unshift(call);
  commit();
  return call;
}

export function recordCallLogged(): void {
  const s = getDb();
  s.stats.callsLogged += 1;
  commit();
}

export function setCallDraft(callId: string, draftId: string): void {
  const s = getDb();
  const call = s.calls.find((c) => c.id === callId);
  if (!call) throw new Error("Call not found");
  call.draftId = draftId;
  commit();
}

export function resolveCall(id: string, info: string): Call {
  const s = getDb();
  const call = s.calls.find((c) => c.id === id);
  if (!call) throw new Error("Call not found");
  const text = info.trim();
  if (!text) throw new Error("Missing info is required");
  call.summary = `${call.summary}\n\nResolved: ${text}`;
  call.status = "processed";
  commit();
  logEvent("input_resolved", `Input resolved — ${call.title}`, `${call.source} · just now`, "live");
  return call;
}

// ---- Drafts ---------------------------------------------------------------

export function getDraft(id: string): Draft | undefined {
  return getDb().drafts.find((d) => d.id === id);
}

export function createDraft(input: Omit<Draft, "id" | "status"> & { id?: string }): Draft {
  const s = getDb();
  const draft: Draft = {
    id: input.id ?? `draft_${crypto.randomUUID().slice(0, 8)}`,
    callId: input.callId,
    to: input.to,
    subject: input.subject,
    body: input.body,
    status: "awaiting_approval",
  };
  s.drafts.unshift(draft);
  commit();
  return draft;
}

export function updateDraft(id: string, patch: Partial<Pick<Draft, "body" | "subject" | "to">>): Draft {
  const s = getDb();
  const draft = s.drafts.find((d) => d.id === id);
  if (!draft) throw new Error("Draft not found");
  Object.assign(draft, patch);
  commit();
  return draft;
}

export function approveDraft(id: string): Draft {
  const s = getDb();
  const draft = s.drafts.find((d) => d.id === id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status === "sent") return draft; // idempotent
  draft.status = "sent";
  s.stats.draftsSent += 1;
  commit();
  logEvent("draft_sent", `Follow-up sent to ${draft.to}`, "Gmail · just now", "draft");
  return draft;
}

export function rejectDraft(id: string): Draft {
  const s = getDb();
  const draft = s.drafts.find((d) => d.id === id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status === "rejected") return draft;
  draft.status = "rejected";
  commit();
  logEvent("draft_rejected", `Draft rejected — ${draft.subject}`, "Follow-up workspace · just now", "input");
  return draft;
}

// ---- Tasks ----------------------------------------------------------------

export function getTask(id: string): Task | undefined {
  return getDb().tasks.find((t) => t.id === id);
}

export function createTask(input: { title: string; source: string; due: string; owner: Task["owner"] }): Task {
  const s = getDb();
  if (!input.title.trim()) throw new Error("Task title is required");
  const task: Task = {
    id: `task_${crypto.randomUUID().slice(0, 8)}`,
    title: input.title.trim(),
    source: input.source.trim() || "Manual task",
    due: input.due,
    owner: input.owner,
    completed: false,
  };
  s.tasks.unshift(task);
  commit();
  logEvent("task_added", `Task created — ${task.title}`, "Daily Focus · just now", "muted");
  return task;
}

export function updateTask(id: string, patch: Partial<Pick<Task, "title" | "due" | "owner" | "completed">>): Task {
  const s = getDb();
  const task = s.tasks.find((t) => t.id === id);
  if (!task) throw new Error("Task not found");
  if (patch.completed !== undefined && patch.completed !== task.completed) {
    task.completed = patch.completed;
    commit();
    logEvent(patch.completed ? "task_completed" : "task_reopened", `${task.title} ${patch.completed ? "completed" : "reopened"}`, "Daily Focus · just now", "muted");
  } else {
    Object.assign(task, patch);
    commit();
  }
  return task;
}

export function deleteTask(id: string): void {
  const s = getDb();
  const task = s.tasks.find((t) => t.id === id);
  if (!task) return;
  s.tasks = s.tasks.filter((t) => t.id !== id);
  commit();
  logEvent("task_removed", `Task removed — ${task.title}`, "Daily Focus · just now", "muted");
}

// ---- Integrations & config ------------------------------------------------

export function toggleIntegration(provider: Integration["provider"]): Integration[] {
  const s = getDb();
  const row = s.integrations.find((i) => i.provider === provider);
  if (!row) throw new Error(`Unknown provider: ${provider}`);
  row.connected = !row.connected;
  commit();
  logEvent(row.connected ? "integration_connected" : "integration_disconnected", `${provider} ${row.connected ? "connected" : "disconnected"}`, "Settings · just now", row.connected ? "live" : "input");
  return s.integrations;
}

export function updateConfig(patch: Partial<WorkspaceConfig>): WorkspaceConfig {
  const s = getDb();
  Object.assign(s.config, patch);
  commit();
  logEvent("config_updated", "Workspace setup updated", "Settings · just now", "muted");
  return { ...s.config };
}

// ---- Fingerprint ledger (used by the demo pipeline sweep) -----------------

export function hasFingerprint(fp: string): boolean {
  return getDb().processedFingerprints.has(fp);
}

export function rememberFingerprint(fp: string): void {
  getDb().processedFingerprints.add(fp);
}

export function nextCannedIndex(): number {
  const s = getDb();
  const idx = s.cannedCursor;
  s.cannedCursor += 1;
  return idx;
}
