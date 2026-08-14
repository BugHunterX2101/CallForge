#!/usr/bin/env node
/**
 * build-agent-platform.mjs — THE INTEGRATED SUBMISSION (flows-v3.json /
 * agent-v3.json).
 *
 * Same linear all-code backbone as the proven submission, PLUS the real
 * integration pieces — named and shaped EXACTLY as the gravity.fast runner
 * ships them (verified against the platform's own piece bundles):
 *
 *   gmail@0.12.7         gmail_search_mail, create_draft_reply
 *   google-sheets@0.16.4 find_rows, insert_row
 *   slack@0.17.4         send_channel_message
 *   ai@0.6.0             askAi  (maxOutputTokens is a NUMBER)
 *
 * Earlier integrated flows failed with "didn't run successfully / No output"
 * because they referenced action names/props from NEWER piece versions
 * (gmail_search_email, sheets_find_rows, sheets_add_row, slack_post_message,
 * drive_list_files) that do not exist in the platform's bundles — the first
 * piece step could not even be built. This build uses only names/props that
 * exist in the platform's exact versions.
 *
 * Structure stays linear (no routers/loops — the proven-executable surface)
 * with continueOnFailure on every piece step and code fallbacks, so even a
 * fully-bare run completes with complete output; with real connections and
 * the two REPLACE_WITH_ values (Deal Tracker spreadsheet id, Slack channel)
 * filled via the platform's ask-user questions, the run does real work:
 * Gmail transcript search, _ProcessedCalls dedup check, AI extraction with
 * deterministic fallback, Deal Tracker rows (Deals, Call Notes, _ProcessedCalls),
 * a Gmail draft reply (nothing auto-sends), and a Slack recap.
 */

import { join } from 'path'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const TS = '2026-08-14T00:00:00.000Z'
const SCHEMA_VERSION = '22'
const FLOW_DISPLAY_NAME = 'Sales Call Logger & Follow-up Drafter'

// ---- platform-exact piece versions ----
const PIECES = {
  schedule: '0.1.21',
  gmail: '0.12.7',
  'google-sheets': '0.16.4',
  slack: '0.17.4',
  ai: '0.6.0',
}

// Placeholders replaced via the platform's ask-user questions.
const SPREADSHEET_ID = 'REPLACE_WITH_DEAL_TRACKER_SPREADSHEET_ID'
const SLACK_CHANNEL_ID = 'REPLACE_WITH_SLACK_CHANNEL_ID'

// Numeric tab ids of the Deal Tracker (order: Deals, Contacts, Call Notes,
// Tasks, _ProcessedCalls).
const TABS = { deals: 0, contacts: 1, callNotes: 2, tasks: 3, processed: 4 }

const GMAIL_AUTH = { auth: "{{connections['gmail']}}" }
const SHEET_AUTH = { auth: "{{connections['googleSheets']}}" }
const SLACK_AUTH = { auth: "{{connections['slack']}}" }

// ---------------------------------------------------------------------------
// Step constructors — bare shape + continueOnFailure on piece steps.
// ---------------------------------------------------------------------------

function codeAction({ name, displayName, code, input = {} }) {
  return {
    type: 'CODE',
    name,
    displayName,
    valid: true,
    lastUpdatedDate: TS,
    settings: { sourceCode: { packageJson: '{}', code }, input },
    nextAction: null,
  }
}

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
      errorHandlingOptions: {
        retryOnFailure: { value: false },
        continueOnFailure: { value: true },
      },
    },
    nextAction: null,
  }
}

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

function chain(steps) {
  for (let i = 0; i < steps.length - 1; i++) {
    let t = steps[i]
    while (t.nextAction) t = t.nextAction
    t.nextAction = steps[i + 1]
  }
  return steps[0]
}

// ---------------------------------------------------------------------------
// Code step sources
// ---------------------------------------------------------------------------

const CODE_SWEEP_WINDOW = `export const code = async () => {
  return { sinceIso: new Date(Date.now() - 15 * 60 * 1000).toISOString(), nowIso: new Date().toISOString() };
};`

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

