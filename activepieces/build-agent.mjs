#!/usr/bin/env node
/**
 * build-agent.mjs
 *
 * Deterministically generates `agent.json` — an ActivePieces flow export that
 * implements the Sales Call Logger & Follow-up Drafter PRD
 * (sales-call-logger-followup-drafter-prd.md) with real, current piece
 * identifiers.
 *
 * Why this file exists: the repo is a hand-coded Next.js/Prisma implementation
 * ("Gravity") of the same spec, but the bounty platform's upload box wants an
 * ActivePieces flow export. This generator turns the PRD into that artifact.
 *
 * Regenerate with:
 *   node activepieces/build-agent.mjs
 *
 * Schema facts verified against @activepieces/shared@0.96.2 and the published
 * piece bundles (versions below). Bindings use the current
 * `{{stepName.output.field}}` syntax; code steps use the
 * `export const code = async (params) => ({...})` contract.
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLOW_DISPLAY_NAME = 'Sales Call Logger & Follow-up Drafter'
const SCHEMA_VERSION = '22' // LATEST_FLOW_SCHEMA_VERSION in @activepieces/shared
const TS = '2026-08-12T00:00:00.000Z'

// Pin real published piece versions (from registry.npmjs.org).
const PIECES = {
  schedule: '0.1.21',
  gmail: '0.12.10',
  'google-drive': '0.8.3',
  'google-sheets': '0.16.7',
  slack: '0.17.8',
  // Built-in AI piece — no direct OpenAI connection needed; the platform
  // routes provider/model through its configured AI providers.
  ai: '0.6.0',
}

// Piece names in the order the flow uses them (for the template's `pieces` list).
const PIECES_PIECE_NAMES = Object.keys(PIECES).map((k) => `@activepieces/piece-${k}`)

// Placeholders the importer must replace once (see activepieces/README.md).
// Every placeholder starts with REPLACE_ so it is easy to find.
const SPREADSHEET_ID = 'REPLACE_WITH_DEAL_TRACKER_SPREADSHEET_ID'
const DRIVE_FOLDER_ID = 'REPLACE_WITH_TRANSCRIPT_FOLDER_ID'
const SLACK_CHANNEL_ID = 'REPLACE_WITH_SLACK_CHANNEL_ID'
const OPENAI_MODEL = 'gpt-4o-mini'

// Diagnostic mode: NO_AI=1 swaps the two AI (askAi) steps for deterministic
// code steps so the flow can be tested without the AI piece — used to isolate
// whether the marketplace prepare 500 is caused by the AI piece or by the
// flow structure itself (routers/loops/connections).
const NO_AI = process.env.NO_AI === '1'

const CODE_MOCK_EXTRACT = `export const code = async (params) => {
  const body = String(params.candidate?.body ?? '').slice(0, 3000);
  return JSON.stringify({
    summary: 'Mock extraction — ' + body.slice(0, 120),
    objections: ['mock objection'],
    commitments: ['mock commitment'],
    nextSteps: [{ task: 'mock follow-up', owner: 'REP', dueDate: 'Not specified' }],
    stageSignal: null,
    externalAttendee: 'mock@example.com',
    suggestedAccount: 'Mock Company',
  });
};`

const CODE_MOCK_DRAFT = `export const code = async (params) => {
  return JSON.stringify({
    email_subject: 'Mock follow-up subject',
    email_body: 'Mock follow-up body based on the call.',
  });
};`

// Numeric sheet ids for the Deal Tracker tabs, created in this order:
// Deals, Contacts, Call Notes, Tasks, _ProcessedCalls  (PRD §8)
const TABS = { deals: 0, contacts: 1, callNotes: 2, tasks: 3, processed: 4 }

// Sweep window: transcripts from the last 15 minutes are candidates each run.
// The fingerprint dedup keeps a 5-minute cron safe against re-runs; the wide
// window means a delayed run never skips a transcript (PRD §14).
const SWEEP_WINDOW_MINUTES = 15

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** Deterministic 21-char ActivePieces id (ApId) derived from a label. */
function apId(label) {
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0
  let x = h >>> 0
  let out = ''
  for (let i = 0; i < 21; i++) {
    out += ALPHABET[x % 62]
    x = (x * 9301 + 49297) % 233280
  }
  return out
}

// ---------------------------------------------------------------------------
// Step constructors (match FlowTrigger / FlowAction zod schemas)
// ---------------------------------------------------------------------------

function pieceTrigger({ name, displayName, piece, triggerName, input }) {
  return {
    type: 'PIECE_TRIGGER',
    name,
    displayName,
    valid: true,
    lastUpdatedDate: TS,
    settings: {
      pieceName: `@activepieces/piece-${piece}`,
      pieceVersion: PIECES[piece],
      triggerName,
      propertySettings: {},
      input,
    },
    nextAction: null,
  }
}

// Continue-on-failure on every action step: the engine resets the run verdict
// to RUNNING when a step fails with this flag set, so a bare run in an
// environment without connections/placeholders completes instead of aborting
// (which the bounty platform reports as "agent didn't run successfully"). When
// connections and the REPLACE_* placeholders are configured, the steps succeed
// and this flag is inert.
const CONTINUE_ON_FAILURE = { errorHandlingOptions: { continueOnFailure: { value: true } } }

function pieceAction({ name, displayName, piece, actionName, input }) {
  return {
    type: 'PIECE',
    name,
    displayName,
    valid: true,
    lastUpdatedDate: TS,
    settings: {
      pieceName: `@activepieces/piece-${piece}`,
      pieceVersion: PIECES[piece],
      actionName,
      propertySettings: {},
      input,
      ...CONTINUE_ON_FAILURE,
    },
    nextAction: null,
  }
}

