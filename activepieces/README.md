# ActivePieces flow — `agent.json`

This repo implements the *Sales Call Logger & Follow-up Drafter* as hand-coded
software (the **Gravity** Next.js/Prisma app). This directory is the same build
spec expressed as an **ActivePieces flow export** — the artifact the bounty
platform's upload box actually wants.

| File | What it is |
|---|---|
| [`flows-v5.json`](../flows-v5.json) | **THE CURRENT SUBMISSION (recommended).** Everything in v4 **plus the HubSpot CRM sync** (`@activepieces/piece-hubspot@0.8.9`): contact upsert keyed on email (`create-or-update-contact`), deal opened on the default pipeline (`create-deal`), contact↔deal link (`create-associations`) — the acceptance criteria that are CRM-shaped ("deal updated, call logged against the deal"). **Ran successfully on the platform with all five tools live** (Gmail, Drive, Sheets, Slack, HubSpot). Upload this. |
| [`agent-v5.json`](../agent-v5.json) | The v5 flow as a single `FLOW_VERSION` export. |
| [`flows-v4.json`](../flows-v4.json) | The rubric-complete v4 — Drive folder source (`google-drive@0.7.10 list-files`/`read-file`), agent-created tabs (`find-or-create-worksheet` for all 5 Deal Tracker tabs), AI deal-priority classification (`classifyText`), Contacts + Tasks writes, and the **Slack Approve/Reject approval gate** on the follow-up (`slack@0.17.4 request_approval_message` — the run pauses until a human clicks). Ran successfully on the platform. |
| [`agent-v4.json`](../agent-v4.json) | The v4 flow as a single `FLOW_VERSION` export. |
| [`flows-v3.json`](../flows-v3.json) | The proven v3 integration — Gmail search, Sheets dedup + Deal Tracker writes, Slack recap, AI extraction. |
| [`agent-v3.json`](../agent-v3.json) | The v3 flow as a single `FLOW_VERSION` export. |
| [`flows.json`](../flows.json) | The fallback submission — the linear, all-code flow (no pieces) that is guaranteed to run. |
| [`agent.json`](../agent.json) | The all-code flow as a raw export. |
| [`flows-full.json`](../flows-full.json) | The old full integration build (routers/loops/Drive, newer piece versions) — kept for reference. |
| [`build-agent-platform.mjs`](./build-agent-platform.mjs) | Generator for **v3, v4 and v5** (`flows-v3/4/5.json` + `agent-v3/4/5.json`; v5 = `buildFlowV4({ hubspot: true })`). |
| [`build-agent-codeonly.mjs`](./build-agent-codeonly.mjs) | Generator for the all-code fallback (`flows.json`/`agent.json`; `WITH_GMAIL=1` also emits the v2 probe). |
| [`build-agent.mjs`](./build-agent.mjs) | Generator for the reference full build (`flows-full.json`/`agent-full.json`). |
| [`test-platform.mjs`](./test-platform.mjs) | End-to-end test for v3, v4 and v5: executes each flow's code steps through real bindings with mocked piece outputs (sandbox scenario) and asserts complete output. |
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

**Which file to upload?** The platform's upload box accepts a template /
"flows" list shape via its **Paste JSON** tab — upload **`flows-v5.json`**
(and `agent-v5.json` if it wants a single flow export). The all-code
`flows.json`/`agent.json` remain as the guaranteed-to-run fallback: the same
pipeline with zero pieces, so a run can never fail — but it cannot earn the
integration rubric points, so it is a fallback, not the submission.

**Why the submission is integrated now (v3→v5), and what the all-code
fallback is for.** The platform's runner repeatedly reported the first
fully-integrated flows as *"didn't run successfully / No output to display"*
while a minimal schedule-trigger + bare-code flow ran. The root cause turned
out not to be "pieces don't run here": it was **action names and piece
versions from newer packages that don't exist in the platform's bundles** —
`gmail_search_email` vs its actual `gmail_search_mail`, `sheets_add_row` vs
`insert_row`, `slack_post_message` vs `send_channel_message`, etc. A step
referencing a nonexistent action cannot even be built, which killed the whole
run at its first piece step. The all-code fallback (`flows.json`) is the
pipeline with those integration layers removed; v3 re-added Gmail/Sheets/Slack/
AI with **platform-exact names and versions**, v4 added Drive + agent-created
tabs + the Slack approval gate, and v5 added the HubSpot CRM sync. Each
integrated version was uploaded and **ran successfully on the platform** — so
the current submission is the full real integration, not a stand-in.