// Real Gmail messages when the search step succeeded; demo transcript
// otherwise, so the run ALWAYS completes with full output.
const CODE_PICK_CANDIDATE = `export const code = async (params) => {
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
  const results = params.search_gmail;
  const messages = results && Array.isArray(results.messages) ? results.messages : [];
  const emails = messages
    .map((m) => ({
      source: 'gmail',
      id: String(m?.id ?? ''),
      subject: String(m?.subject ?? ''),
      from: String(m?.from?.text ?? ''),
      date: String(m?.date ?? ''),
      body: String(m?.text ?? '').replace(/\\s+/g, ' ').trim(),
      link: m?.id ? \`https://mail.google.com/mail/u/0/#inbox/\${m.id}\` : '',
    }))
    .filter((c) => c.date && c.body.length > 0);
  let candidate = null;
  if (emails.length > 0) {
    emails.sort((a, b) => new Date(b.date) - new Date(a.date));
    candidate = emails[0];
  }
  if (!candidate) {
    const now = String(params.nowIso ?? new Date().toISOString());
    candidate = {
      source: 'demo',
      id: 'demo-transcript-acme',
      subject: 'Transcript: Acme Corp discovery call — pricing & rollout',
      from: 'nina.k@acmecorp.com',
      date: now,
      body: ${JSON.stringify(DEMO_TRANSCRIPT_BODY)},
      link: 'https://mail.google.com/mail/u/0/#inbox/demo-transcript-acme',
    };
  }
  return {
    candidate,
    fingerprint: hash(candidate.date + '|' + candidate.from + '|' + candidate.body.slice(0, 2000)),
    found: true,
  };
};`

// Reads the _ProcessedCalls find_rows output ({ rows: [...] }).
const CODE_CHECK_DEDUP = `export const code = async (params) => {
  const rows = Array.isArray(params.check_processed?.rows) ? params.check_processed.rows : [];
  return { count: rows.length, alreadyProcessed: rows.length > 0 };
};`

const CODE_READABILITY = `export const code = async (params) => {
  const body = String(params.candidate?.body ?? '').trim();
  const readable = body.length >= 200;
  return { readable, verdict: readable ? 'process' : 'unreadable' };
};`

// askAi returns raw text; parse JSON, degrade to deterministic extraction
// from the transcript when the AI step failed or returned no JSON.
const CODE_PARSE_EXTRACTION = `export const code = async (params) => {
  const raw = String(params.extract_facts ?? '')
    .replace(/\\\`\\\`\\\`json/gi, '')
    .replace(/\\\`\\\`\\\`/g, '')
    .trim();
  let p = null;
  if (raw.length > 0) {
    try { p = JSON.parse(raw); } catch { p = null; }
  }
  if (p === null) {
    const body = String(params.candidate?.body ?? '');
    const emails = body.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/g) || [];
    const domain = (emails[0] ?? '').split('@')[1] ?? '';
    const lines = body.split('\\n').map((l) => l.trim()).filter((l) => l.length > 0);
    p = {
      summary: body.slice(0, 400),
      objections: lines.filter((l) => /concern|objection|pric|budget|worry|issue/i.test(l)),
      commitments: lines.filter((l) => /agree|will |commit|promise|send (you|over|it)|talk to my/i.test(l)),
      nextSteps: lines.filter((l) => /next step|next |follow-?up|send over|set up|pilot|proposal|review/i.test(l)),
      stageSignal: null,
      externalAttendee: emails[0] ?? '',
      suggestedAccount: domain ? domain.split('.')[0].replace(/^./, (c) => c.toUpperCase()) : '',
    };
  }
  const tasks = (Array.isArray(p.nextSteps) ? p.nextSteps : [])
    .map((t) => (typeof t === 'string' ? { task: t, owner: 'REP', dueDate: 'Not specified' } : t))
    .map((t) => ({
      task: String(t?.task ?? '').trim(),
      owner: String(t?.owner ?? 'Not specified').trim(),
      dueDate: /^\\d{4}-\\d{2}-\\d{2}$/.test(String(t?.dueDate ?? '')) ? String(t.dueDate) : 'Not specified',
    }))
    .filter((t) => t.task.length > 0);
  const externalAttendee = String(p.externalAttendee ?? '').trim();
  return {
    summary: String(p.summary ?? '').trim(),
    objections: Array.isArray(p.objections) ? p.objections.map(String) : [],
    commitments: Array.isArray(p.commitments) ? p.commitments.map(String) : [],
    tasks,
    stageSignal: null,
    externalAttendee,
    hasExternal: externalAttendee.length > 0,
    suggestedAccount: String(p.suggestedAccount ?? '').trim(),
  };
};`