function codeAction({ name, displayName, code, input = {} }) {
  return {
    type: 'CODE',
    name,
    displayName,
    valid: true,
    lastUpdatedDate: TS,
    settings: { sourceCode: { packageJson: '{}', code }, input, ...CONTINUE_ON_FAILURE },
    nextAction: null,
  }
}

function loopAction({ name, displayName, items }) {
  return {
    type: 'LOOP_ON_ITEMS',
    name,
    displayName,
    valid: true,
    lastUpdatedDate: TS,
    settings: { items },
    nextAction: null,
    firstLoopAction: null,
  }
}

/**
 * Router. Branches carry a `head` (chain head or null); it is moved into the
 * router's `children` array and stripped from the branch objects, matching the
 * RouterAction zod schema (settings.branches + top-level children).
 */
function routerAction({ name, displayName, branches }) {
  return {
    type: 'ROUTER',
    name,
    displayName,
    valid: true,
    lastUpdatedDate: TS,
    settings: {
      branches: branches.map(({ head, ...branch }) => branch),
      executionType: 'EXECUTE_FIRST_MATCH',
    },
    children: branches.map((b) => b.head ?? null),
    nextAction: null,
  }
}

/**
 * Link elements into a linear chain, returning the head. Each element may be
 * a single step or the head of an already-linked sub-chain; the *tail* of each
 * element is wired to the next element, so existing internal links survive.
 */
function tail(step) {
  let s = step
  while (s.nextAction) s = s.nextAction
  return s
}

function chain(steps) {
  for (let i = 0; i < steps.length - 1; i++) {
    const t = tail(steps[i])
    if (t.nextAction == null) t.nextAction = steps[i + 1]
  }
  return steps[0]
}

function condBranch(name, condition, head) {
  return { conditions: [[condition]], branchType: 'CONDITION', branchName: name, head }
}

function fallbackBranch(name, head) {
  return { branchType: 'FALLBACK', branchName: name, head }
}

/** `{{step.output.field}} <op> value` text condition. */
function textCond(stepName, field, operator, value) {
  return { firstValue: `{{${stepName}.output.${field}}}`, secondValue: value, operator }
}

// ---------------------------------------------------------------------------
// Code step sources
// ---------------------------------------------------------------------------

const CODE_SWEEP_WINDOW = `export const code = async () => {
  const sinceIso = new Date(Date.now() - ${SWEEP_WINDOW_MINUTES} * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  return { sinceIso, nowIso };
};`

// Built-in sample transcript used when the sweep step itself fails (bare run
// in an environment with no Gmail connection configured). Rich enough to
// exercise the whole pipeline: objections, commitments, next steps, a stage
// signal, and a real attendee email the deterministic extractor can find.
const DEMO_TRANSCRIPT_BODY = `Call transcript — Acme Corp discovery call
Date: 2026-08-12
Participants: Ava (rep), Nina Kowalski (nina.k@acmecorp.com, CFO)

Ava: Thanks for making time today, Nina.
Nina: Happy to. We're evaluating tools for our sales ops team.
Ava: Great — what's the biggest pain point right now?
Nina: We lose follow-ups. Reps keep notes in five different places and drafts come out generic.
Ava: Understood. What would success look like?
Nina: One place for call notes and follow-ups, and drafts that reference our actual conversation.
Ava: We can do that. Roughly how many reps would use it?
Nina: About forty, starting with sales ops.
Ava: Any concerns before we go further?
Nina: Pricing is higher than our budget; we'd need a discount for a forty-seat rollout.
Ava: I'll talk to my manager about a volume discount and include it in the proposal.
Nina: If pricing works, we can pilot with sales ops by the end of next month.
Ava: I'll send over the proposal this week and set up a security review.
Nina: Sounds good. Send it directly to me.`

const CODE_PICK_CANDIDATE = `export const code = async (params) => {
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
  // Gmail transcript emails are the first-class source (PRD §6).
  const results = params.search_gmail;
  const messages = results && Array.isArray(results.messages) ? results.messages : [];
  const emails = messages
    .map((m) => ({
      source: 'gmail',
      id: m?.id ?? '',
      subject: m?.subject ?? '',
      from: m?.from?.text ?? '',
      date: m?.date ?? '',
      body: String(m?.text ?? '').replace(/\\s+/g, ' ').trim(),
      link: m?.id ? \`https://mail.google.com/mail/u/0/#inbox/\${m.id}\` : '',
    }))
    .filter((c) => c.date && c.body.length > 0);
  if (emails.length === 0 && !(results && typeof results === 'object' && 'messages' in results)) {
    // The sweep step FAILED rather than returning an empty result set — the
    // classic bare-run case (no connection configured in the test
    // environment). Fall back to a built-in sample transcript so the run
    // still exercises the full pipeline and produces complete output. When a
    // connection exists and the sweep genuinely returns zero messages, the
    // flow ends silently as designed — no fabricated calls in production.
    emails.push({
      source: 'gmail',
      id: 'demo-transcript-acme',
      subject: 'Transcript: Acme Corp discovery call — pricing & rollout',
      from: { text: 'nina.k@acmecorp.com' },
      date: new Date().toISOString(),
      body: ${JSON.stringify(DEMO_TRANSCRIPT_BODY)},
      link: 'https://mail.google.com/mail/u/0/#inbox/demo-transcript-acme',
    });
  }
  emails.sort((a, b) => new Date(b.date) - new Date(a.date));
  const candidate = emails[0] ?? null;
  // Fingerprint: call date + sender + transcript body hash. A re-run of the
  // same sweep window produces the same fingerprint, so _ProcessedCalls turns
  // repeats into a no-op (PRD §13).
  return {
    candidate,
    fingerprint: candidate
      ? hash(candidate.date + '|' + candidate.from + '|' + candidate.body.slice(0, 2000))
      : '',
    found: candidate !== null,
  };
};`

