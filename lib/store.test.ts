import { describe, it, expect, beforeEach } from "vitest";
import {
  __reset,
  approveDraft,
  createDeal,
  createTask,
  deleteTask,
  moveDeal,
  recordCallLogged,
  rejectDraft,
  resolveCall,
  snapshot,
  subscribe,
  toggleIntegration,
  updateConfig,
  updateDraft,
  updateTask,
} from "./store";

beforeEach(() => {
  __reset();
});

describe("snapshot", () => {
  it("seeds demo data with consistent stats", () => {
    const s = snapshot();
    expect(s.mode).toBe("demo");
    expect(s.deals.length).toBeGreaterThan(0);
    expect(s.stats.callsLogged).toBe(12);
    expect(s.stats.draftsSent).toBe(4);
    expect(s.stats.timeSaved).toMatch(/\d+h \d+m/);
    expect(s.events.length).toBeGreaterThan(0);
  });

  it("increments the version after a mutation", () => {
    const before = snapshot().version;
    updateDraft("draft_acme", { body: "new body" });
    expect(snapshot().version).toBeGreaterThan(before);
  });
});

describe("drafts", () => {
  it("updates a draft body", () => {
    const draft = updateDraft("draft_acme", { body: "Edited body" });
    expect(draft.body).toBe("Edited body");
    expect(snapshot().drafts.find((d) => d.id === "draft_acme")?.body).toBe("Edited body");
  });

  it("approves a draft exactly once and logs stats/events", () => {
    const statsBefore = snapshot().stats.draftsSent;
    const draft = approveDraft("draft_acme");
    expect(draft.status).toBe("sent");
    expect(snapshot().stats.draftsSent).toBe(statsBefore + 1);
    expect(snapshot().events[0].type).toBe("draft_sent");
    // Idempotent: a second approval must not double-count.
    approveDraft("draft_acme");
    expect(snapshot().stats.draftsSent).toBe(statsBefore + 1);
  });

  it("rejects a draft", () => {
    const draft = rejectDraft("draft_acme");
    expect(draft.status).toBe("rejected");
  });

  it("throws for unknown drafts", () => {
    expect(() => updateDraft("nope", { body: "x" })).toThrow("Draft not found");
    expect(() => approveDraft("nope")).toThrow("Draft not found");
  });
});

describe("deals", () => {
  it("moves a deal between valid stages", () => {
    const deal = moveDeal("deal_acme", "Negotiation");
    expect(deal.stage).toBe("Negotiation");
  });

  it("rejects invalid stages", () => {
    // @ts-expect-error intentional invalid stage
    expect(() => moveDeal("deal_acme", "Won")).toThrow("Invalid stage");
  });

  it("creates a deal and logs an event", () => {
    const deal = createDeal({ account: "Initech", name: "Q1 Expansion", value: 60000, stage: "Discovery", primaryContact: "Peter G." });
    expect(snapshot().deals.some((d) => d.id === deal.id)).toBe(true);
    expect(snapshot().events[0].type).toBe("deal_created");
  });

  it("validates create input", () => {
    expect(() => createDeal({ account: "", name: "X", value: 1, stage: "Discovery" })).toThrow("Account");
    expect(() => createDeal({ account: "A", name: "X", value: -5, stage: "Discovery" })).toThrow("value");
  });
});

describe("tasks", () => {
  it("creates, completes and deletes a task", () => {
    const task = createTask({ title: "Follow up", source: "Intro Call", due: "Due Today", owner: "Rep" });
    expect(snapshot().tasks.some((t) => t.id === task.id)).toBe(true);

    updateTask(task.id, { completed: true });
    expect(snapshot().tasks.find((t) => t.id === task.id)?.completed).toBe(true);
    expect(snapshot().events[0].type).toBe("task_completed");

    deleteTask(task.id);
    expect(snapshot().tasks.some((t) => t.id === task.id)).toBe(false);
  });

  it("validates task creation", () => {
    expect(() => createTask({ title: "  ", source: "x", due: "Due Today", owner: "Rep" })).toThrow("required");
  });
});

describe("integrations & config", () => {
  it("toggles a connection and logs the event", () => {
    const before = snapshot().integrations.find((i) => i.provider === "HubSpot")?.connected;
    toggleIntegration("HubSpot");
    expect(snapshot().integrations.find((i) => i.provider === "HubSpot")?.connected).toBe(!before);
    expect(snapshot().events[0].type).toMatch(/^integration_/);
  });

  it("merges config updates", () => {
    updateConfig({ crm: "Google Sheets fallback" });
    expect(snapshot().config.crm).toBe("Google Sheets fallback");
    expect(snapshot().config.transcriptTool).toBe("Zoom");
  });
});

describe("calls", () => {
  it("increments callsLogged when a call is recorded", () => {
    const before = snapshot().stats.callsLogged;
    recordCallLogged();
    expect(snapshot().stats.callsLogged).toBe(before + 1);
  });

  it("resolves missing input and marks the call processed", () => {
    const call = resolveCall("call_stark", "Confirmed implementation date: December 1st");
    expect(call.status).toBe("processed");
    expect(call.summary).toContain("December 1st");
  });

  it("requires input text", () => {
    expect(() => resolveCall("call_stark", "   ")).toThrow("required");
  });
});

describe("live notifications", () => {
  it("notifies subscribers on change", () => {
    let notified = 0;
    const unsub = subscribe(() => {
      notified += 1;
    });
    updateDraft("draft_acme", { body: "v2" });
    expect(notified).toBeGreaterThan(0);
    unsub();
    const count = notified;
    updateDraft("draft_acme", { body: "v3" });
    expect(notified).toBe(count);
  });
});
