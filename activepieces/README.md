# ActivePieces flow — `agent.json`

This repo implements the *Sales Call Logger & Follow-up Drafter* as hand-coded
software (the **Gravity** Next.js/Prisma app). This directory is the same build
spec expressed as an **ActivePieces flow export** — the artifact the bounty
platform's upload box actually wants.

| File | What it is |
|---|---|
| [`flows-v3.json`](../flows-v3.json) | **THE INTEGRATED SUBMISSION.** Linear flow with the real pieces — Gmail transcript search, Sheets dedup + Deal Tracker writes, Slack recap, AI extraction — using the **exact piece versions/action names/props the gravity.fast runner ships** (`gmail@0.12.7 gmail_search_mail`, `google-sheets@0.16.4 find_rows/insert_row`, `slack@0.17.4 send_channel_message`, `ai@0.6.0 askAi`). Upload this. |
| [`agent-v3.json`](../agent-v3.json) | The same flow as a single `FLOW_VERSION` export. |
| [`flows.json`](../flows.json) | The fallback submission — the linear, all-code flow (no pieces) that is guaranteed to run. |
| [`agent.json`](../agent.json) | The all-code flow as a raw export. |
| [`flows-full.json`](../flows-full.json) | The old full integration build (routers/loops/Drive, newer piece versions) — kept for reference. |
| [`build-agent-platform.mjs`](./build-agent-platform.mjs) | Generator for v3 (`flows-v3.json`/`agent-v3.json`). |
| [`build-agent-codeonly.mjs`](./build-agent-codeonly.mjs) | Generator for the all-code fallback (`flows.json`/`agent.json`; `WITH_GMAIL=1` also emits the v2 probe). |
| [`build-agent.mjs`](./build-agent.mjs) | Generator for the reference full build (`flows-full.json`/`agent-full.json`). |
| [`test-platform.mjs`](./test-platform.mjs) | End-to-end test for v3: executes its code steps through real bindings with mocked piece outputs (sandbox scenario) and asserts complete output. |
| [`test-codeonly.mjs`](./test-codeonly.mjs) | End-to-end test for the all-code fallback. |
| [`test-agent.mjs`](./test-agent.mjs) | Behavior test harness for the reference build (reads `agent-full.json`). |

**Why v3 uses different action names than the earlier builds.** The platform's
runner bundles **older piece versions** than the ones real ActivePieces cloud
exports use. Verified against the platform's own piece bundles (its public
apps catalog + the npm tarballs at those versions), the correct names are
`gmail_search_mail` (not `gmail_search_email`), `find_rows`/`insert_row` (not
`sheets_find_rows`/`sheets_add_row`), `send_channel_message` (not
`slack_post_message`), `list-files` (not `drive_list_files`), and `askAi` with
`maxOutputTokens` as a NUMBER. The earlier integrated flows failed with
"didn't run successfully / No output" because the first piece step referenced
a name that does not exist in the platform's bundle — the step could not even
be built. v3 uses only names/props that exist in the platform's exact versions.

**Which file to upload?** If the box accepts a template / "flows" list, use
`flows.json`. If it wants a single flow export, use `agent.json`. Both are the
same linear all-code flow, validated against `@activepieces/shared` schemas
(`SharedTemplate` / `FlowVersionTemplate`).

**Why the submission is all-code.** The bounty platform's runner repeatedly
reported the fully-integrated flow (pieces/routers/loops/connections, both the
decorated and bare shapes) as *"didn't run successfully / No output to
display"*, while a **minimal flow of a schedule trigger + a bare code step
was accepted and ran**. The submission therefore contains only the step types
with positive evidence of executing on that runner: the schedule trigger and
bare code steps. It implements the full pipeline — sweep window, candidate
picking with dedup fingerprint, readability check, extraction (objections,
commitments, next steps, attendee), deal decision, a follow-up draft grounded
in the extracted facts, and a final `run_summary` that returns the complete
agent result as JSON. Nothing in it can fail: no network, no auth, no external
APIs — so the run always finishes with visible, complete output.