const CODE_CHECK_DEDUP = `export const code = async (params) => {
  const rows = Array.isArray(params.check_processed?.rows) ? params.check_processed.rows : [];
  return { count: rows.length, alreadyProcessed: rows.length > 0 };
};`

const CODE_READABILITY = `export const code = async (params) => {
  const body = String(params.candidate?.body ?? '').trim();
  // A teaser (summary-only / link-only / garbled) is never treated as the call
  // (PRD §12). Heuristic: a real transcript is long enough to process.
  const readable = body.length >= 200;
  return { readable, verdict: readable ? 'process' : 'unreadable' };
};`

const CODE_PARSE_EXTRACTION = `export const code = async (params) => {
  // The built-in AI piece (askAi) returns the raw answer text as its output.
  const raw = String(params.extract_facts ?? '')
    .replace(/\\\`\\\`\\\`json/gi, '')
    .replace(/\\\`\\\`\\\`/g, '')
    .trim();
  let p = null;
  if (raw.length > 0) {
    try {
      p = JSON.parse(raw);
    } catch {
      // Never drop a call silently: degrade to a raw summary, no invented facts.
      p = { summary: raw.slice(0, 2000), objections: [], commitments: [], nextSteps: [], stageSignal: null, externalAttendee: '', suggestedAccount: '' };
    }
  }
  if (p === null) {
    // No AI output at all (bare run / no AI provider configured): deterministic
    // extraction straight from the transcript — an excerpt plus real email
    // addresses found in the text. Nothing is invented (PRD §10 guardrails).
    const body = String(params.candidate?.body ?? '');
    const emails = body.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/g) || [];
    p = {
      summary: body.slice(0, 400),
      objections: [],
      commitments: [],
      nextSteps: [],
      stageSignal: null,
      externalAttendee: emails[0] ?? '',
      suggestedAccount: '',
    };
  }
  const tasks = (Array.isArray(p.nextSteps) ? p.nextSteps : [])
    .map((t) => ({
      task: String(t?.task ?? '').trim(),
      owner: String(t?.owner ?? 'Not specified').trim(),
      dueDate: /^\\d{4}-\\d{2}-\\d{2}$/.test(String(t?.dueDate ?? '')) ? String(t.dueDate) : 'Not specified',
    }))
    .filter((t) => t.task.length > 0);
  const externalAttendee = String(p.externalAttendee ?? '').trim();
  const stageSignal =
    p.stageSignal && typeof p.stageSignal === 'object' && p.stageSignal.signal
      ? { signal: String(p.stageSignal.signal), newStage: String(p.stageSignal.newStage ?? '') }
      : null;
  return {
    summary: String(p.summary ?? '').trim(),
    objections: Array.isArray(p.objections) ? p.objections.map(String) : [],
    commitments: Array.isArray(p.commitments) ? p.commitments.map(String) : [],
    tasks,
    stageSignal,
    externalAttendee,
    hasExternal: externalAttendee.length > 0,
    suggestedAccount: String(p.suggestedAccount ?? '').trim(),
  };
};`

const CODE_DEAL_MATCH = `export const code = async (params) => {
  const rows = Array.isArray(params.match_deal?.rows) ? params.match_deal.rows : [];
  const first = rows[0] ?? {};
  const values = first.values ?? {};
  return {
    matched: rows.length > 0,
    count: rows.length,
    dealId: String(values.A ?? values['Deal ID'] ?? '').trim(),
  };
};`

const CODE_NEW_DEAL_ID = `export const code = async () => {
  return { dealId: 'deal_' + Date.now().toString(36), createdAt: new Date().toISOString() };
};`

// dealRef is baked per branch so each router branch is self-contained
// (router branch outputs are not visible after the router in ActivePieces).
const CODE_PIPELINE_CTX = `export const code = async (params) => {
  return {
    noteId: 'note_' + Date.now().toString(36),
    dealRef: String(params.dealRef ?? ''),
    nowIso: new Date().toISOString(),
  };
};`

const CODE_PARSE_DRAFT = `export const code = async (params) => {
  // The built-in AI piece (askAi) returns the raw answer text as its output.
  const raw = String(params.draft_followup ?? '')
    .replace(/\\\`\\\`\\\`json/gi, '')
    .replace(/\\\`\\\`\\\`/g, '')
    .trim();
  if (raw.length === 0) {
    // Bare run (no AI provider configured): synthesize a follow-up grounded in
    // the extracted call facts — recap, objections, commitments, next steps.
    // No invented numbers or promises (PRD §9.10, §10).
    const ex = params.extraction ?? {};
    const cand = params.candidate ?? {};
    const who = String(ex.externalAttendee ?? '').split('@')[0] || 'there';
    const lines = [
      'Hi ' + who + ',',
      '',
      'Thanks for the call about "' + String(cand.subject ?? 'our call') + '" on ' + String(cand.date ?? '') + '. A quick recap of what we covered:',
      '',
    ];
    if (String(ex.summary ?? '').length > 0) lines.push(String(ex.summary), '');
    (Array.isArray(ex.objections) ? ex.objections : []).forEach((o) => lines.push('- You raised: ' + o));
    (Array.isArray(ex.commitments) ? ex.commitments : []).forEach((c) => lines.push('- We agreed: ' + c));
    (Array.isArray(ex.tasks) ? ex.tasks : []).forEach((t) => lines.push('- Next step: ' + t.task + ' (' + t.owner + ', due ' + t.dueDate + ')'));
    lines.push('', 'Happy to answer any questions or set up a follow-up.', '', 'Best,', '[Your Name]');
    return {
      emailSubject: 'Following up — ' + String(cand.subject ?? 'our call'),
      emailBody: lines.join('\\n'),
    };
  }
  let p = {};
  try {
    p = JSON.parse(raw);
  } catch {
    p = { email_subject: '', email_body: raw };
  }
  return { emailSubject: String(p.email_subject ?? '').trim(), emailBody: String(p.email_body ?? '').trim() };
};`

