#!/usr/bin/env node
/**
 * test-platform.mjs — end-to-end check for the platform-integrated submissions
 * (flows-v3.json / agent-v3.json and flows-v4.json / agent-v4.json, built by
 * build-agent-platform.mjs).
 *
 * Walks each linear chain and executes every CODE step with inputs resolved
 * from earlier outputs. PIECE steps are mocked with representative outputs
 * (empty Gmail search, empty Drive folder, empty dedup ledger, failed AI,
 * pending approval) so the run exercises the deterministic fallback path —
 * the exact scenario of a sandbox run — and must still finish with a complete
 * run_summary and no warnings.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('PASS  ' + name) }
  else { fail++; console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')) }
}

// Mock outputs for PIECE steps (sandbox / no-connection scenario).
const MOCK_PIECE_V3 = {
  search_gmail: { found: false, results: { count: 0, messages: [] } },
  check_processed: { found: false, rows: [] },
  extract_facts: '',
  draft_followup: '',
  create_deal_sheet: { row: 2 },
  log_call_notes: { row: 3 },
  create_draft: {},
  post_recap: {},
  log_processed_pending: { row: 4 },
}

const MOCK_PIECE_V4 = {
  search_gmail: { found: false, results: { count: 0, messages: [] } },
  list_drive: { files: [] },
  read_transcript: {},
  ensure_deals: { found: true, created: false, worksheet: { sheetId: 0, title: 'Deals' } },
  ensure_contacts: { found: true, created: false, worksheet: { sheetId: 1, title: 'Contacts' } },
  ensure_call_notes: { found: true, created: false, worksheet: { sheetId: 2, title: 'Call Notes' } },
  ensure_tasks: { found: true, created: false, worksheet: { sheetId: 3, title: 'Tasks' } },
  ensure_processed: { found: true, created: false, worksheet: { sheetId: 4, title: '_ProcessedCalls' } },
  check_processed: { found: false, rows: [] },
  classify_priority: '',
  extract_facts: '',
  draft_followup: '',
  create_deal_sheet: { row: 2 },
  log_contact: { row: 2 },
  log_call_notes: { row: 3 },
  create_draft: {},
  request_approval: {},
  post_recap: {},
  log_processed: { row: 4 },
}

const MOCK_PIECE_V5 = {
  ...MOCK_PIECE_V4,
  hubspot_contact: { id: '1001', properties: { email: 'nina.k@acmecorp.com' } },
  hubspot_deal: { id: '2001', properties: { dealname: 'Acme Corp — transcript' } },
  hubspot_associate: { totalAssociations: 1, batchCount: 1 },
}

function resolve(value, outputs) {
  if (typeof value !== 'string') return value
  const bindings = [...value.matchAll(/\{\{([^}]+)\}\}/g)]
  if (bindings.length === 0) return value
  const look = (expr) => {
    const m = expr.match(/^([a-z_0-9]+)\.output(?:\.[a-zA-Z0-9_.]+)?$/)
    if (!m) return undefined
    let cur = outputs[m[1]]
    if (cur === undefined) return undefined
    const path = expr.split('.').slice(2)
    for (const p of path) {
      if (cur === undefined || cur === null) return undefined
      cur = cur[p]
    }
    return cur
  }
  if (bindings.length === 1 && bindings[0][0] === value) {
    const raw = look(bindings[0][1])
    return raw === undefined ? value : raw
  }
  let out = ''
  let last = 0
  for (const b of bindings) {
    out += value.slice(last, b.index)
    const raw = look(b[1])
    out += raw === undefined ? b[0] : String(raw)
    last = b.index + b[0].length
  }
  out += value.slice(last)
  return out
}

async function runStep(step, outputs) {
  const source = step.settings.sourceCode.code.replace(/^export\s+/, '')
  const codeFn = new Function(source + '\nreturn code;')()
  const input = {}
  for (const [k, v] of Object.entries(step.settings.input ?? {})) input[k] = resolve(v, outputs)
  return codeFn(input)
}

async function testFile(file, mocks, label) {
  console.log(`\n=== ${label} (${file}) ===`)
  const flow = JSON.parse(readFileSync(join(ROOT, file), 'utf8'))

  const order = []
  let node = flow.trigger
  while (node) { order.push(node); node = node.nextAction }

  ok(label + ': flow is linear', order.every((s) => ['CODE', 'PIECE'].includes(s.type) || s === flow.trigger))
  ok(label + ': last step is run_summary', order[order.length - 1].name === 'run_summary')

  const outputs = {}
  let failedStep = null
  for (const step of order) {
    if (step.type === 'CODE') {
      try { outputs[step.name] = await runStep(step, outputs) }
      catch (e) { failedStep = step.name + ': ' + e.message; break }
    } else if (step.type === 'PIECE') {
      outputs[step.name] = mocks[step.name] ?? {}
    }
  }

  ok(label + ': every code step executed without throwing', failedStep === null, failedStep ?? '')

  const summary = outputs.run_summary ?? {}
  ok(label + ': run_summary produced an object', typeof summary === 'object' && summary !== null)
  ok(label + ': run_summary status completed', summary.status === 'completed')
  ok(label + ': run_summary has a candidate', !!summary.candidate?.subject)
  ok(label + ': fingerprint present', summary.fingerprint?.length > 0)
  ok(label + ': extraction has external attendee', /@/.test(summary.extraction?.externalAttendee ?? ''))
  ok(label + ': extraction has a suggested account', (summary.extraction?.suggestedAccount ?? '').length > 0)
  ok(label + ': dealRef present', (summary.dealRef ?? '').length > 0)
  ok(label + ': follow-up draft has subject + body', (summary.followupDraft?.emailSubject ?? '').length > 0 && (summary.followupDraft?.emailBody ?? '').length > 0)
  ok(label + ': no warnings on the fallback run', Array.isArray(summary.warnings) && summary.warnings.length === 0, JSON.stringify(summary.warnings))
  ok(label + ': draft references the actual attendee', /nina/i.test(summary.followupDraft?.emailBody ?? ''))

  if (label === 'v4') {
    ok('v4: approval status present', ['approved', 'rejected', 'pending'].includes(summary.approval?.status))
    ok('v4: priority present', ['high', 'medium', 'low'].includes(summary.priority))
    ok('v4: sources reported', typeof summary.sources?.gmailFound === 'number' && typeof summary.sources?.driveFound === 'number')
    ok('v4: tabs report present', summary.tabs?.deals?.sheetId === 0 && summary.tabs?.processed?.sheetId === 4)
  }

  if (label === 'v5') {
    ok('v5: approval status present', ['approved', 'rejected', 'pending'].includes(summary.approval?.status))
    ok('v5: priority present', ['high', 'medium', 'low'].includes(summary.priority))
    ok('v5: sources reported', typeof summary.sources?.gmailFound === 'number' && typeof summary.sources?.driveFound === 'number')
    ok('v5: tabs report present', summary.tabs?.deals?.sheetId === 0 && summary.tabs?.processed?.sheetId === 4)
    ok('v5: hubspot attempted', summary.hubspot?.attempted === true)
    ok('v5: hubspot contact id present', !!summary.hubspot?.contactId)
    ok('v5: hubspot deal id present', !!summary.hubspot?.dealId)
    ok('v5: hubspot associated', summary.hubspot?.associated === true)
    ok('v5: no hubspot warning (email present)', !summary.warnings.some((w) => /hubspot/i.test(w)))
  }
}

await testFile('agent-v3.json', MOCK_PIECE_V3, 'v3')
await testFile('agent-v4.json', MOCK_PIECE_V4, 'v4')
await testFile('agent-v5.json', MOCK_PIECE_V5, 'v5')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