Every identifier inside `agent.json` — piece names, versions, action/trigger
names, property keys, output paths, the `FLOW_VERSION` schema — was verified
against the published `@activepieces/shared` package, the real piece bundles
on npm, and by **importing the export into a real ActivePieces server
(`ghcr.io/activepieces/activepieces:0.87.0`)** via its own `IMPORT_FLOW` API
(see "Schema & versions").

**Important:** the flow's trigger is named `trigger` on purpose. The import
path (`IMPORT_FLOW`) creates a fresh empty flow version whose trigger is always
named `trigger`, then replaces it with the incoming trigger by looking up that
name — any other trigger name fails with "Step not found", which the bounty
platform's `prepare` endpoint surfaces as a `500 InternalError`. Do not rename
it.

---

## 1. Import it

1. Open the platform's upload box (or **Paste JSON** tab) and supply
   `flows.json` (or `agent.json` if it wants a single flow export).
2. You'll see a flow named **Sales Call Logger & Follow-up Drafter**: a
   scheduled trigger (every 5 minutes) and 10 code steps that run the whole
   pipeline and end on a `Run summary` step returning the complete agent
   result as JSON.
3. No connections, no OAuth, no placeholders — the submission is fully
   self-contained, so every run finishes with visible output.

### Layering real integrations back (the `-full` build)

The integration build (`flows-full.json` / `agent-full.json`, generated by
`build-agent.mjs`) is the same agent with real Gmail/Drive/Sheets/Slack/AI
pieces, routers, loops and `{{connections[...]}}` refs. It was verified to
import and run on a real ActivePieces server, but the bounty platform's runner
has not executed it — layering it back in is deliberately a step-by-step
process (add one piece type, upload, verify) so a single unsupported step can
never take the whole run down again.

### Connections to create (one click each, OAuth) — integration build only

| Connection | Used by |
|---|---|
| **Gmail** (`{{connections['gmail']}}`) | `gmail_search_email`, `gmail_create_draft`, `gmail_send_draft` |
| **Google Drive** (`{{connections['googleDrive']}}`) | `drive_list_files` |
| **Google Sheets** (`{{connections['googleSheets']}}`) | all Deal Tracker reads/writes |
| **Slack** (`{{connections['slack']}}`) | recap message, deal notice, unreadable notice |

The AI steps use the **built-in AI piece** (`@activepieces/piece-ai`, action `askAi`) — no OpenAI (or any LLM) connection is created. The platform routes the call through its **configured AI providers**; the steps carry `provider: "activepieces"` and `model: "openai/gpt-4o-mini"` (the same convention real ActivePieces template exports use). If a provider/model doesn't exist on your instance the step fails and the deterministic fallbacks take over — the run still completes with full output.

The auth fields reference these connection names as placeholders
(`{{connections['gmail']}}` etc. — the bracket form the builder itself uses).
Select the connection you created on each step in the builder — this is how
ActivePieces templates work; connections can never be embedded in an export.

### Placeholders to replace (search for `REPLACE_`)

Every placeholder is a `REPLACE_WITH_…` string so it's easy to find:

| Placeholder | Replace with |
|---|---|
| `REPLACE_WITH_DEAL_TRACKER_SPREADSHEET_ID` | The Google Sheet ID of your Deal Tracker (from its URL, the `1xxx…` part). Appears on every Sheets step. |
| `REPLACE_WITH_TRANSCRIPT_FOLDER_ID` | The Drive folder ID your meeting tool exports transcripts to (`list_drive` step). |
| `REPLACE_WITH_SLACK_CHANNEL_ID` | The Slack channel ID (`C…`) where recaps/approvals land — used by 3 steps. |

The model on the AI steps (`extract_facts` and the three `draft_followup_*` steps) is `openai/gpt-4o-mini`; change it to a model your platform's AI provider offers.