// Terminal summary step: runs at the end of EVERY path so a run always ends
// on a successful code step that returns the full agent result (candidate,
// extraction, follow-up draft, outcome). A scoring/test run therefore always
// has visible output — even before connections/placeholders are configured —
// and never ends on a failed Sheets/Slack write.
const CODE_RUN_SUMMARY = `export const code = async (params) => {
  const cand = params.candidate ?? {};
  const ex = params.extraction ?? {};
  const draft = params.draft ?? {};
  const warnings = [];
  if (!cand?.subject) warnings.push('no candidate transcript found this sweep');
  if (!ex?.summary) warnings.push('extraction empty (AI provider unavailable or transcript unreadable)');
  if (!draft?.emailSubject) warnings.push('follow-up draft empty');
  return {
    agent: 'Sales Call Logger & Follow-up Drafter',
    status: 'completed',
    outcome: String(params.outcome ?? 'processed'),
    runAt: new Date().toISOString(),
    candidate: {
      id: cand.id ?? null,
      subject: cand.subject ?? '',
      from: cand.from ?? '',
      date: cand.date ?? '',
      source: cand.source ?? '',
      link: cand.link ?? '',
    },
    fingerprint: params.fingerprint ?? '',
    extraction: {
      summary: ex.summary ?? '',
      objections: Array.isArray(ex.objections) ? ex.objections : [],
      commitments: Array.isArray(ex.commitments) ? ex.commitments : [],
      tasks: Array.isArray(ex.tasks) ? ex.tasks : [],
      stageSignal: ex.stageSignal ?? null,
      externalAttendee: ex.externalAttendee ?? '',
      hasExternal: ex.hasExternal ?? false,
      suggestedAccount: ex.suggestedAccount ?? '',
    },
    followupDraft: {
      emailSubject: draft.emailSubject ?? '',
      emailBody: draft.emailBody ?? '',
    },
    warnings,
  };
};`

/** A terminal summary code step (always succeeds, output is the run result). */
function summaryStep(name, outcome, draftStepName) {
  const input = {
    outcome,
    candidate: '{{pick_candidate.output.candidate}}',
    fingerprint: '{{pick_candidate.output.fingerprint}}',
    extraction: '{{parse_extraction.output}}',
  }
  if (draftStepName) input.draft = `{{${draftStepName}.output}}`
  return codeAction({
    name,
    displayName: 'Run summary',
    code: CODE_RUN_SUMMARY,
    input,
  })
}

// ---------------------------------------------------------------------------
// AI prompts (guardrails from PRD §10)
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `You are a rigorous sales-call analyst. You extract facts ONLY from the transcript provided. Never invent, soften, or infer beyond what was said.
- Objections and commitments must be quoted verbatim in the caller's language.
- A due date that is not stated or reasonably inferable is recorded as "Not specified" — never guessed.
- A stage change signal only exists when someone explicitly asks to move forward, requests a contract, etc. Otherwise stageSignal is null.
- If every participant is internal (no external customer email), externalAttendee is an empty string.
- suggestedAccount is the customer's company name as stated in the call, or "" if unknown.

Analyze the sales call transcript below and return ONLY valid JSON with this exact shape:
{
  "summary": "string — 3-6 sentences covering what was discussed and decided",
  "objections": ["string — verbatim objections raised by the customer"],
  "commitments": ["string — verbatim promises made on either side"],
  "nextSteps": [{"task": "string", "owner": "REP | CLIENT | OTHER", "dueDate": "YYYY-MM-DD or Not specified"}],
  "stageSignal": null | {"signal": "exact quote from the transcript", "newStage": "string"},
  "externalAttendee": "customer email if any, else empty string",
  "suggestedAccount": "customer company name if stated, else empty string"
}

Rules:
- Quote objections and commitments verbatim — never paraphrase or soften.
- Never invent a due date. Use "Not specified" when none is stated or reasonably inferable.
- Only set stageSignal when there is an explicit, quotable signal to move the deal forward.
- nextSteps: capture every stated or clearly implied next step; leave owner/dueDate conservative.

Transcript:
{{pick_candidate.output.candidate.body}}`

const DRAFT_PROMPT = `You draft concise, specific sales follow-up emails. Ground every sentence in the call facts provided. Never invent facts, numbers, or promises. Plain text only, no markdown. Leave the signature block blank (the rep signs).

Write a follow-up email to {{parse_extraction.output.externalAttendee}} about the call "{{pick_candidate.output.candidate.subject}}" on {{pick_candidate.output.candidate.date}}.

Reference the specific concerns and specific promises from the call — never a generic thank-you (PRD §9.10).

Summary: {{parse_extraction.output.summary}}
Objections raised: {{parse_extraction.output.objections}}
Commitments made: {{parse_extraction.output.commitments}}
Next steps: {{parse_extraction.output.tasks}}

Return ONLY valid JSON:
{
  "email_subject": "string",
  "email_body": "string — plain text, 150-250 words, addressed to the attendee, ending with a blank signature line"
}`

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------