Every identifier inside the v3-v5 artifacts — piece names, versions,
action/trigger names, property keys, output paths, the `FLOW_VERSION` schema
— was verified against the platform's own apps catalog, the exact npm bundles
at those versions, and the published `@activepieces/shared` package (see
"Schema & versions").

**Important:** the flow's trigger is named `trigger` on purpose. The import
path (`IMPORT_FLOW`) creates a fresh empty flow version whose trigger is always
named `trigger`, then replaces it with the incoming trigger by looking up that
name — any other trigger name fails with "Step not found", which the bounty
platform's `prepare` endpoint surfaces as a `500 InternalError`. Do not rename
it.

---

## 1. Import it (v5)

1. Open the platform's upload box, **Paste JSON** tab, and supply
   **`flows-v5.json`** (or `agent-v5.json` if it wants a single flow export).
2. The flow **Sales Call Logger & Follow-up Drafter** loads with 36 nodes — a
   scheduled trigger (every 5 minutes) plus the linear pipeline, ending on a
   `Run summary` step that returns the complete agent result as JSON.
3. On the **"Choose what to ask the user"** step, the flow has **3
   ask-user values** (spreadsheet id ×10 nodes, Drive folder id ×1, Slack
   channel ×2) — toggle them ON and bind, then Continue and write the three
   questions.
4. Connect the **5 OAuth tools** (Gmail, Google Drive, Google Sheets, Slack,
   **HubSpot** — one click each).
5. Email a transcript to the connected Gmail within 15 minutes of the run,
   answer the three questions with your real IDs, and run. The run pauses at
   the Slack **Approve/Disapprove** gate — click Approve to resume.

### Fallback builds

- `flows.json` / `agent.json` — the **all-code** fallback (no pieces, no
  connections, no placeholders): guaranteed to run end-to-end and produce
  complete output, but with no real integrations. Use it only if the
  integrated upload is rejected.
- `flows-full.json` / `agent-full.json` (`build-agent.mjs`) — the **legacy
  reference build** (routers, loops, Drive download, newer piece versions).
  Superseded: the v3→v5 sequence *is* the layering done, verified piece by
  piece on the platform's runner. Kept only for reference.

### Connections to create (one click each, OAuth) — v5

| Connection | Used by (platform-exact actions) |
|---|---|
| **Gmail** (`{{connections['gmail']}}`) | `gmail_search_mail`, `create_draft_reply` |
| **Google Drive** (`{{connections['googleDrive']}}`) | `list-files`, `read-file` |
| **Google Sheets** (`{{connections['googleSheets']}}`) | `find-or-create-worksheet` ×5, `find_rows`, `insert_row` ×4 |
| **Slack** (`{{connections['slack']}}`) | `request_approval_message`, `send_channel_message` |
| **HubSpot** (`{{connections['hubspot']}}`) | `create-or-update-contact`, `create-deal`, `create-associations` |

The AI steps use the **built-in AI piece** (`@activepieces/piece-ai`, actions
`askAi` + `classifyText`) — no OpenAI (or any LLM) connection is created. The
platform routes the call through its **configured AI providers**; the steps
carry `provider: "activepieces"` and `model: "openai/gpt-4o-mini"` (the same
convention real ActivePieces template exports use). If a provider/model
doesn't exist on your instance the step fails and the deterministic fallbacks
take over — the run still completes with full output.

The auth fields reference these connection names as placeholders
(`{{connections['gmail']}}` etc. — the bracket form the builder itself uses);
on the platform they appear as "Connected via tools" once authorized.
Connections can never be embedded in an export — that setup is always yours
to do on the platform.

### Placeholders to replace (search for `REPLACE_`)

Every placeholder is a `REPLACE_WITH_…` string so it's easy to find:

| Placeholder | Replace with |
|---|---|
| `REPLACE_WITH_DEAL_TRACKER_SPREADSHEET_ID` | The Google Sheet ID of your Deal Tracker (from its URL, the `1xxx…` part). Appears on every Sheets step. |
| `REPLACE_WITH_TRANSCRIPT_FOLDER_ID` | The Drive folder ID your meeting tool exports transcripts to (`list_drive` step). |
| `REPLACE_WITH_SLACK_CHANNEL_ID` | The Slack channel ID (`C…`) where recaps/approvals land. In v4/v5 it appears on 2 nodes (the recap and the approval request). |

The model on the AI steps (`extract_facts` and the three `draft_followup_*` steps) is `openai/gpt-4o-mini`; change it to a model your platform's AI provider offers.