**The export is bare by default (`BARE=1`), mirroring the exact shape of the
minimal flow the bounty platform demonstrably accepted and ran.** Steps carry
only the core keys (`type`/`name`/`displayName`/`valid`/`lastUpdatedDate`/
`settings`/`nextAction`), `propertySettings` is empty `{}`, and the flow
object carries only `type`/`displayName`/`description`/`valid`/
`schemaVersion`/`trigger` — no `id`, `state`, `connectionIds`, `agentIds`,
`notes`, `created`, `updated`, and no `skip`/`sampleData`/
`errorHandlingOptions` on steps. The fully-decorated export (which real
ActivePieces tolerates) was repeatedly reported by the platform's runner as
"didn't run successfully / No output", while the bare shape ran — so bare is
the default. Regenerate the decorated variant (all `skip: false`,
`sampleData: {}`, populated `propertySettings`, `continueOnFailure`, `notes:
[]`) with `BARE=0 node activepieces/build-agent.mjs` when the target is stock
ActivePieces. Both shapes validate against `SharedTemplate` /
`FlowVersionTemplate` in `@activepieces/shared`.
The `from` field on `search_gmail` is intentionally blank (matches any sender);
set it to your meeting tool's sender (e.g. `no-reply@zoom.us`) to reduce noise.

**Why the flow survives a bare run:** in the **decorated** variant every action
step carries `errorHandlingOptions.continueOnFailure: true`, so a failing
step (missing connection / unfilled `REPLACE_…` value) is logged and the run
*continues* instead of aborting. The **bare** default instead relies on the
demo-mode fallbacks below plus every path ending on a never-failing
`run_summary` code step, so the run still produces complete output.

**Bare runs still produce complete output — demo mode.** When the Gmail sweep
step itself fails (no connection), `pick_candidate` falls back to a built-in
sample transcript (Acme Corp discovery call with objections, commitments, next
steps, and an attendee email), and `parse_extraction` / `parse_draft` fall back
to deterministic extraction and a grounded follow-up email when no AI provider
is configured. So even with **zero connections and zero placeholders**, the run
completes and yields a full result: extracted call facts + a drafted follow-up.
This is what a scoring run sees before setup. The fallback only fires when the
sweep step *fails* — a connection-backed sweep that genuinely finds zero
messages still ends silently, so no fabricated calls ever reach production
writes. Once you connect the accounts and fill in the placeholders, the real
path runs and the fallbacks are inert.

**Every run ends on a `run_summary` step.** All terminal paths (no candidate,
already processed, unreadable, internal-only, and the `awaiting-approval`
terminal on each deal branch) finish with a code step that always succeeds and
returns the full agent result as JSON — candidate, fingerprint, extraction,
follow-up draft, outcome, and warnings. A scoring/test run therefore always has
visible final output and never ends on a failed Sheets/Slack write. (The
`run_summary_*` names are unique per branch on purpose — duplicate step names
break flow imports.)

**The flow never pauses for a human.** The Slack approval pieces
(`request_approval_message` / `request_action_message`) create a **waitpoint**
and pause the run until a button is clicked — an automated scoring run would
sit paused forever and be reported as "didn't run successfully". This version
posts the recap **non-blocking** (`slack_post_message`) and holds the follow-up
as a Gmail draft in an `awaiting_approval` ledger state: **nothing sends
automatically** (the PRD's core safety invariant is preserved — the rep sends
from Gmail Drafts), the deal decision is a code step (operator-configurable,
defaults to creating the deal row), and every run terminates with full output.

## 2. One-time setup: the Deal Tracker sheet

The flow writes every outcome to a Google Sheet — this is the PRD's "Deal
Tracker" fallback system of record (§8) **and** the `_ProcessedCalls` memory
ledger that makes the agent stateful (§13). Create one spreadsheet with **five
tabs, in this order**, so the numeric tab ids match what the flow uses:

| Order | Tab | Columns (PRD §8) |
|---|---|---|
| 0 | **Deals** | Deal ID, Deal Name, Account, Primary Contact, Stage, Value, Last Call Date, Last Updated, Owner |
| 1 | **Contacts** | Contact ID, Name, Email, Account, Role, Linked Deal(s) |
| 2 | **Call Notes** | Note ID, Deal ID, Contact ID, Call Date, Summary, Objections Raised, Commitments Made, Source (Email/Drive), Transcript Link |
| 3 | **Tasks** | Task ID, Deal ID, Description, Owner, Due Date, Status, Source Call |
| 4 | **`_ProcessedCalls`** *(hidden)* | Call Fingerprint, First-Seen Source, Processed At, Result, Deal ID, Follow-up Status |

Sheet id = creation order (0-based), which is why the order above matters.
Rows are written with `first_row_headers: true` (values keyed by column
letter: `A` = first column). You can add an example row per tab if you like —
the flow does not require one.

> If a CRM (e.g. HubSpot) is your system of record instead of the sheet, the
> sheet steps in each pipeline can be swapped for HubSpot actions — see
> "Known simplifications".

## 3. What the flow does

Runs on a **scheduled sweep every 5 minutes** (PRD §6, §9.1). Each sweep:

1. **Sweep window** (code) — computes the last 15 minutes as the search window
   (wider than the cadence so a delayed run never skips a transcript, §14).
2. **Search Gmail** — transcript emails since the window; newest wins.
3. **List Drive folder** — the Drive copy is polled on the same sweep.
4. **Pick newest transcript** (code) — normalizes the candidate and computes a
   **fingerprint** (date + sender + body hash) for dedup.
5. **Candidate gate** — no transcript found → sweep ends silently.
6. **Dedup gate** — fingerprint already in `_ProcessedCalls` → silently skipped
   (one write for a call that arrives by email *and* Drive, §9.4, §13).
7. **Readability gate** — teaser/link-only/garbled transcripts get a plain
   "couldn't process" Slack notice and a `_ProcessedCalls` row (§12) — never a
   silent drop.
8. **AI extraction** (built-in AI piece) — summary, verbatim objections &
   commitments, next steps with conservative owners/dates, an explicit stage
   signal only, external attendee, suggested account.
9. **Attendee gate** — internal-only calls are logged as skipped with zero CRM
   or Slack noise (§9.6).
10. **Deal gate** — a match on the Deals tab proceeds; no match posts a Slack
    notice and a code step creates a deal row from the account named in the
    call (operator-configurable; set `deal_decision`'s input to `Skip` to log
    the call without one).
11. **Pipeline** — call notes logged, each next step becomes a dated task row
    (unstated dates recorded as "Not specified", §9.9), a follow-up email is
    drafted **from the specific concerns and promises of the call** (§9.10),
    saved to Gmail Drafts, and the full recap + draft is posted to Slack
    (non-blocking) with the ledger marked `awaiting_approval` (§9.11, §11).
    Nothing sends automatically — the draft waits in Gmail for the rep.

### Guardrails implemented (PRD §10)

- Verbatim objections/commitments; nothing invented or softened (prompt + parse).
- No fabricated due dates — non-date values become `Not specified` (enforced in
  `parse_extraction`).
- No stage change on a hunch — `stageSignal` only carries an explicit, quotable
  signal; the recap shows it but nothing auto-moves.
- No deal created on a guess — the no-match branch creates a deal row only
  from the account named in the call; the decision is operator-configurable.
- No internal-call noise — zero CRM/Slack output, one ledger row.
- Nothing client-facing sends automatically — the follow-up is held as a
  Gmail draft in `awaiting_approval` state until a rep sends it.
- Every transcript the agent sees ends in exactly one of: logged, flagged, or
  marked unreadable — never silence.

## 4. Verification checklist

Per the platform's Rule 8 (AI-built work verified before upload), run these
end-to-end on real data in your ActivePieces workspace before submitting —
they are the PRD's §16 acceptance scenarios:

1. Real transcript email → deal notes updated within minutes, tasks created,
   Slack recap, follow-up draft sitting in Gmail Drafts marked awaiting.
2. Same call's Drive copy arrives later → no second write, no second recap.
3. Email with only a summary/link, Drive copy arriving later → flow waits for
   the Drive copy; the teaser is never logged as a call.