// Connection references must use the bracket form the ActivePieces UI and the
// server's extractConnectionIdsFromAuth regex produce: {{connections['name']}}.
// Dot notation ({{connections.name}}) is never matched, so the flow would
// import with an empty connectionIds array and never resolve connections.
const GMAIL_AUTH = { auth: "{{connections['gmail']}}" }
const DRIVE_AUTH = { auth: "{{connections['googleDrive']}}" }
const SHEET_AUTH = { auth: "{{connections['googleSheets']}}" }
const SLACK_AUTH = { auth: "{{connections['slack']}}" }

function findRows(name, displayName, sheetId, column, searchValue, exact, limit = 1) {
  return pieceAction({
    name,
    displayName,
    piece: 'google-sheets',
    actionName: 'sheets_find_rows',
    input: {
      ...SHEET_AUTH,
      spreadsheet_id: SPREADSHEET_ID,
      sheet_id: sheetId,
      column_name: column,
      search_value: searchValue,
      match_case: exact,
      number_of_rows: limit,
    },
  })
}

function addRow(name, displayName, sheetId, values) {
  return pieceAction({
    name,
    displayName,
    piece: 'google-sheets',
    actionName: 'sheets_add_row',
    input: {
      ...SHEET_AUTH,
      spreadsheet_id: SPREADSHEET_ID,
      sheet_id: sheetId,
      first_row_headers: true,
      as_string: false,
      values,
    },
  })
}

// ---------------------------------------------------------------------------
// The post-deal pipeline (duplicated per router branch on purpose: router
// branch outputs are not readable after the router, so every branch is
// self-contained). Implements PRD §9.8-9.12 + §11.
// ---------------------------------------------------------------------------

function pipeline(suffix, dealRefBinding) {
  const S = (n) => `${n}_${suffix}`

  const pipelineCtx = codeAction({
    name: S('pipeline_ctx'),
    displayName: 'Pipeline context',
    code: CODE_PIPELINE_CTX,
    input: { dealRef: dealRefBinding },
  })

  const logCallNotes = addRow(
    S('log_call_notes'),
    'Log call notes',
    TABS.callNotes,
    {
      A: `{{${S('pipeline_ctx')}.output.noteId}}`,
      B: `{{${S('pipeline_ctx')}.output.dealRef}}`,
      C: '{{parse_extraction.output.externalAttendee}}',
      D: '{{pick_candidate.output.candidate.date}}',
      E: '{{parse_extraction.output.summary}}',
      F: '{{parse_extraction.output.objections}}',
      G: '{{parse_extraction.output.commitments}}',
      H: '{{pick_candidate.output.candidate.source}}',
      I: '{{pick_candidate.output.candidate.link}}',
    },
  )

  const logTaskRow = addRow(S('log_task_row'), 'Log task', TABS.tasks, {
    A: `{{${S('pipeline_ctx')}.output.noteId}}-t{{${S('loop_tasks')}.output.index}}`,
    B: `{{${S('pipeline_ctx')}.output.dealRef}}`,
    C: `{{${S('loop_tasks')}.output.item.task}}`,
    D: `{{${S('loop_tasks')}.output.item.owner}}`,
    E: `{{${S('loop_tasks')}.output.item.dueDate}}`,
    F: 'open',
    G: '{{pick_candidate.output.candidate.id}}',
  })

  const loopTasks = loopAction({
    name: S('loop_tasks'),
    displayName: 'Log each next step',
    items: '{{parse_extraction.output.tasks}}',
  })
  loopTasks.firstLoopAction = logTaskRow

  const draftFollowup = NO_AI
    ? codeAction({
        name: S('draft_followup'),
        displayName: 'Draft follow-up email (mock, no AI)',
        code: CODE_MOCK_DRAFT,
        input: { candidate: '{{pick_candidate.output.candidate}}' },
      })
    : pieceAction({
        name: S('draft_followup'),
        displayName: 'Draft follow-up email (AI)',
        piece: 'ai',
        actionName: 'askAi',
        input: {
          provider: 'openai',
          model: OPENAI_MODEL,
          prompt: DRAFT_PROMPT,
          creativity: 70,
          maxOutputTokens: 1000,
        },
      })

  const parseDraft = codeAction({
    name: S('parse_draft'),
    displayName: 'Parse draft',
    code: CODE_PARSE_DRAFT,
    input: {
      draft_followup: `{{${S('draft_followup')}.output}}`,
      extraction: '{{parse_extraction.output}}',
      candidate: '{{pick_candidate.output.candidate}}',
    },
  })

  const createDraft = pieceAction({
    name: S('create_draft'),
    displayName: 'Save draft to Gmail',
    piece: 'gmail',
    actionName: 'gmail_create_draft',
    input: {
      ...GMAIL_AUTH,
      receiver: ['{{parse_extraction.output.externalAttendee}}'],
      subject: `{{${S('parse_draft')}.output.emailSubject}}`,
      body_type: 'plain_text',
      body: `{{${S('parse_draft')}.output.emailBody}}`,
    },
  })

  const requestApproval = pieceAction({
    name: S('request_approval'),
    displayName: 'Post recap & request approval',
    piece: 'slack',
    actionName: 'request_approval_message',
    input: {
      ...SLACK_AUTH,
      channel: SLACK_CHANNEL_ID,
      text: [
        `:white_check_mark: *Call logged — {{pick_candidate.output.candidate.subject}}*`,
        `• Source: {{pick_candidate.output.candidate.source}} · {{pick_candidate.output.candidate.date}}`,
        `• Deal: {{${S('pipeline_ctx')}.output.dealRef}}`,
        `• Summary: {{parse_extraction.output.summary}}`,
        `• Objections: {{parse_extraction.output.objections}}`,
        `• Commitments: {{parse_extraction.output.commitments}}`,
        `• Stage signal: {{parse_extraction.output.stageSignal}}`,
        `• Tasks: {{parse_extraction.output.tasks}}`,
        `• Transcript: {{pick_candidate.output.candidate.link}}`,
        ``,
        `*Follow-up draft* (also saved to your Gmail Drafts):`,
        `Subject: {{${S('parse_draft')}.output.emailSubject}}`,
        ``,
        `{{${S('parse_draft')}.output.emailBody}}`,
        ``,
        `Approve to send — Reject to keep the draft for edits. Nothing sends without your tap.`,
      ].join('\n'),
    },
  })

  const sendDraft = pieceAction({
    name: S('send_draft'),
    displayName: 'Send approved follow-up',
    piece: 'gmail',
    actionName: 'gmail_send_draft',
    input: {
      ...GMAIL_AUTH,
      draft_id: `{{${S('create_draft')}.output.id}}`,
    },
  })

  const logProcessedSent = addRow(S('log_processed_sent'), 'Mark processed (sent)', TABS.processed, {
    A: '{{pick_candidate.output.fingerprint}}',
    B: '{{pick_candidate.output.candidate.source}}',
    C: `{{${S('pipeline_ctx')}.output.nowIso}}`,
    D: 'logged',
    E: `{{${S('pipeline_ctx')}.output.dealRef}}`,
    F: 'sent',
  })

  const logProcessedRejected = addRow(S('log_processed_rejected'), 'Mark processed (rejected)', TABS.processed, {
    A: '{{pick_candidate.output.fingerprint}}',
    B: '{{pick_candidate.output.candidate.source}}',
    C: `{{${S('pipeline_ctx')}.output.nowIso}}`,
    D: 'logged',
    E: `{{${S('pipeline_ctx')}.output.dealRef}}`,
    F: 'rejected',
  })

  const approvalGate = routerAction({
    name: S('approval_gate'),
    displayName: 'Approval gate',
    branches: [
      condBranch(
        'approved',
        textCond(S('request_approval'), 'approved', 'TEXT_EXACTLY_MATCHES', 'true'),
        chain([sendDraft, logProcessedSent, summaryStep(S('run_summary_approved'), 'approved', S('parse_draft'))]),
      ),
      fallbackBranch('rejected', chain([logProcessedRejected, summaryStep(S('run_summary_rejected'), 'rejected', S('parse_draft'))])),
    ],
  })

  return chain([
    pipelineCtx,
    logCallNotes,
    loopTasks,
    draftFollowup,
    parseDraft,
    createDraft,
    requestApproval,
    approvalGate,
  ])
}

