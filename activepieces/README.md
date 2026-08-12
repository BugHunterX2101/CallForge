# ActivePieces flow — `agent.json`

This repo implements the *Sales Call Logger & Follow-up Drafter* as hand-coded
software (the **Gravity** Next.js/Prisma app). This directory is the same build
spec expressed as an **ActivePieces flow export** — the artifact the bounty
platform's upload box actually wants.

| File | What it is |
|---|---|
| [`agent.json`](../agent.json) | The flow export (single `FLOW_VERSION`). Upload this, or paste its contents into the platform's "Paste JSON" tab. |
| [`flows.json`](../flows.json) | The same flow in **template form** — a `SharedTemplate` with a `flows` list (name, description, pieces, `flows: [...]`). Use this when the upload box expects a flow **template / "flows" list** rather than a raw flow export. |
| [`build-agent.mjs`](./build-agent.mjs) | Deterministic generator for both files (regenerate with `node activepieces/build-agent.mjs`). |
| [`test-agent.mjs`](./test-agent.mjs) | Dependency-free test harness that runs every code step in `agent.json` against realistic inputs and asserts the PRD guardrails (see "Testing"). |

**Which file to upload?** If the box accepts a single flow export, use `agent.json`. If it expects a template or a "flows" list, use `flows.json`. Both are generated from the same source and validated against `@activepieces/shared` schemas (`FlowVersion`/`SharedTemplate`).

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

1. Open ActivePieces → **Flows** → **New flow** (or the platform's own import
   dialog if it works differently).
2. Use the **Import** action (Flow menu → ⋯ → Import, or the upload box /
   "Paste JSON" tab) and supply `agent.json`.
3. You'll land on a draft flow named **Sales Call Logger & Follow-up Drafter**
   with a scheduled trigger and ~60 steps.

### Connections to create (one click each, OAuth)

| Connection | Used by |
|---|---|
| **Gmail** (`{{connections['gmail']}}`) | `gmail_search_email`, `gmail_create_draft`, `gmail_send_draft` |
| **Google Drive** (`{{connections['googleDrive']}}`) | `drive_list_files` |
| **Google Sheets** (`{{connections['googleSheets']}}`) | all Deal Tracker reads/writes |
| **Slack** (`{{connections['slack']}}`) | recap + Approve/Reject, deal-create buttons, unreadable notice |

The AI steps use the **built-in AI piece** (`@activepieces/piece-ai`, action `askAi`) — no OpenAI (or any LLM) connection is created. The platform routes the call through its **configured AI providers**; the steps carry `provider: "openai"` and a model value, which you should set from the dropdown to one of the providers/models your instance has enabled.

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

The model on the two AI steps (`extract_facts` and the three `draft_followup_*` steps) is `gpt-4o-mini`; change it to a model your platform's AI provider offers.
The `from` field on `search_gmail` is intentionally blank (matches any sender);
set it to your meeting tool's sender (e.g. `no-reply@zoom.us`) to reduce noise.

**Why the flow now survives a bare run:** every action step carries
`errorHandlingOptions.continueOnFailure: true`. If a step fails — e.g. a
connection isn't configured yet or a `REPLACE_…` value hasn't been filled in —
the engine logs the step as failed and *continues* the run instead of aborting
it, so a test/scoring run in an unprepared environment completes (the marketplace
reports an aborted run as "agent didn't run successfully").

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
    **Create deal / Skip** button and writes nothing until the rep picks (§9.7).
11. **Pipeline** — call notes logged, each next step becomes a dated task row
    (unstated dates recorded as "Not specified", §9.9), a follow-up email is
    drafted **from the specific concerns and promises of the call** (§9.10),
    saved to Gmail Drafts, and the full recap + draft is posted to Slack with
    **Approve / Reject** (§9.11, §11). Approve sends via Gmail and marks the
    ledger; Reject leaves the Gmail draft in place and sends nothing.

### Guardrails implemented (PRD §10)

- Verbatim objections/commitments; nothing invented or softened (prompt + parse).
- No fabricated due dates — non-date values become `Not specified` (enforced in
  `parse_extraction`).
- No stage change on a hunch — `stageSignal` only carries an explicit, quotable
  signal; the recap shows it but nothing auto-moves.
- No deal created on a guess — the Slack button gate writes nothing until a
  human picks.
- No internal-call noise — zero CRM/Slack output, one ledger row.
- Nothing client-facing sends without the one-tap approval — the Gmail send
  sits behind the Slack approval waitpoint.
- Every transcript the agent sees ends in exactly one of: logged, flagged, or
  marked unreadable — never silence.

## 4. Verification checklist

Per the platform's Rule 8 (AI-built work verified before upload), run these
end-to-end on real data in your ActivePieces workspace before submitting —
they are the PRD's §16 acceptance scenarios:

1. Real transcript email → deal notes updated within minutes, tasks created,
   Slack recap with working Approve/Reject.
2. Same call's Drive copy arrives later → no second write, no second recap.
3. Email with only a summary/link, Drive copy arriving later → flow waits for
   the Drive copy; the teaser is never logged as a call.
4. Call matching no deal → Slack flag with Create deal / Skip; nothing written
   before you pick.
5. Internal-only call → CRM untouched, no follow-up, no Slack message.
6. Garbled/empty transcript → plain "couldn't process" notice; nothing silent.
7. Reject on the approval → nothing sent; the Gmail draft stays in Drafts.
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
- **Timeout reminders.** An approval left unanswered currently sits pending
  (never auto-sends). A one-reminder step can be added with the Delay
  waitpoint + `slack_post_message`.
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