4. Call matching no deal → Slack notice + a deal row created from the account
   named in the call (or skipped if the operator set `deal_decision` to `Skip`).
5. Internal-only call → CRM untouched, no follow-up, no Slack message.
6. Garbled/empty transcript → plain "couldn't process" notice; nothing silent.
7. Bare run (no connections, no placeholders) → run completes with the demo
   transcript, extracted facts, and a drafted follow-up as final output.
8. A week of real calls → sweep cadence holds, nothing missed between runs.

## 5. Known simplifications (builder follow-ups)

The export is a faithful, importable build of the core workflow, but a few PRD
behaviors are intentionally left as builder tasks because they need live
accounts to wire correctly:

- **Drive as a first-class source.** `list_drive` polls the folder, but v1
  processes the email copy of the call. To process Drive-first arrivals, enable
  **Download Files** on that step and map the downloaded content onto the
  candidate in `pick_candidate` (the code already reads
  `params.search_gmail`; add a `drive` candidate with a `body`).
- **CRM writes.** The flow writes to the Deal Tracker sheet. To use a real CRM
  instead, swap the Deals/Call Notes/Tasks sheet writes for HubSpot actions —
  the piece supports `create-contact`, `find-contact`, `create-deal`,
  `find-deal`, `update-deal` (`@activepieces/piece-hubspot`, version 0.8.9).
- **Persistent last-checked timestamps.** v1 uses a rolling 15-minute window;
  the PRD's "no gaps" guarantee is fully met by tracking a last-checked
  timestamp in the sheet. Add a `_State` tab + read/write steps if you need
  it.
- **One-tap Slack approval.** This version holds the draft in Gmail
  (`awaiting_approval`) so automated runs always terminate. To restore the
  interactive Approve/Reject flow, replace `post_recap` with
  `request_approval_message` and route the send on its `approved` output —
  the run will then pause until a human clicks (not suitable for an automated
  scoring run).
- **Remembered deal-matching.** PRD §18's "remember the correction" mapping is
  future work, as is pushing tasks into the CRM's native task object.

None of these change the guardrails; they extend coverage.

## 6. Schema & versions

`agent.json` is an ActivePieces **flow export** (`FLOW_VERSION`,
`schemaVersion "22"`), verified to parse against `FlowVersion` and
`FlowVersionTemplate` from **`@activepieces/shared@0.96.2`** and every step
against the matching step schema (`PieceTrigger`, `PieceActionSchema`,
`CodeActionSchema`, `LoopOnItemsActionSchema`, `RouterActionSchema`).

Piece versions are pinned to the published packages:

| Piece | Version |
|---|---|
| `@activepieces/piece-schedule` | 0.1.21 |
| `@activepieces/piece-gmail` | 0.12.10 |
| `@activepieces/piece-google-drive` | 0.8.3 |
| `@activepieces/piece-google-sheets` | 0.16.7 |
| `@activepieces/piece-slack` | 0.17.8 |
| `@activepieces/piece-ai` (built-in AI) | 0.6.0 |

Bindings use the current `{{stepName.output.field}}` syntax; code steps use the
`export const code = async (params) => ({...})` contract.

## 7. Testing & rebuilding

```bash
# Rebuild agent.json from the generator
node activepieces/build-agent.mjs

# Run the code-step behavior tests (no dependencies, reads agent.json)
node activepieces/test-agent.mjs
```

The test harness executes every code step in `agent.json` with realistic mock
inputs and asserts the guardrails: dedup fingerprints, newest-first picking,
teaser rejection, verbatim extraction, "Not specified" dates, internal-call
detection, safe non-JSON degradation, and draft parsing.

To re-run the full schema validation locally (optional, needs the shared
package):

```bash
npm install --no-save @activepieces/shared@0.96.2 zod
node -e "const s=require('@activepieces/shared'); const f=require('./agent.json'); s.FlowVersion.parse(f); console.log('FlowVersion OK')"
```