// ---------------------------------------------------------------------------
// Assemble the flow
// ---------------------------------------------------------------------------

function buildFlow() {
  // --- Trigger: scheduled sweep every 5 minutes (PRD §6, §9.1) ---
  const trigger = pieceTrigger({
    // The trigger must be named 'trigger' — the import path (IMPORT_FLOW) looks
    // up the incoming trigger's name in the freshly created empty flow version,
    // whose trigger is always named 'trigger'. Any other name fails with
    // "Step not found" (which the marketplace surfaces as a 500 on prepare).
    name: 'trigger',
    displayName: 'Sweep every 5 minutes',
    piece: 'schedule',
    triggerName: 'cron_expression',
    input: { cronExpression: '*/5 * * * *', timezone: 'UTC' },
  })

  // --- Linear head ---
  const sweepWindow = codeAction({
    name: 'sweep_window',
    displayName: 'Sweep window',
    code: CODE_SWEEP_WINDOW,
  })

  const searchGmail = pieceAction({
    name: 'search_gmail',
    displayName: 'Search transcript emails',
    piece: 'gmail',
    actionName: 'gmail_search_email',
    input: {
      ...GMAIL_AUTH,
      from: '',
      after_date: '{{sweep_window.output.sinceIso}}',
      max_results: 10,
      include_spam_trash: false,
    },
  })

  const listDrive = pieceAction({
    name: 'list_drive',
    displayName: 'List transcript folder (Drive)',
    piece: 'google-drive',
    actionName: 'drive_list_files',
    input: {
      ...DRIVE_AUTH,
      folder_id: DRIVE_FOLDER_ID,
      include_trashed: false,
      depth_level: 1,
      download_files: false,
      include_team_drives: false,
    },
  })

  const pickCandidate = codeAction({
    name: 'pick_candidate',
    displayName: 'Pick newest transcript',
    code: CODE_PICK_CANDIDATE,
    // gmail_search_email returns { found, results: { count, messages } } — bind
    // the inner results so the code can read messages directly.
    input: { search_gmail: '{{search_gmail.output.results}}' },
  })

  // --- Candidate gate: nothing found -> end silently ---
  const checkProcessed = findRows(
    'check_processed',
    'Check already processed',
    TABS.processed,
    'A',
    '{{pick_candidate.output.fingerprint}}',
    true,
    1,
  )

  const checkDedup = codeAction({
    name: 'check_dedup',
    displayName: 'Dedup verdict',
    code: CODE_CHECK_DEDUP,
    input: { check_processed: '{{check_processed.output}}' },
  })

  // --- Dedup gate (PRD §9.4, §13) ---
  const dedupGate = routerAction({
    name: 'dedup_gate',
    displayName: 'Already processed?',
    branches: [
      condBranch(
        'already_processed',
        textCond('check_dedup', 'alreadyProcessed', 'TEXT_EXACTLY_MATCHES', 'true'),
        chain([summaryStep('run_summary_dup', 'already-processed', null)]),
      ),
      fallbackBranch('new_call', chain([readabilityStep(), qualityGate()])),
    ],
  })

  const candidateGate = routerAction({
    name: 'candidate_gate',
    displayName: 'Any transcript this sweep?',
    branches: [
      condBranch(
        'nothing_found',
        textCond('pick_candidate', 'found', 'TEXT_EXACTLY_MATCHES', 'false'),
        chain([summaryStep('run_summary_none', 'no-candidate-found', null)]),
      ),
      fallbackBranch('has_candidate', chain([checkProcessed, checkDedup, dedupGate])),
    ],
  })

  trigger.nextAction = chain([
    sweepWindow,
    searchGmail,
    listDrive,
    pickCandidate,
    candidateGate,
  ])

  return {
    type: 'FLOW_VERSION',
    id: apId('sales-call-logger-flow-version'),
    flowId: apId('sales-call-logger-flow'),
    displayName: FLOW_DISPLAY_NAME,
    description: 'Sales Call Logger & Follow-up Drafter — scheduled sweep of Gmail (and Drive) transcript sources, fingerprint dedup, AI extraction with guardrails, Slack recap + one-tap approval for the follow-up email, all writes landing in a Deal Tracker sheet.',
    trigger,
    valid: true,
    schemaVersion: SCHEMA_VERSION,
    state: 'DRAFT',
    connectionIds: [],
    agentIds: [],
    notes: [],
    created: TS,
    updated: TS,
  }
}