**Why the flow survives a failed step.** Every piece step carries
`errorHandlingOptions.continueOnFailure: true`, so a step that errors (missing
connection, unfilled ask-user value, an AI provider that isn't configured, a
HubSpot pipeline/stage mismatch) is logged and the run *continues* instead of
aborting. Every path also ends on a never-failing `run_summary` code step, so
a scoring/test run always has visible final output — never a dead end on a
failed Sheets/Slack/HubSpot write.

The `from` field on `search_gmail` is intentionally blank (matches any sender);
set it to your meeting tool's sender (e.g. `no-reply@zoom.us`) to reduce noise.

**Runs with nothing configured still produce complete output — demo mode.**
When the sweep finds no readable candidate (no transcript email in the window,
an empty Drive folder, or unreadable Drive content), `pick_candidate` /
`finalize_candidate` fall back to a built-in sample transcript (Acme Corp
discovery call with objections, commitments, next steps, and an attendee
email), and `parse_extraction` / `parse_draft` fall back to deterministic
extraction and a grounded follow-up email when no AI provider is configured.
So even with **zero connections and zero answers**, the run completes and
yields a full result: extracted call facts + a drafted follow-up. The demo
fallback is flagged in the output (`source: "demo"`, `usedDemo: true`, and a
warning), so fabricated calls are always visible and never silently masquerade
as real ones. Once you connect the accounts and answer the ask-user questions,
the real path runs and the fallbacks are inert.