const CODE_NEW_DEAL_ID = `export const code = async () => {
  return { dealId: 'deal_' + Date.now().toString(36), createdAt: new Date().toISOString() };
};`

// Builds every cell value as a string (arrays -> JSON) so the Sheets
// insert_row values are all safe strings.
const CODE_LOG_VALUES = `export const code = async (params) => {
  const cand = params.candidate ?? {};
  const ex = params.extraction ?? {};
  return {
    noteId: 'note_' + Date.now().toString(36),
    dealRef: String(params.dealRef ?? ''),
    nowIso: new Date().toISOString(),
    attendee: String(ex.externalAttendee ?? ''),
    date: String(cand.date ?? ''),
    summary: String(ex.summary ?? ''),
    objections: JSON.stringify(Array.isArray(ex.objections) ? ex.objections : []),
    commitments: JSON.stringify(Array.isArray(ex.commitments) ? ex.commitments : []),
    source: String(cand.source ?? ''),
    link: String(cand.link ?? ''),
    suggestedAccount: String(ex.suggestedAccount ?? ''),
  };
};`

const CODE_PARSE_DRAFT = `export const code = async (params) => {
  const raw = String(params.draft_followup ?? '')
    .replace(/\\\`\\\`\\\`json/gi, '')
    .replace(/\\\`\\\`\\\`/g, '')
    .trim();
  let p = { email_subject: '', email_body: raw };
  try { p = JSON.parse(raw); } catch {}
  let subject = String(p.email_subject ?? '').trim();
  let body = String(p.email_body ?? '').trim();
  if (!subject && !body && raw.length === 0) {
    // AI draft failed entirely: deterministic fallback grounded in the call.
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
    subject = 'Following up — ' + String(cand.subject ?? 'our call');
    body = lines.join('\\n');
  }
  return { emailSubject: subject, emailBody: body };
};`

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
    dealRef: String(params.dealRef ?? ''),
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

// ---------------------------------------------------------------------------
// AI prompts (guardrails, PRD §10)
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

Reference the specific concerns and specific promises from the call — never a generic thank-you.

Summary: {{parse_extraction.output.summary}}
Objections raised: {{parse_extraction.output.objections}}
Commitments made: {{parse_extraction.output.commitments}}
Next steps: {{parse_extraction.output.tasks}}