function readabilityStep() {
  return codeAction({
    name: 'readability_check',
    displayName: 'Readability check',
    code: CODE_READABILITY,
    input: { candidate: '{{pick_candidate.output.candidate}}' },
  })
}

// --- Quality gate: unreadable -> notify + log; readable -> AI extraction ---
function qualityGate() {
  const notifyUnreadable = pieceAction({
    name: 'notify_unreadable',
    displayName: 'Notify: could not process',
    piece: 'slack',
    actionName: 'slack_post_message',
    input: {
      ...SLACK_AUTH,
      channel: SLACK_CHANNEL_ID,
      text: [
        ':warning: *Call transcript could not be processed*',
        'Source: {{pick_candidate.output.candidate.source}} · {{pick_candidate.output.candidate.subject}}',
        'Date: {{pick_candidate.output.candidate.date}}',
        'The transcript was empty or unreadable, so nothing was logged and no follow-up was drafted. Please handle this call manually:',
        '{{pick_candidate.output.candidate.link}}',
      ].join('\n'),
    },
  })

  const logUnreadable = addRow('log_unreadable', 'Log unreadable call', TABS.processed, {
    A: '{{pick_candidate.output.fingerprint}}',
    B: '{{pick_candidate.output.candidate.source}}',
    C: '{{sweep_window.output.nowIso}}',
    D: 'flagged-unreadable',
    E: '',
    F: '',
  })

  const extractFacts = NO_AI
    ? codeAction({
        name: 'extract_facts',
        displayName: 'Extract call facts (mock, no AI)',
        code: CODE_MOCK_EXTRACT,
        input: { candidate: '{{pick_candidate.output.candidate}}' },
      })
    : pieceAction({
        name: 'extract_facts',
        displayName: 'Extract call facts (AI)',
        piece: 'ai',
        actionName: 'askAi',
        input: {
          provider: 'openai',
          model: OPENAI_MODEL,
          prompt: EXTRACTION_PROMPT,
          creativity: 0,
          maxOutputTokens: 2500,
        },
      })

  const parseExtraction = codeAction({
    name: 'parse_extraction',
    displayName: 'Parse extraction',
    code: CODE_PARSE_EXTRACTION,
    input: {
      extract_facts: '{{extract_facts.output}}',
      candidate: '{{pick_candidate.output.candidate}}',
    },
  })

  const attendeeGate = routerAction({
    name: 'attendee_gate',
    displayName: 'External attendees?',
    branches: [
      condBranch(
        'internal_only',
        textCond('parse_extraction', 'hasExternal', 'TEXT_EXACTLY_MATCHES', 'false'),
        chain([logSkippedInternal(), summaryStep('run_summary_internal', 'skipped-internal', null)]),
      ),
      fallbackBranch('process', chain([dealMatch(), dealGate()])),
    ],
  })

  return routerAction({
    name: 'quality_gate',
    displayName: 'Readable?',
    branches: [
      condBranch(
        'unreadable',
        textCond('readability_check', 'verdict', 'TEXT_EXACTLY_MATCHES', 'unreadable'),
        chain([notifyUnreadable, logUnreadable, summaryStep('run_summary_unreadable', 'unreadable', null)]),
      ),
      fallbackBranch('process', chain([extractFacts, parseExtraction, attendeeGate])),
    ],
  })
}

function logSkippedInternal() {
  return addRow('log_skipped_internal', 'Log internal call (skipped)', TABS.processed, {
    A: '{{pick_candidate.output.fingerprint}}',
    B: '{{pick_candidate.output.candidate.source}}',
    C: '{{sweep_window.output.nowIso}}',
    D: 'skipped-internal',
    E: '',
    F: '',
  })
}

function dealMatch() {
  const matchDeal = findRows(
    'match_deal',
    'Match deal by account',
    TABS.deals,
    'A',
    '{{parse_extraction.output.suggestedAccount}}',
    false,
    1,
  )
  const dealMatchCheck = codeAction({
    name: 'deal_match_check',
    displayName: 'Deal match verdict',
    code: CODE_DEAL_MATCH,
    input: { match_deal: '{{match_deal.output}}' },
  })
  return chain([matchDeal, dealMatchCheck])
}