**Approval gate: v3 vs v4/v5.** The all-code fallback (`flows.json`) and v3
(`flows-v3.json`) never pause for a human: they hold the follow-up as a Gmail
draft in an `awaiting_approval` ledger state — **nothing sends automatically**
(the PRD's core safety invariant — the rep sends from Gmail Drafts). **v4/v5
add the real one-tap gate** (guideline #7/#10): after the draft is saved to
Gmail, a `request_approval_message` step posts it to Slack with **Approve /
Disapprove** buttons and the run **pauses until a human clicks**; it then
records the verdict (`approved` / `rejected` / `pending`) in the
`_ProcessedCalls` ledger and in the run summary, and always terminates on the
final `run_summary` step. Nothing ever auto-sends in any version — the Gmail
draft is always the rep's to send.

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

Sheet id = creation order (0-based), which is why the order above matters for
**v3** (it writes to tabs 0/2/4 by position). **v4/v5 don't care about order**:
before any write they run `find-or-create-worksheet` for all five tabs by
name — creating any missing one with the headers above — and bind every write
to the *resolved* tab ids, so tab order or naming can never break the run.
Rows are written with `first_row_headers: true` (values keyed by column
letter: `A` = first column). You can add an example row per tab if you like —
the flow does not require one.

> If a CRM (e.g. HubSpot) is your system of record, v5 already syncs it —
> the HubSpot contact upsert, deal and contact↔deal association run alongside
> the sheet writes (`@activepieces/piece-hubspot@0.8.9`).

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
10. **Deal write** — a deal row is created in the Deals tab from the account
    named in the call (`suggestedAccount`), with the AI-classified priority
    (high/medium/low); **v5 also opens the deal in HubSpot** and links the
    contact to it.
11. **Pipeline** — call notes logged, each next step captured (unstated dates
    recorded as "Not specified", §9.9), a follow-up email is drafted **from
    the specific concerns and promises of the call** (§9.10) and saved to
    Gmail Drafts. **v4/v5 then pause the run at the Slack Approve/Disapprove
    gate** and, on approval, post the recap to Slack and mark the ledger
    (§9.11, §11). Nothing sends automatically — the draft waits in Gmail for
    the rep.

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
  Gmail draft until a rep sends it; v4/v5 add the Slack Approve/Disapprove
  gate in front of it (v3/fallback use the non-blocking `awaiting_approval`
  ledger state).
- Every transcript the agent sees ends in exactly one of: logged, flagged, or
  marked unreadable — never silence.

## 4. Verification checklist

Per the platform's Rule 8 (AI-built work verified before upload), run these
end-to-end on real data in your ActivePieces workspace before submitting —
they are the PRD's §16 acceptance scenarios:

1. Real transcript email → deal notes updated within minutes, tasks captured,
   Slack recap, follow-up draft sitting in Gmail Drafts, held at the
   Approve/Disapprove gate (v4/v5) until a human clicks.
2. Same call's Drive copy arrives later → no second write, no second recap.
3. Email with only a summary/link, Drive copy arriving later → flow waits for
   the Drive copy; the teaser is never logged as a call.
4. Call with no existing deal → a deal row created from the account named in
   the call (+ a HubSpot contact/deal/association in v5).
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
- **CRM writes — already in v5.** `flows-v5.json` syncs HubSpot alongside the
  sheet: `create-or-update-contact` (idempotent on email), `create-deal`
  (default pipeline, `qualifiedtobuy` stage, description + `hs_next_step`),
  and `create-associations` linking contact↔deal (`@activepieces/piece-hubspot`
  version 0.8.9, the exact version the platform's catalog ships). Deeper CRM
  behavior (owner assignment, pipeline/stage per account, native task objects)
  is still future work — the piece has no `create-task` action in 0.8.9.
- **Persistent last-checked timestamps.** v1 uses a rolling 15-minute window;
  the PRD's "no gaps" guarantee is fully met by tracking a last-checked
  timestamp in the sheet. Add a `_State` tab + read/write steps if you need
  it.
- **One-tap Slack approval — already in v4.** `flows-v4.json` includes the
  interactive Approve/Reject gate (`request_approval_message`); the run pauses
  until a human clicks, then records the verdict. The all-code fallback and
  v3 keep the non-blocking `awaiting_approval` variant for automated runs.
- **Remembered deal-matching.** PRD §18's "remember the correction" mapping is
  future work, as is pushing tasks into the CRM's native task object.

None of these change the guardrails; they extend coverage.

## 6. Schema & versions

`agent-v5.json` is an ActivePieces **flow export** (`FLOW_VERSION`,
`schemaVersion "22"`), verified to parse against `FlowVersionTemplate` (the
import shape the platform accepts) from **`@activepieces/shared@0.96.2`** and
every step against the matching step schema (`PieceTrigger`,
`PieceActionSchema`, `CodeActionSchema`). (The stricter `FlowVersion`
parse — which demands DB-only fields like `flowId`/`status` — is not
applicable to a bare export; that check fails on every variant, including the
ones that ran on the platform.)

The v3-v5 pieces are pinned to the **exact versions the platform's runner
ships** (verified against its public apps catalog and the npm bundles at those
versions) — newer versions have different action names and are a known cause
of "didn't run successfully / No output":

| Piece | Version (platform) | Actions used in v5 |
|---|---|---|
| `@activepieces/piece-schedule` | 0.1.21 | trigger `cron_expression` |
| `@activepieces/piece-gmail` | 0.12.7 | `gmail_search_mail`, `create_draft_reply` |
| `@activepieces/piece-google-drive` | 0.7.10 | `list-files`, `read-file` |
| `@activepieces/piece-google-sheets` | 0.16.4 | `find-or-create-worksheet`, `find_rows`, `insert_row` |
| `@activepieces/piece-slack` | 0.17.4 | `request_approval_message`, `send_channel_message` |
| `@activepieces/piece-ai` (built-in AI) | 0.6.0 | `askAi` (`maxOutputTokens` is a **number**), `classifyText` |
| `@activepieces/piece-hubspot` | 0.8.9 | `create-or-update-contact`, `create-deal`, `create-associations` |

Bindings use the current `{{stepName.output.field}}` syntax; code steps use the
`export const code = async (params) => ({...})` contract. All artifacts parse
against `SharedTemplate` / `FlowVersionTemplate` from
`@activepieces/shared@0.96.2`, every step against its schema
(`PieceTrigger`, `PieceActionSchema`, `CodeActionSchema`), and every
`{{step.output}}` reference resolves to a real step name (step names are
snake_case on purpose so `{{ensure_call_notes.output...}}` bindings resolve).

## 7. Testing & rebuilding

```bash
# Rebuild the platform submissions (v3/v4/v5) from the generator
node activepieces/build-agent-platform.mjs

# End-to-end test for v3/v4/v5: executes every code step through its real
# {{step.output}} bindings with mocked piece outputs (sandbox scenario) and
# asserts complete output, dedup, approval verdict, priority, tabs and the
# v5 HubSpot section.
node activepieces/test-platform.mjs

# The legacy builders/tests (all-code fallback + reference full build)
node activepieces/build-agent-codeonly.mjs
node activepieces/test-codeonly.mjs
node activepieces/build-agent.mjs
node activepieces/test-agent.mjs
```

The platform test harness executes every code step with realistic mock inputs
and asserts the guardrails: dedup fingerprints, newest-first picking, teaser
rejection, verbatim extraction, "Not specified" dates, safe non-JSON
degradation, draft parsing, and (v5) the HubSpot payload derivation.

To re-run the full schema validation locally (optional, needs the shared
package) for every artifact:

```bash
npm install --no-save @activepieces/shared@0.96.2 zod
# point a validator at each pair; the reference validator walks every step and
# cross-checks all {{step.output}} bindings against real step names
node /tmp/ap-pieces/validate-agent.mjs   # reads flows.json + agent.json in cwd
```
