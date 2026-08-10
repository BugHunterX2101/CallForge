"use client";

import Link from "next/link";
import { useState } from "react";
import { api, pushToast, useLive } from "@/lib/live";
import { timeAgo } from "@/lib/format";
import { Modal } from "./modal";
import type { Call, Draft } from "@/lib/types";

const ICONS: Record<string, string> = {
  call_logged: "videocam",
  draft_sent: "send",
  draft_ready: "mail",
  draft_rejected: "block",
  draft_updated: "edit",
  input_resolved: "check_circle",
  deal_created: "account_balance",
  deal_moved: "swap_horiz",
  task_added: "task_alt",
  task_completed: "task_alt",
  task_reopened: "undo",
  task_removed: "delete",
  integration_connected: "link",
  integration_disconnected: "link_off",
  config_updated: "settings",
};

function kindChip(kind: string): { text: string; cls: string } {
  switch (kind) {
    case "live":
      return { text: "Logged", cls: "live" };
    case "draft":
      return { text: "Draft", cls: "draft" };
    case "input":
      return { text: "Input", cls: "input" };
    default:
      return { text: "System", cls: "muted" };
  }
}

export function Activity() {
  const live = useLive();
  const [sweeping, setSweeping] = useState(false);
  const [inputCall, setInputCall] = useState<Call | null>(null);
  const [info, setInfo] = useState("");
  const [showAll, setShowAll] = useState(false);

  if (!live) {
    return (
      <main className="page">
        <div className="skeleton hero" />
        <div className="grid">
          <div className="skeleton card" />
          <div className="skeleton card" />
          <div className="skeleton card" />
          <div className="skeleton card wide" />
        </div>
      </main>
    );
  }

  const { stats, drafts, calls, integrations, events } = live;
  const pending = drafts.filter((d) => d.status === "awaiting_approval" || d.status === "drafted");
  const inputNeeded = calls.filter((c) => c.status === "input_needed");
  const connected = integrations.filter((i) => i.connected);
  const visibleEvents = showAll ? events : events.slice(0, 6);

  const approve = async (draft: Draft) => {
    try {
      await api.approveDraft(draft.id);
      pushToast(`Follow-up sent to ${draft.to} — Gmail copy saved.`);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not send draft", "error");
    }
  };

  const reject = async (draft: Draft) => {
    try {
      await api.rejectDraft(draft.id);
      pushToast("Draft rejected — the Gmail copy is preserved for editing.", "info");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not reject draft", "error");
    }
  };

  const runSweep = async () => {
    if (sweeping) return;
    setSweeping(true);
    try {
      const res = await api.runSweep();
      if (res.duplicate) pushToast("Transcript already processed — no duplicate written.", "info");
      else pushToast("New call processed — call logged, follow-up drafted, tasks created.", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Sweep failed", "error");
    } finally {
      setSweeping(false);
    }
  };

  const submitInput = async () => {
    if (!inputCall) return;
    try {
      await api.resolveCall(inputCall.id, info);
      pushToast("Input recorded — call marked as processed.");
      setInputCall(null);
      setInfo("");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not save input", "error");
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <div>
          <h1>Activity Feed</h1>
          <p>
            You&apos;ve saved roughly <b className="mint">{stats.timeSaved}</b> today through automated call logging and drafting.
          </p>
        </div>
        <div className="stats">
          <div>
            <span>CALLS LOGGED</span>
            <strong>{stats.callsLogged}</strong>
          </div>
          <div>
            <span>DRAFTS SENT</span>
            <strong>{stats.draftsSent}</strong>
          </div>
        </div>
      </section>

      <section className="sweepbar">
        <div>
          <b>Live pipeline demo</b>
          <span>Process the next transcript through the ingestion pipeline — fingerprint, extraction, draft, tasks.</span>
        </div>
        <button className="darkbtn" onClick={runSweep} disabled={sweeping}>
          {sweeping ? "Processing…" : "↻ Simulate incoming call"}
        </button>
      </section>

      <section className="grid">
        <article className="card approvals">
          <div className="topline">
            <h2>Pending approvals</h2>
            <span className="sub">{pending.length} waiting</span>
          </div>
          {pending.length === 0 && <p className="empty">Nothing waiting — you&apos;re all caught up.</p>}
          {pending.map((draft) => {
            const call = calls.find((c) => c.id === draft.callId);
            return (
              <div className="approval" key={draft.id}>
                <div className="approval-head">
                  <div className="source-icon">
                    <span className="material-symbols-outlined">{call?.source === "Phone" ? "phone" : call?.source === "Drive" ? "folder" : "videocam"}</span>
                  </div>
                  <div>
                    <div className="title">{call?.title ?? draft.subject}</div>
                    <div className="sub">
                      {call?.source ?? "Email"} • {call?.date ?? "Just now"}
                    </div>
                  </div>
                  <span className="chip draft">Draft Ready</span>
                </div>
                <p className="message">&quot;{draft.body.slice(0, 220)}{draft.body.length > 220 ? "…" : ""}&quot;</p>
                <div className="buttonrow">
                  <Link href={`/calls/${call?.id ?? draft.callId}`}>
                    <button>Edit</button>
                  </Link>
                  <button className="primary" onClick={() => approve(draft)}>
                    ▷ Approve & Send
                  </button>
                </div>
                <button className="textbtn reject" onClick={() => reject(draft)}>
                  Reject draft instead
                </button>
              </div>
            );
          })}
        </article>

        <article className="card">
          <div className="topline">
            <h2>Input needed</h2>
            <span className="sub">{inputNeeded.length} flagged</span>
          </div>
          {inputNeeded.length === 0 && <p className="empty">No calls need attention.</p>}
          {inputNeeded.map((call) => (
            <div className="approval" key={call.id}>
              <div className="approval-head">
                <div className="source-icon" style={{ color: "#10b981", background: "#effcf6" }}>
                  <span className="material-symbols-outlined">phone</span>
                </div>
                <div>
                  <div className="title">{call.title}</div>
                  <div className="sub">
                    {call.source} • {call.date}
                  </div>
                </div>
                <span className="chip input">Input Needed</span>
              </div>
              <p className="message" style={{ background: "#fff5f5", borderColor: "#fecaca" }}>
                <b style={{ color: "#dc2626" }}>Missing Info:</b> Confirmed implementation date not found in transcript.
              </p>
              <div className="buttonrow">
                <button className="primary" onClick={() => setInputCall(call)}>
                  Provide Input
                </button>
              </div>
            </div>
          ))}
        </article>

        <article className="card">
          <h2>Integrations</h2>
          {connected.slice(0, 3).map((x) => (
            <div className="integration" key={x.provider}>
              <div className="source-icon">
                <span className="material-symbols-outlined">{x.provider === "Zoom" ? "videocam" : x.provider === "Gmail" ? "mail" : "calendar_month"}</span>
              </div>
              <span className="title" style={{ fontSize: 18 }}>
                {x.provider}
              </span>
              <span className="chip live">● Connected</span>
            </div>
          ))}
          <Link href="/settings" className="integration" style={{ border: "1px dashed #dbe4ee", borderRadius: 12, marginTop: 18, textDecoration: "none" }}>
            <div className="source-icon">＋</div>
            <span className="sub">Manage integrations</span>
          </Link>
        </article>

        <article className="recent">
          <div className="topline">
            <h2>Recent activity</h2>
            <button className="textbtn" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show less" : "View All"}
            </button>
          </div>
          {visibleEvents.length === 0 && <p className="empty">No activity yet.</p>}
          {visibleEvents.map((e) => {
            const chip = kindChip(e.kind);
            return (
              <div className="row" key={e.id}>
                <div className="source-icon">
                  <span className="material-symbols-outlined">{ICONS[e.type] ?? "event"}</span>
                </div>
                <div>
                  <div className="title">{e.title}</div>
                  <div className="sub">
                    {e.detail} · {timeAgo(e.createdAt)}
                  </div>
                </div>
                <span className="spacer" />
                <span className={`chip ${chip.cls}`}>● {chip.text}</span>
              </div>
            );
          })}
        </article>
      </section>

      {inputCall && (
        <Modal title="Provide missing input" onClose={() => setInputCall(null)}>
          <p className="modal-copy">
            The transcript for <b>{inputCall.title}</b> didn&apos;t state the confirmed implementation date. Add it below so the deal can move forward.
          </p>
          <textarea className="input" rows={4} value={info} onChange={(e) => setInfo(e.target.value)} placeholder="e.g. Confirmed implementation date: December 1st, pilot across two warehouses." />
          <div className="modal-actions">
            <button className="ghostbtn" onClick={() => setInputCall(null)}>
              Cancel
            </button>
            <button className="darkbtn" onClick={submitInput} disabled={!info.trim()}>
              Save & mark processed
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