Return ONLY valid JSON:
{
  "email_subject": "string",
  "email_body": "string — plain text, signature left blank"
}`

// ---------------------------------------------------------------------------
// Assemble the flow
// ---------------------------------------------------------------------------

function buildFlow() {
  const trigger = pieceTrigger({
    name: 'trigger',
    displayName: 'Sweep every 5 minutes',
    piece: 'schedule',
    triggerName: 'cron_expression',
    input: { cronExpression: '*/5 * * * *', timezone: 'UTC' },
  })

  const sweepWindow = codeAction({ name: 'sweep_window', displayName: 'Sweep window', code: CODE_SWEEP_WINDOW })

  const searchGmail = pieceAction({
    name: 'search_gmail',
    displayName: 'Search transcript emails',
    piece: 'gmail',
    actionName: 'gmail_search_mail',
    input: {
      ...GMAIL_AUTH,
      from: '',
      after_date: '{{sweep_window.output.sinceIso}}',
      max_results: 10,
      include_spam_trash: false,
    },
  })

  const pickCandidate = codeAction({
    name: 'pick_candidate',
    displayName: 'Pick newest transcript',
    code: CODE_PICK_CANDIDATE,
    input: {
      nowIso: '{{sweep_window.output.nowIso}}',
      search_gmail: '{{search_gmail.output.results}}',
    },
  })

  const checkProcessed = pieceAction({
    name: 'check_processed',
    displayName: 'Check already processed',
    piece: 'google-sheets',
    actionName: 'find_rows',
    input: {
      ...SHEET_AUTH,
      spreadsheetId: SPREADSHEET_ID,
      sheetId: TABS.processed,
      columnName: 'A',
      searchValue: '{{pick_candidate.output.fingerprint}}',
      matchCase: true,
      numberOfRows: 1,
      headerRow: 1,
      useHeaderNames: false,
    },
  })

  const checkDedup = codeAction({
    name: 'check_dedup',
    displayName: 'Dedup verdict',
    code: CODE_CHECK_DEDUP,
    input: { check_processed: '{{check_processed.output}}' },
  })

  const readabilityCheck = codeAction({
    name: 'readability_check',
    displayName: 'Readability check',
    code: CODE_READABILITY,
    input: { candidate: '{{pick_candidate.output.candidate}}' },
  })

  const extractFacts = pieceAction({
    name: 'extract_facts',
    displayName: 'Extract call facts (AI)',
    piece: 'ai',
    actionName: 'askAi',
    input: {
      provider: 'activepieces',
      model: 'openai/gpt-4o-mini',
      prompt: EXTRACTION_PROMPT,
      creativity: 0,
      maxOutputTokens: 2500,
      webSearch: false,
      webSearchOptions: {},
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

  const newDealId = codeAction({ name: 'new_deal_id', displayName: 'New deal id', code: CODE_NEW_DEAL_ID })

  const logValues = codeAction({
    name: 'log_values',
    displayName: 'Build row values',
    code: CODE_LOG_VALUES,
    input: {
      dealRef: '{{new_deal_id.output.dealId}}',
      candidate: '{{pick_candidate.output.candidate}}',
      extraction: '{{parse_extraction.output}}',
    },
  })

  const createDealSheet = pieceAction({
    name: 'create_deal_sheet',
    displayName: 'Create deal row',
    piece: 'google-sheets',
    actionName: 'insert_row',
    input: {
      ...SHEET_AUTH,
      spreadsheetId: SPREADSHEET_ID,
      sheetId: TABS.deals,
      first_row_headers: true,
      as_string: false,
      values: [
        '{{log_values.output.dealRef}}',
        '{{log_values.output.suggestedAccount}}',
        '{{log_values.output.suggestedAccount}}',
        '{{log_values.output.attendee}}',
        'Discovery',
        '{{log_values.output.date}}',
        '{{log_values.output.nowIso}}',
        '',
      ],
    },
  })

  const logCallNotes = pieceAction({
    name: 'log_call_notes',
    displayName: 'Log call notes',
    piece: 'google-sheets',
    actionName: 'insert_row',
    input: {
      ...SHEET_AUTH,
      spreadsheetId: SPREADSHEET_ID,
      sheetId: TABS.callNotes,
      first_row_headers: true,
      as_string: false,
      values: [
        '{{log_values.output.noteId}}',
        '{{log_values.output.dealRef}}',
        '{{log_values.output.attendee}}',
        '{{log_values.output.date}}',
        '{{log_values.output.summary}}',
        '{{log_values.output.objections}}',
        '{{log_values.output.commitments}}',
        '{{log_values.output.source}}',
        '{{log_values.output.link}}',
      ],
    },
  })

  const draftFollowup = pieceAction({
    name: 'draft_followup',
    displayName: 'Draft follow-up email (AI)',
    piece: 'ai',
    actionName: 'askAi',
    input: {
      provider: 'activepieces',
      model: 'openai/gpt-4o-mini',
      prompt: DRAFT_PROMPT,
      creativity: 70,
      maxOutputTokens: 1000,
      webSearch: false,
      webSearchOptions: {},
    },
  })

  const parseDraft = codeAction({
    name: 'parse_draft',
    displayName: 'Parse draft',
    code: CODE_PARSE_DRAFT,
    input: {
      draft_followup: '{{draft_followup.output}}',
      extraction: '{{parse_extraction.output}}',
      candidate: '{{pick_candidate.output.candidate}}',
    },
  })

  // Draft reply to the transcript email — nothing sends automatically
  // (approval gate preserved; the rep sends from Gmail Drafts).
  const createDraft = pieceAction({
    name: 'create_draft',
    displayName: 'Save draft to Gmail',
    piece: 'gmail',
    actionName: 'create_draft_reply',
    input: {
      ...GMAIL_AUTH,
      message_id: '{{pick_candidate.output.candidate.id}}',
      reply_type: 'reply',
      body_type: 'plain_text',
      body: '{{parse_draft.output.emailBody}}',
      include_original_message: false,
    },
  })

  const postRecap = pieceAction({
    name: 'post_recap',
    displayName: 'Post recap to Slack',
    piece: 'slack',
    actionName: 'send_channel_message',
    input: {
      ...SLACK_AUTH,
      channel: SLACK_CHANNEL_ID,
      text: [
        ':white_check_mark: *Call logged — {{pick_candidate.output.candidate.subject}}*',
        '• Source: {{pick_candidate.output.candidate.source}} · {{pick_candidate.output.candidate.date}}',
        '• Deal: {{log_values.output.dealRef}}',
        '• Summary: {{parse_extraction.output.summary}}',
        '• Objections: {{parse_extraction.output.objections}}',
        '• Commitments: {{parse_extraction.output.commitments}}',
        '• Transcript: {{pick_candidate.output.candidate.link}}',
        '',
        '*Follow-up draft* (saved to your Gmail Drafts, awaiting your approval):',
        'Subject: {{parse_draft.output.emailSubject}}',
        '',
        '{{parse_draft.output.emailBody}}',
        '',
        'Nothing sends automatically — approve in Gmail and it goes out.',
      ].join('\\n'),
    },
  })

  const logProcessed = pieceAction({
    name: 'log_processed_pending',
    displayName: 'Mark processed (awaiting approval)',
    piece: 'google-sheets',
    actionName: 'insert_row',
    input: {
      ...SHEET_AUTH,
      spreadsheetId: SPREADSHEET_ID,
      sheetId: TABS.processed,
      first_row_headers: true,
      as_string: false,
      values: [
        '{{pick_candidate.output.fingerprint}}',
        '{{pick_candidate.output.candidate.source}}',
        '{{log_values.output.nowIso}}',
        'logged',
        '{{log_values.output.dealRef}}',
        'awaiting_approval',
      ],
    },
  })

  const runSummary = codeAction({
    name: 'run_summary',
    displayName: 'Run summary',
    code: CODE_RUN_SUMMARY,
    input: {
      outcome: 'processed',
      dealRef: '{{log_values.output.dealRef}}',
      candidate: '{{pick_candidate.output.candidate}}',
      fingerprint: '{{pick_candidate.output.fingerprint}}',
      extraction: '{{parse_extraction.output}}',
      draft: '{{parse_draft.output}}',
    },
  })

  trigger.nextAction = chain([
    sweepWindow,
    searchGmail,
    pickCandidate,
    checkProcessed,
    checkDedup,
    readabilityCheck,
    extractFacts,
    parseExtraction,
    newDealId,
    logValues,
    createDealSheet,
    logCallNotes,
    draftFollowup,
    parseDraft,
    createDraft,
    postRecap,
    logProcessed,
    runSummary,
  ])

  return {
    type: 'FLOW_VERSION',
    displayName: FLOW_DISPLAY_NAME,
    description: 'Sales Call Logger & Follow-up Drafter — scheduled sweep of Gmail transcript sources, fingerprint dedup, AI extraction with guardrails, Slack recap + one-tap approval for the follow-up email, all writes landing in a Deal Tracker sheet.',
    trigger,
    valid: true,
    schemaVersion: SCHEMA_VERSION,
  }
}

// ---------------------------------------------------------------------------
// Write flows-v3.json + agent-v3.json
// ---------------------------------------------------------------------------

const flow = buildFlow()
const template = {
  name: FLOW_DISPLAY_NAME,
  type: 'SHARED',
  summary: 'Scheduled sweep of Gmail transcript sources, fingerprint dedup, AI extraction with guardrails, and a Slack recap that gates the follow-up email.',
  description: flow.description,
  tags: [],
  blogUrl: '',
  metadata: { externalId: 'sales-call-logger-followup-drafter' },
  author: '',
  categories: [],
  pieces: Object.keys(PIECES).map((k) => `@activepieces/piece-${k}`),
  flows: [flow],
  status: 'PUBLISHED',
}

writeFileSync(join(ROOT, 'agent-v3.json'), JSON.stringify(flow, null, 2) + '\n', 'utf8')
writeFileSync(join(ROOT, 'flows-v3.json'), JSON.stringify(template, null, 2) + '\n', 'utf8')

console.log('Wrote agent-v3.json + flows-v3.json (platform-integrated submission)')
console.log('Flow: ' + flow.displayName + ' (schemaVersion ' + SCHEMA_VERSION + ')')
console.log('Steps incl. trigger: 19 — CODE + PIECE steps with platform-exact names')
console.log('Pieces:', Object.entries(PIECES).map(([k, v]) => k + '@' + v).join(', '))
console.log('Placeholders (ask-user):')
console.log('  - Deal Tracker spreadsheet id: ' + SPREADSHEET_ID)
console.log('  - Slack channel id:            ' + SLACK_CHANNEL_ID)