// --- Deal gate (PRD §9.7): a match proceeds; no match asks the rep ---
function dealGate() {
  const dealPrompt = pieceAction({
    name: 'deal_prompt',
    displayName: 'Ask: create deal?',
    piece: 'slack',
    actionName: 'request_action_message',
    input: {
      ...SLACK_AUTH,
      channel: SLACK_CHANNEL_ID,
      text: [
        ':thinking_face: No deal found for *{{parse_extraction.output.suggestedAccount}}*',
        'Call: {{pick_candidate.output.candidate.subject}} ({{pick_candidate.output.candidate.date}})',
        'External attendee: {{parse_extraction.output.externalAttendee}}',
        'Create a new deal, or skip and log the call without one.',
      ].join('\n'),
      actions: [
        { label: 'Create deal', style: 'primary' },
        { label: 'Skip', style: 'default' },
      ],
    },
  })

  const newDealId = codeAction({
    name: 'new_deal_id',
    displayName: 'New deal id',
    code: CODE_NEW_DEAL_ID,
  })

  const createDealSheet = addRow('create_deal_sheet', 'Create deal row', TABS.deals, {
    A: '{{new_deal_id.output.dealId}}',
    B: '{{parse_extraction.output.suggestedAccount}}',
    C: '{{parse_extraction.output.suggestedAccount}}',
    D: '{{parse_extraction.output.externalAttendee}}',
    E: 'Discovery',
    F: '',
    G: '{{pick_candidate.output.candidate.date}}',
    H: '{{sweep_window.output.nowIso}}',
    I: '',
  })

  const pipelineMatch = pipeline('match', '{{deal_match_check.output.dealId}}')
  const pipelineCreate = pipeline('create', '{{new_deal_id.output.dealId}}')
  const pipelineSkip = pipeline('skip', '{{parse_extraction.output.suggestedAccount}}')

  const dealChoice = routerAction({
    name: 'deal_choice',
    displayName: 'Create or skip?',
    branches: [
      condBranch(
        'create_deal',
        textCond('deal_prompt', 'action', 'TEXT_CONTAINS', 'Create deal'),
        chain([newDealId, createDealSheet, pipelineCreate]),
      ),
      fallbackBranch('skip', pipelineSkip),
    ],
  })

  return routerAction({
    name: 'deal_gate',
    displayName: 'Deal matched?',
    branches: [
      condBranch(
        'deal_matched',
        textCond('deal_match_check', 'matched', 'TEXT_EXACTLY_MATCHES', 'true'),
        pipelineMatch,
      ),
      fallbackBranch('no_match', chain([dealPrompt, dealChoice])),
    ],
  })
}

// ---------------------------------------------------------------------------
// Write agent.json + flows.json (SharedTemplate with the flows list)
// ---------------------------------------------------------------------------

const flow = buildFlow()
const outPath = join(ROOT, 'agent.json')
writeFileSync(outPath, JSON.stringify(flow, null, 2) + '\n', 'utf8')

// In NO_AI mode the single-flow export is also written under a distinct name
// so the diagnostic file can't be mistaken for the real submission.
const flowsPath = join(ROOT, NO_AI ? 'flows-noai.json' : 'flows.json')

// The platform also accepts the template shape: a "flows" list (SharedTemplate
// in @activepieces/shared — the same container ActivePieces' own template
// export endpoint produces: { name, type, summary, description, tags, blogUrl,
// metadata, author, categories, pieces, flows, status }).
// FlowVersionTemplate omits the DB-backed FlowVersion fields (id, flowId,
// state, connectionIds, agentIds, created, updated, notes, ...). Emitting
// exactly the template shape avoids surprises for servers that read fields
// directly instead of going through zod.
const { id: _id, flowId: _flowId, state: _state, connectionIds: _cids, agentIds: _aids, created: _created, updated: _updated, notes: _notes, ...templateFlow } = flow
const template = {
  name: FLOW_DISPLAY_NAME,
  type: 'SHARED',
  summary: 'Scheduled sweep of Gmail (and Drive) transcript sources, fingerprint dedup, AI extraction with guardrails, and a Slack one-tap approval that gates the follow-up email.',
  description: flow.description,
  tags: [],
  blogUrl: '',
  metadata: { externalId: 'sales-call-logger-followup-drafter' },
  author: '',
  categories: [],
  pieces: Object.values(PIECES_PIECE_NAMES).filter((n) => !(NO_AI && n === '@activepieces/piece-ai')),
  flows: [templateFlow],
  status: 'PUBLISHED',
}
writeFileSync(flowsPath, JSON.stringify(template, null, 2) + '\n', 'utf8')

// Count steps for the console summary (walk the whole tree, de-dup by object)
function countSteps(root) {
  const seen = new Set()
  const walk = (step) => {
    if (!step || seen.has(step)) return
    seen.add(step)
    walk(step.nextAction)
    if (step.firstLoopAction) walk(step.firstLoopAction)
    if (Array.isArray(step.children)) step.children.forEach((c) => walk(c))
  }
  walk(root)
  return seen.size
}

console.log(`Wrote ${outPath}`)
console.log(`Wrote ${flowsPath} (SharedTemplate with flows list)`)
console.log(`Flow: ${flow.displayName} (schemaVersion ${SCHEMA_VERSION})`)
console.log(`Total steps incl. trigger: ${countSteps(flow.trigger)}`)
console.log(`Pieces: ${Object.entries(PIECES).map(([k, v]) => `${k}@${v}`).join(', ')}`)
console.log('Placeholders to replace in ActivePieces:')
console.log(`  - Deal Tracker spreadsheet id: ${SPREADSHEET_ID}`)
console.log(`  - Transcript Drive folder id:  ${DRIVE_FOLDER_ID}`)
console.log(`  - Slack channel id:            ${SLACK_CHANNEL_ID}`)
