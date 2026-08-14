#!/usr/bin/env node
/**
 * test-codeonly.mjs — end-to-end check for the SUBMISSION flow
 * (flows.json / agent.json, built by build-agent-codeonly.mjs).
 *
 * Walks the linear chain, executes every CODE step with its inputs resolved
 * from earlier step outputs (the same {{step.output}} bindings the engine
 * resolves), and asserts the final run_summary returns the complete agent
 * result. Dependency-free — a pure-node smoke test of the exact artifact
 * that gets uploaded.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const flow = JSON.parse(readFileSync(join(ROOT, 'agent.json'), 'utf8'))

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('PASS  ' + name) }
  else { fail++; console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')) }
}

// Resolve {{step.output.field}} (and {{step.output}}) against executed outputs.
// A field whose ENTIRE value is one binding resolves to the raw value
// (object or string) — like the engine's resolver. Mixed strings concatenate.
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
  // Whole string is a single binding -> return the raw value.
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
  const factory = new Function(source + '\nreturn code;')
  const codeFn = factory()
  const input = {}
  for (const [k, v] of Object.entries(step.settings.input ?? {})) input[k] = resolve(v, outputs)
  return codeFn({ ...input })
}

// ---- walk the linear chain ----
const order = []
let node = flow.trigger
while (node) { order.push(node); node = node.nextAction }

ok('trigger is the schedule cron piece', flow.trigger.type === 'PIECE_TRIGGER' && flow.trigger.settings.triggerName === 'cron_expression')
ok('flow is linear (no routers/loops/pieces)', order.every((s) => s.type === 'CODE' || s === flow.trigger))
ok('last step is run_summary', order[order.length - 1].name === 'run_summary')

const outputs = {}
let failedStep = null
for (const step of order) {
  if (step.type !== 'CODE') continue
  try {
    outputs[step.name] = await runStep(step, outputs)
  } catch (e) {
    failedStep = step.name
    console.log('  step threw:', e.message)
    break
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
ok('follow-up draft has subject + body', (summary.followupDraft?.emailSubject ?? '').length > 0 && (summary.followupDraft?.emailBody ?? '').length > 0)
ok('no warnings on a complete run', Array.isArray(summary.warnings) && summary.warnings.length === 0, JSON.stringify(summary.warnings))
ok('draft references the actual attendee', /nina/i.test(summary.followupDraft?.emailBody ?? ''))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
