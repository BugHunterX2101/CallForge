#!/usr/bin/env node
/**
 * test-agent.mjs
 *
 * Executes every code step embedded in agent.json against realistic mock
 * inputs and asserts the PRD guardrails (fingerprint dedup, newest-first
 * picking, teaser rejection, verbatim extraction, "Not specified" dates,
 * internal-call detection, safe non-JSON degradation, draft parsing).
 *
 * No dependencies. Run from the repo root:
 *   node activepieces/test-agent.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const flow = JSON.parse(readFileSync(join(ROOT, 'agent.json'), 'utf8'))

let failures = 0
const seen = new Set()
const steps = []

function walk(s) {
  if (!s || seen.has(s)) return
  seen.add(s)
  if (s.type === 'CODE') steps.push(s)
  walk(s.nextAction)
  if (s.firstLoopAction) walk(s.firstLoopAction)
  if (Array.isArray(s.children)) s.children.forEach(walk)
}
walk(flow.trigger)

async function run(step, params) {
  const src = step.settings.sourceCode.code.replace(/^export const code = /, 'const code = ')
  const fn = new Function(src + '\nreturn code;')()
  return await fn(params ?? {})
}

function assert(cond, label) {
  if (cond) console.log(`PASS  ${label}`)
  else { failures++; console.log(`FAIL  ${label}`) }
}

const byName = (n) => steps.find((s) => s.name === n)

// --- sweep_window ---
const sweep = await run(byName('sweep_window'))
assert(typeof sweep.sinceIso === 'string' && !Number.isNaN(Date.parse(sweep.sinceIso)), 'sweep_window.sinceIso is an ISO date')
assert(Date.parse(sweep.nowIso) - Date.parse(sweep.sinceIso) > 60_000, 'sweep_window window is wider than the cron cadence')

// --- pick_candidate: dedup + normalization ---
const transcriptBody = 'Nina: thanks for the call, we are ready to move forward with the pilot.\nRep: great, I will send the contract this week.\n'.repeat(20)
const pick = await run(byName('pick_candidate'), {
  search_gmail: {
    count: 2,
    messages: [
      { id: 'abc1', subject: 'TechFlow call transcript', from: { text: 'Zoom Notifications <no-reply@zoom.us>' }, date: '2026-08-12T10:00:00Z', text: transcriptBody },
      { id: 'abc2', subject: 'Older call transcript', from: { text: 'Fireflies <noreply@fireflies.ai>' }, date: '2026-08-12T09:00:00Z', text: transcriptBody },
    ],
  },
})
assert(pick.found === true, 'pick_candidate.found true when emails exist')
assert(pick.candidate.id === 'abc1', 'pick_candidate picks the newest email')
assert(/^[0-9a-f]+$/.test(pick.fingerprint) && pick.fingerprint.length > 0, 'pick_candidate.fingerprint is a hex hash')
assert(pick.candidate.body.includes('Nina'), 'pick_candidate normalizes body (whitespace collapsed)')
assert(pick.candidate.source === 'gmail' && pick.candidate.link.includes('abc1'), 'pick_candidate builds gmail link')
const pickEmpty = await run(byName('pick_candidate'), { search_gmail: { count: 0, messages: [] } })
assert(pickEmpty.found === false && pickEmpty.fingerprint === '', 'pick_candidate handles an empty sweep')
const pickBare = await run(byName('pick_candidate'), {})
assert(pickBare.found === true && pickBare.candidate.body.includes('Acme'), 'pick_candidate falls back to the demo transcript on a bare run (failed sweep step)')
assert(pickBare.candidate.source === 'gmail' && /^[0-9a-f]+$/.test(pickBare.fingerprint), 'pick_candidate demo fallback keeps fingerprint + source intact')

// --- check_dedup ---
const dedup = await run(byName('check_dedup'), { check_processed: { rows: [{ row: 2, values: { A: 'x' } }] } })
assert(dedup.alreadyProcessed === true && dedup.count === 1, 'check_dedup flags an existing fingerprint')
const dedup2 = await run(byName('check_dedup'), { check_processed: { rows: [] } })
assert(dedup2.alreadyProcessed === false, 'check_dedup clears a new fingerprint')

// --- readability_check ---
const readable = await run(byName('readability_check'), { candidate: { body: transcriptBody } })
assert(readable.readable === true && readable.verdict === 'process', 'readability_check passes a real transcript')
const teaser = await run(byName('readability_check'), { candidate: { body: 'Your transcript is ready: https://link' } })
assert(teaser.readable === false && teaser.verdict === 'unreadable', 'readability_check rejects a teaser/link-only email')

// --- parse_extraction: guardrails (askAi returns the raw answer text) ---
const extractOutput = JSON.stringify({
  summary: 'Customer wants a pilot.',
  objections: ['We are worried about rollout time.'],
  commitments: ['We will share security docs.'],
  nextSteps: [
    { task: 'Send contract', owner: 'REP', dueDate: '2026-08-20' },
    { task: 'Follow up on pricing', owner: 'REP', dueDate: 'next week' },
  ],
  stageSignal: null,
  externalAttendee: 'nina.patel@techflow.io',
  suggestedAccount: 'TechFlow',
})
const parsed = await run(byName('parse_extraction'), { extract_facts: extractOutput })
assert(parsed.summary.includes('pilot'), 'parse_extraction parses summary')
assert(parsed.objections[0].includes('rollout'), 'parse_extraction parses objections verbatim')
assert(parsed.tasks.length === 2, 'parse_extraction captures both next steps')
assert(parsed.tasks[1].dueDate === 'Not specified', 'parse_extraction never invents a due date ("next week" -> Not specified)')
assert(parsed.tasks[0].dueDate === '2026-08-20', 'parse_extraction keeps real dates')
assert(parsed.hasExternal === true && parsed.externalAttendee === 'nina.patel@techflow.io', 'parse_extraction detects external attendee')
assert(parsed.stageSignal === null, 'parse_extraction keeps null stage signal')
const internal = await run(byName('parse_extraction'), {
  extract_facts: JSON.stringify({ summary: 'Internal sync', objections: [], commitments: [], nextSteps: [], stageSignal: null, externalAttendee: '', suggestedAccount: '' }),
})
assert(internal.hasExternal === false, 'parse_extraction flags internal-only calls')
const garbled = await run(byName('parse_extraction'), { extract_facts: 'not json at all' })
assert(garbled.summary === 'not json at all' && garbled.tasks.length === 0, 'parse_extraction degrades safely on non-JSON')
const bareExtract = await run(byName('parse_extraction'), { extract_facts: '', candidate: pickBare.candidate })
assert(bareExtract.externalAttendee === 'nina.k@acmecorp.com', 'parse_extraction finds the attendee email from the transcript when AI is absent')
assert(bareExtract.summary.length > 0 && bareExtract.hasExternal === true, 'parse_extraction degrades to a real excerpt, never invents')

// --- deal_match_check ---
const deal = await run(byName('deal_match_check'), { match_deal: { rows: [{ values: { A: 'deal_techflow' } }] } })
assert(deal.matched === true && deal.dealId === 'deal_techflow', 'deal_match_check reads matched deal id')

// --- pipeline_ctx ---
const ctx = await run(byName('pipeline_ctx_match'), { dealRef: 'deal_techflow' })
assert(ctx.dealRef === 'deal_techflow' && ctx.noteId.startsWith('note_'), 'pipeline_ctx passes dealRef and builds a note id')

// --- new_deal_id ---
const nd = await run(byName('new_deal_id'), {})
assert(nd.dealId.startsWith('deal_'), 'new_deal_id generates a deal id')

// --- parse_draft ---
const draft = await run(byName('parse_draft_match'), {
  draft_followup: JSON.stringify({ email_subject: 'Pilot next steps', email_body: 'Hi Nina,\n\nHere is the contract.\n\nBest' }),
})
assert(draft.emailSubject === 'Pilot next steps' && draft.emailBody.includes('contract'), 'parse_draft parses draft JSON')
const bareDraft = await run(byName('parse_draft_match'), {
  draft_followup: '',
  extraction: bareExtract,
  candidate: pickBare.candidate,
})
assert(bareDraft.emailSubject.includes('Acme') && bareDraft.emailBody.includes('nina'), 'parse_draft synthesizes a grounded follow-up when AI is absent')
assert(bareDraft.emailBody.includes('recap') && bareDraft.emailBody.length > 100, 'parse_draft fallback draft is a complete, usable email')

// --- run_summary: terminal output on every path ---
const bareSummary = await run(byName('run_summary_rejected_skip'), { outcome: 'rejected', candidate: {}, fingerprint: '', extraction: {}, draft: {} })
assert(bareSummary.status === 'completed' && bareSummary.outcome === 'rejected', 'run_summary completes with the given outcome')
assert(bareSummary.warnings.length === 3 && bareSummary.followupDraft.emailSubject === '', 'run_summary reports empty sections as warnings instead of failing')
const fullSummary = await run(byName('run_summary_rejected_skip'), {
  outcome: 'rejected',
  candidate: pickBare.candidate,
  fingerprint: pickBare.fingerprint,
  extraction: bareExtract,
  draft: bareDraft,
})
assert(fullSummary.candidate.subject.includes('Acme') && fullSummary.fingerprint.length > 0, 'run_summary includes the picked candidate and fingerprint')
assert(fullSummary.extraction.externalAttendee === 'nina.k@acmecorp.com' && fullSummary.followupDraft.emailSubject.includes('Acme'), 'run_summary includes extraction + drafted follow-up')
assert(fullSummary.warnings.length === 0, 'run_summary has no warnings on a complete run')

console.log(failures === 0 ? '\nALL CODE-STEP BEHAVIOR CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
