"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Modal } from "@/components/modal";
import { api, pushToast, useLive } from "@/lib/live";
import { callTranscripts } from "@/lib/demo-data";
import type { Draft } from "@/lib/types";

function statusChip(status: Draft["status"]): { text: string; cls: string } {
  switch (status) {
    case "sent":
      return { text: "Sent", cls: "live" };
    case "rejected":
      return { text: "Rejected", cls: "input" };
    case "awaiting_approval":
      return { text: "Awaiting approval", cls: "draft" };
    default:
      return { text: "Draft", cls: "draft" };
  }
}

export default function CallPage() {
  const { callId } = useParams<{ callId: string }>();
  const live = useLive();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [inputModal, setInputModal] = useState(false);
  const [info, setInfo] = useState("");

  const call = live?.calls.find((c) => c.id === callId);
  const draft = call?.draftId ? live?.drafts.find((d) => d.id === call.draftId) : undefined;
  const deal = live?.deals.find((d) => d.id === call?.dealId);

  useEffect(() => {
    if (draft) setBody(draft.body);
  }, [draft?.id, draft?.body]);

  if (!live) {
    return (
      <AppShell>
        <main className="page">
          <div className="skeleton call-title" style={{ height: 48, width: "60%" }} />
          <div className="skeleton card" style={{ height: 420 }} />
        </main>
      </AppShell>
    );
  }

  if (!call) {
    return (
      <AppShell>
        <main className="page">
          <div className="notfound">
            <h1>Call not found</h1>
            <p>The call you&apos;re looking for doesn&apos;t exist or was removed.</p>
            <Link href="/activity">
              <button className="darkbtn">← Back to Activity Feed</button>
            </Link>
          </div>
        </main>
      </AppShell>
    );
  }

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await api.saveDraft(draft.id, { body });
      pushToast("Draft saved — edits are live across the workspace.");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not save draft", "error");
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!draft) return;
    try {
      await api.approveDraft(draft.id);
      pushToast(`Follow-up sent to ${draft.to}.`);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not send draft", "error");
    }
  };

  const reject = async () => {
    if (!draft) return;
    try {
      await api.rejectDraft(draft.id);
      pushToast("Draft rejected — the Gmail copy is preserved.", "info");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not reject draft", "error");
    }
  };

  const submitInput = async () => {
    try {
      await api.resolveCall(call.id, info);
      pushToast("Input recorded — call marked as processed.");
      setInputModal(false);
      setInfo("");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not save input", "error");
    }
  };

  const chip = draft ? statusChip(draft.status) : null;
  const sent = draft?.status === "sent";
  const transcript = callTranscripts[call.id];

  return (
    <AppShell>
      <main className="page">
        <Link href="/activity" className="backlink">
          ← Back to Call Feed
        </Link>
        <div className="topline" style={{ margin: "38px 0 50px" }}>
          <div>
            <h1 className="call-title">{call.title}</h1>
            <div className="meta">
              ▣ {call.date}　◷ {call.duration}　<span className={`chip ${call.status === "input_needed" ? "input" : "live"}`}>◉ {call.status === "input_needed" ? "Input Needed" : "Processed"}</span>
            </div>
          </div>
          <button className="outlinebtn" onClick={() => setShowTranscript((v) => !v)}>
            {showTranscript ? "Hide transcript" : "↗ View Full Transcript"}
          </button>
        </div>

        {showTranscript && (
          <article className="card transcript">
            <div className="topline">
              <h2>Transcript</h2>
              <span className="sub">{call.transcriptUrl}</span>
            </div>
            {transcript ? (
              <pre className="transcript-body">{transcript}</pre>
            ) : (
              <p className="empty">
                In production this transcript lives in Gmail/Drive and links back via <code>{call.transcriptUrl}</code>. In the demo, the extracted summary below is the source of truth.
              </p>
            )}
          </article>
        )}

        <div className="call-layout">
          <article className="card">
            <section className="section">
              <h2>▧　 Executive Summary</h2>
              <p className="summary">{call.summary}</p>
              {deal && (
                <div className="info-grid">
                  {[
                    ["Budget", deal.budget],
                    ["Timeline", deal.timeline],
                    ["Decision Maker", deal.decisionMaker],
                    ["Competitors", deal.competitors],
                  ].map(([key, value]) => (
                    <div className="info" key={key}>
                      <label>{key}</label>
                      <span style={{ fontFamily: "DM Mono" }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="section">
              <h2>⚠　 Objections Raised</h2>
              {call.objections.length === 0 && <p className="empty">No objections raised.</p>}
              {call.objections.map((x) => (
                <div className="listitem warn" key={x}>
                  ⓘ　{x}
                </div>
              ))}
            </section>
            <section className="section">
              <h2>✓　 Commitments Made</h2>
              {call.commitments.length === 0 && <p className="empty">No commitments made.</p>}
              {call.commitments.map((x) => (
                <div className="listitem good" key={x}>
                  ◉　{x}
                </div>
              ))}
            </section>
            {!draft && call.status === "input_needed" && (
              <section className="section">
                <h2>✎　 Missing Input</h2>
                <div className="listitem warn">Confirmed implementation date not found in transcript.</div>
                <button className="darkbtn" onClick={() => setInputModal(true)}>
                  Provide Input
                </button>
              </section>
            )}
          </article>

          <aside className="card draft-card">
            <div className="draft-header">
              <div className="source-icon">
                <span className="material-symbols-outlined">mail</span>
              </div>
              <h2>Follow-up Workspace</h2>
              {chip && <span className={`chip ${chip.cls}`}>{chip.text}</span>}
            </div>
            {draft ? (
              <>
                <div className="draft-content">
                  <div className="fields">
                    <div className="field">
                      <label>To:</label>
                      <span>{draft.to}</span>
                    </div>
                    <div className="field">
                      <label>Subject:</label>
                      <span>{draft.subject}</span>
                    </div>
                  </div>
                  <textarea className="draft-area" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Follow-up email draft" readOnly={sent} />
                </div>
                <div className="draft-actions">
                  <button onClick={save} disabled={saving || sent}>
                    {saving ? "Saving…" : "Save Draft"}
                  </button>
                  {!sent ? (
                    <>
                      <button onClick={reject}>Reject</button>
                      <button className="send" onClick={approve}>
                        ▷ Approve & Send
                      </button>
                    </>
                  ) : (
                    <button className="send" disabled>
                      ✓ Sent
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="draft-content">
                <p className="empty">
                  No follow-up draft yet — this call needs input before a draft can be generated.
                </p>
                <button className="darkbtn" onClick={() => setInputModal(true)}>
                  Provide Input
                </button>
              </div>
            )}
          </aside>
        </div>
      </main>

      {inputModal && (
        <Modal title="Provide missing input" onClose={() => setInputModal(false)}>
          <p className="modal-copy">
            The transcript for <b>{call.title}</b> didn&apos;t state the confirmed implementation date. Add it below.
          </p>
          <textarea className="input" rows={4} value={info} onChange={(e) => setInfo(e.target.value)} placeholder="e.g. Confirmed implementation date: December 1st, pilot across two warehouses." />
          <div className="modal-actions">
            <button className="ghostbtn" onClick={() => setInputModal(false)}>
              Cancel
            </button>
            <button className="darkbtn" onClick={submitInput} disabled={!info.trim()}>
              Save & mark processed
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
