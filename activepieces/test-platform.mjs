#!/usr/bin/env node
/**
 * test-platform.mjs — end-to-end check for the platform-integrated submission
 * (flows-v3.json / agent-v3.json, built by build-agent-platform.mjs).
 *
 * Walks the linear chain and executes every CODE step with inputs resolved
 * from earlier outputs. PIECE steps are mocked with representative outputs
 * (empty Gmail search, empty dedup ledger, failed AI) so the run exercises
 * the deterministic fallback path — the exact scenario of a sandbox run —
 * and must still finish with a complete run_summary and no warnings.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const flow = JSON.parse(readFileSync(join(ROOT, 'agent-v3.json'), 'utf8'))

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('PASS  ' + name) }
  else { fail++; console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')) }
}

// Mock outputs for PIECE steps (sandbox / no-connection scenario).
const MOCK_PIECE = {
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

function resolve(value, outputs) {
  if (typeof value !== 'string') return value
  const bindings = [...value.matchAll(/\{\{([^}]+)\}\}/g)]
  if (bindings.length === 0) return value
  const look = (expr) => {
    const m = expr.match(/^([a-z_0-9]+)\.output(?:\.([a-zA-Z0-9_]+))?$/)
    if (!m) return undefined
    const out = outputs[m[1]]
    if (out === undefined) return undefined
    return m[2] ? out[m[2]] : out
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

const order = []
let node = flow.trigger
while (node) { order.push(node); node = node.nextAction }

ok('flow is linear (no routers/loops)', order.every((s) => ['CODE', 'PIECE'].includes(s.type) || s === flow.trigger))
ok('last step is run_summary', order[order.length - 1].name === 'run_summary')

const outputs = {}
let failedStep = null
for (const step of order) {
  if (step.type === 'CODE') {
    try { outputs[step.name] = await runStep(step, outputs) }
    catch (e) { failedStep = step.name + ': ' + e.message; break }
  } else if (step.type === 'PIECE') {
    outputs[step.name] = MOCK_PIECE[step.name] ?? {}
  }
}

ok('every code step executed without throwing', failedStep === null, failedStep ?? '')

const summary = outputs.run_summary ?? {}
ok('run_summary produced an object', typeof summary === 'object' && summary !== null)
ok('run_summary status completed', summary.status === 'completed')
ok('run_summary has a candidate', !!summary.candidate?.subject)
ok('run_summary fingerprint present', summary.fingerprint?.length > 0)
ok('extraction has external attendee', /@/.test(summary.extraction?.externalAttendee ?? ''))
ok('extraction has a suggested account', (summary.extraction?.suggestedAccount ?? '').length > 0)
ok('dealRef present', (summary.dealRef ?? '').length > 0)
ok('follow-up draft has subject + body', (summary.followupDraft?.emailSubject ?? '').length > 0 && (summary.followupDraft?.emailBody ?? '').length > 0)
ok('no warnings on the fallback run', Array.isArray(summary.warnings) && summary.warnings.length === 0, JSON.stringify(summary.warnings))
ok('draft references the actual attendee', /nina/i.test(summary.followupDraft?.emailBody ?? ''))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
