import { NextResponse } from "next/server";
import { fingerprint, isReadable, extractTranscript, type Transcript } from "@/worker/src/pipeline";
import { cannedTranscripts } from "@/lib/demo-data";
import {
  createCall,
  createDraft,
  createTask,
  hasFingerprint,
  logEvent,
  nextCannedIndex,
  recordCallLogged,
  rememberFingerprint,
  setCallDraft,
} from "@/lib/store";
import type { CannedTranscript } from "@/lib/types";

export const dynamic = "force-dynamic";

function transcriptFor(canned: CannedTranscript, occurredAt: Date): Transcript {
  return {
    workspaceId: "demo",
    source: canned.source === "Gmail" ? "gmail" : "drive",
    body: canned.body,
    attendees: canned.attendees,
    occurredAt,
    url: `#transcript-${canned.id}`,
  };
}

function fmtDate(d: Date): string {
  return `${d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} PST`;
}

function pickNext(): { canned: CannedTranscript; occurredAt: Date } {
  const len = cannedTranscripts.length;
  const start = nextCannedIndex();
  // Prefer an unused canned transcript so the demo shows variety before it wraps.
  for (let offset = 0; offset < len; offset += 1) {
    const canned = cannedTranscripts[(start + offset) % len];
    const occurredAt = new Date(Date.UTC(2026, 7, 10, 9, 0, offset)); // stable per slot → stable fingerprint
    if (!hasFingerprint(fingerprint(transcriptFor(canned, occurredAt)))) {
      return { canned, occurredAt };
    }
  }
  // Pool exhausted: synthesize a unique variant so the demo keeps running.
  const base = cannedTranscripts[0];
  const n = start + 1;
  const canned: CannedTranscript = {
    ...base,
    id: `canned_generic_${n}`,
    title: `GlobalNet Weekly Sync #${n}`,
    attendees: [`grace.ng@globalnet.com`, `rep@gravity.example`],
    body: `${base.body}\n\n(Weekly sync #${n})`,
    extraction: {
      ...base.extraction,
      summary: `${base.extraction.summary} This is weekly sync #${n}.`,
      draft: { ...base.extraction.draft, subject: `GlobalNet sync #${n} — next steps` },
    },
  };
  return { canned, occurredAt: new Date(Date.UTC(2026, 7, 10, 9, 0, 0)) };
}

export async function POST() {
  try {
    const { canned, occurredAt } = pickNext();
    const transcript = transcriptFor(canned, occurredAt);
    const fp = fingerprint(transcript);

    if (hasFingerprint(fp)) {
      return NextResponse.json({ duplicate: true, fingerprint: fp });
    }

    if (!isReadable(transcript.body)) {
      return NextResponse.json({ error: "Transcript is not readable (too short)" }, { status: 422 });
    }

    // Extraction: use the real OpenAI pipeline when a key is configured, else the grounded canned result.
    let extraction = canned.extraction;
    if (process.env.OPENAI_API_KEY) {
      try {
        const ai = await extractTranscript(transcript);
        extraction = {
          summary: ai.summary,
          objections: ai.objections,
          commitments: ai.commitments,
          tasks: ai.nextSteps.map((s) => ({
            title: s.description,
            due: s.dueDate ? `Due ${new Date(s.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Due Today",
            owner: s.owner === "client" ? ("Client" as const) : ("Rep" as const),
          })),
          draft: { to: ai.followup.to, subject: ai.followup.subject, body: ai.followup.body },
        };
      } catch (error) {
        console.error("OpenAI extraction failed, falling back to grounded demo extraction:", error);
      }
    }

    const slug = fp.slice(0, 8);
    const call = createCall({
      id: `call_${slug}`,
      title: canned.title,
      date: fmtDate(new Date()),
      duration: canned.duration,
      source: canned.source,
      summary: extraction.summary,
      objections: extraction.objections,
      commitments: extraction.commitments,
      dealId: canned.dealId,
      draftId: null,
    });

    const draft = createDraft({
      id: `draft_${slug}`,
      callId: call.id,
      to: extraction.draft.to,
      subject: extraction.draft.subject,
      body: extraction.draft.body,
    });
    setCallDraft(call.id, draft.id);

    for (const task of extraction.tasks) {
      createTask({ title: task.title, source: canned.title, due: task.due, owner: task.owner });
    }

    rememberFingerprint(fp);
    recordCallLogged();
    logEvent("call_logged", call.title, `${canned.source} · just now`, "live");
    logEvent("draft_ready", `Follow-up drafted for ${call.title}`, "Gmail Drafts · just now", "draft");

    return NextResponse.json({ duplicate: false, call, draft, fingerprint: fp });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Sweep failed";
    console.error("Demo sweep failed:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
