# Sales Call Logger & Follow-up Drafter
**Product Requirements Document — built on Gravity**

Status: Draft v1.0 &nbsp;|&nbsp; Last updated: August 9, 2026

This PRD turns the Sales Call Logger & Follow-up Drafter bounty into a concrete build spec, checked line-by-line against the platform's Agent Assignment Guidelines.

## At a glance

| | |
|---|---|
| **Trigger** | Scheduled sweep, every 5 minutes. Set up once, never restarted. |
| **Watches** | The transcript email from the meeting tool, and the transcript file it saves to Drive — first to arrive wins, both are first-class. |
| **System of record** | A connected CRM if one exists; otherwise a Deal Tracker sheet the agent builds and seeds itself. |
| **Approval pattern** | Slack approval, one tap, embedded in the call recap. Only the follow-up email is gated. |
| **Setup questions** | 4, and two of them try to answer themselves first. |

## Contents

1. [Summary](#1-summary)
2. [Problem](#2-problem)
3. [Goals](#3-goals)
4. [Success metrics](#4-success-metrics)
5. [Target user](#5-target-user)
6. [Trigger & data sources](#6-trigger--data-sources)
7. [Setup questions](#7-setup-questions)
8. [First-run setup & data model](#8-first-run-setup--data-model)
9. [Core workflow](#9-core-workflow)
10. [AI behavior & guardrails](#10-ai-behavior--guardrails)
11. [Approval & notification design](#11-approval--notification-design)
12. [Edge cases](#12-edge-cases)
13. [Memory & state](#13-memory--state)
14. [Non-functional requirements](#14-non-functional-requirements)
15. [Compliance checklist](#15-compliance-checklist-against-the-agent-assignment-guidelines)
16. [Testing & acceptance criteria](#16-testing--acceptance-criteria)
17. [Open questions & risks](#17-open-questions--risks)
18. [Future considerations](#18-future-considerations)

---

## 1. Summary

The agent watches the two places a sales call already leaves a trace — the transcript email and the Drive export — and turns whichever arrives first into finished after-call work: the deal updated, notes written up against the right contact, next steps turned into owned and dated tasks, and a follow-up email drafted from what was actually discussed. Everything internal happens without asking. The one thing that touches the client — the follow-up email — waits for a single tap on the Slack recap. The rep never uploads a transcript, never opens the CRM to remember what was said, and never sends a follow-up days late because the call slipped their mind.

## 2. Problem

Sales reps lose deals to their own admin backlog, not to the client. A call ends, the rep moves to the next thing, and three things quietly fail to happen: the CRM doesn't get updated, the specifics of the conversation live only in the rep's memory, and the follow-up email — if it goes out at all — goes out once the client has mentally moved on. None of these failures look dramatic in the moment. They compound. A pipeline that "looks stale" is usually just a pipeline nobody updated after the calls that mattered.

## 3. Goals

1. Every client call updates the deal — stage and structured notes — within minutes, with no typing from the rep.
2. Every objection and every commitment raised on the call is recorded against the contact, in the language actually used, never softened or inferred.
3. Every next step, stated or implied, becomes a task with a correct owner and a real or explicitly-unknown due date.
4. A follow-up email grounded in the specific concerns and specific promises of that call is one tap from sending.
5. No call — successful, ambiguous, or unreadable — ever leaves zero trace.

### Non-goals

- **Not a transcription tool.** The agent consumes a transcript the meeting tool already produced; it does not record or transcribe calls itself.
- **Not a CRM replacement.** It updates an existing CRM where one exists. The Deal Tracker sheet is a fallback for users without one, not a new system every user gets pushed onto.
- **Not autonomous sending.** No client-facing email leaves without an explicit human tap — in this version, with no exceptions and no auto-graduation (see §18).
- **Not a meeting scheduler.** The agent reacts after a call has already happened; booking, rescheduling, and reminders are out of scope.

## 4. Success metrics

- **Time to CRM update:** ≥95% of client calls reflected in the deal within 10 minutes of the transcript landing.
- **Follow-up latency:** median time from call end to a follow-up email awaiting approval is under an hour, not days.
- **Trace completeness:** 100% of transcripts the agent sees end in exactly one of three states — logged, flagged for input, or explicitly marked unreadable. Zero end in silence.
- **Attribution accuracy:** zero next-steps logged against the wrong owner — this is a trust metric, not a nice-to-have (see §10).
- **No double-logging:** zero duplicate CRM writes or duplicate follow-ups from a call that arrived by both email and Drive.

## 5. Target user

A quota-carrying account executive or sales rep who runs multiple external calls a week through a meeting tool that emails and saves a transcript (Gong, Fireflies, Fathom, Otter, Zoom, or similar), lives in Slack day-to-day, and either already has a CRM or has been tracking deals informally enough that "informally" is part of the problem. The agent's configuration is entirely per-user (§8, §15), so the same build can be handed to a second rep on the team without touching the workflow itself — only its variables.

## 6. Trigger & data sources

The agent runs on a single scheduled sweep — every 5 minutes is the working default — and never needs a manual kick-off once it's live. Each sweep checks two places, and both are treated as first-class:

- **The Gmail piece:** the transcript email the meeting tool sends after each call. This only counts as the source of truth when the *full transcript* is actually in the email — a summary or a "view your transcript" link is not treated as the call (see §12).
- **The Drive piece:** the transcript file the meeting tool exports into the user's Drive.

Whichever of the two lands first is what gets processed, within minutes of arriving. The other copy, when it shows up, is recognized and suppressed rather than reprocessed (§13).

## 7. Setup questions

Four questions, asked once, in plain language. Two of them try to answer themselves before asking.

| # | Question | Why the agent needs it | Tries to self-answer first? |
|---|---|---|---|
| 1 | "Which CRM do you use for deals — or should I set one up for you?" | Decides whether deal, contact, and stage writes go to a real CRM or the self-built Deal Tracker sheet | Yes — proposes any CRM connector already authorized on the account; only asks blind if none exists |
| 2 | "Which tool sends you call transcripts?" (Gong / Fireflies / Fathom / Otter / Zoom / Other) | Lets the agent recognize the transcript sender in Gmail and the shape of the Drive export | Partially — can shortlist from recent Gmail senders, but confirms rather than assumes, since a wrong guess here breaks the whole flow silently |
| 3 | "Where should I send call recaps and approvals — a channel or your DMs?" | Every recap and every one-tap approval happens here | No — this is a preference only the rep can state |
| 4 | "Which Drive folder does [tool] save transcripts to?" | Tells the agent where to watch | Yes — scans Drive for a folder matching the chosen tool's naming pattern first; only asks if nothing turns up |

## 8. First-run setup & data model

What the agent creates depends on the answer to Question 1.

**If a CRM is connected:** the agent writes into it directly and does not build parallel deal/contact structures. It still creates one thing for itself — a small internal memory table (§13) — because the CRM has no concept of "have I already logged this transcript."

**If no CRM is connected:** the agent builds a Deal Tracker sheet on first run, with one example row filled in on every visible tab so the format is obvious, and sends the rep a one-line Slack message with the link. From that point the rep only ever enters data into it if they choose to — never structure.

| Tab | Columns |
|---|---|
| **Deals** | Deal ID, Deal Name, Account, Primary Contact, Stage, Value, Last Call Date, Last Updated, Owner |
| **Contacts** | Contact ID, Name, Email, Account, Role, Linked Deal(s) |
| **Call Notes** | Note ID, Deal ID, Contact ID, Call Date, Summary, Objections Raised, Commitments Made, Source (Email/Drive), Transcript Link |
| **Tasks** | Task ID, Deal ID, Description, Owner, Due Date, Status, Source Call |
| **_ProcessedCalls** *(hidden)* | Call Fingerprint, First-Seen Source, Processed At, Result, Deal ID, Follow-up Status |

The `_ProcessedCalls` tab exists in both branches — as a sheet tab in the fallback case, or as a standalone Storage-piece table when a real CRM is in use.

## 9. Core workflow

1. **Sweep fires.** Every 5 minutes, check both sources for anything new since the last run.
2. **Gmail check.** Any message matching the configured transcript-tool sender since last sweep is pulled. If it's summary-only or a link, it's set aside — it is not the transcript (§12).
3. **Drive check.** Any new file in the configured folder since last sweep is pulled.
4. **Fingerprint & dedup.** Each candidate is fingerprinted (attendees, call date, and a hash of the transcript body) and checked against `_ProcessedCalls`. A match means this call is already logged — skip silently, no second write, no second recap (§13).
5. **Readability check.** Garbled, empty, or otherwise unusable transcripts skip straight to a plain "this one didn't process" notice (§12) — no matching is attempted on unreadable input.
6. **Attendee check.** If every participant is internal, the call is logged to `_ProcessedCalls` as skipped and nothing else happens — no CRM write, no follow-up, no per-call Slack message. Noise is a cost too.
7. **Deal & contact matching.** External attendees are matched against CRM contacts.
   - One clear match → continue automatically.
   - Multiple plausible deals on the same account → the agent does not guess. It posts the candidates as Slack buttons and waits.
   - No match at all → the agent posts its best guess for a new deal, with a create-it button, and writes nothing until the rep confirms.
8. **Stage & notes.** Once the deal is confirmed, the agent only moves the stage on an explicit signal in the transcript (a clear ask to move forward, a contract requested, and so on) — when it's ambiguous, the stage is left alone and the call is still logged in full. Notes are written from what was actually said: summary, objections, commitments on both sides, with a link back to the source transcript.
9. **Tasks.** Every next step — stated or implied — becomes a task with an owner (the rep, a named colleague, or the client contact) and a due date. A date that isn't stated or reasonably inferable is recorded as "Not specified," never guessed.
10. **Draft.** A follow-up email is drafted referencing the specific concerns and specific promises from the call — never a generic thank-you. The draft is saved to the rep's own Gmail Drafts *and* embedded in full in the Slack recap (see design note in §11).
11. **Recap & approval.** A single Slack message covers the whole call: deal, stage (old → new or unchanged), a short notes summary, the tasks created, and the full follow-up draft with Approve/Reject. Approve sends it via Gmail and marks the task and `_ProcessedCalls` accordingly; Reject leaves the Gmail draft in place for the rep to edit or discard, and sends nothing.
12. **Timeout.** An approval or a disambiguation prompt left untouched gets exactly one reminder, then sits pending — never auto-approved, never auto-created.

## 10. AI behavior & guardrails

- Notes reflect what was actually said. Objections and commitments are never softened and never invented.
- No task due date is fabricated — an unstated date is recorded as unstated.
- No stage change on a hunch — silence on signal means the stage doesn't move, even though the call still gets logged.
- No deal or contact match is guessed — real ambiguity always goes to the rep, because a wrong guess here is worse than a delay.
- No task is ever attributed to a guess about who owns it — a next step pinned on the wrong person is worse than a missing one, because it quietly poisons trust in every recap after it.
- Nothing client-facing sends without the one-tap approval. No exceptions in this version.

## 11. Approval & notification design

The rep lives in Slack, so this is a Slack-approval agent by design, not an email-approval one — internal work runs free, and the only thing gated is the follow-up email, shown in full on the recap rather than summarized, so approving means approving something the rep has actually read, not a vague "a draft is ready."

Two decision points aren't a plain yes/no, so they use the Slack piece's custom-button variant instead of binary approve/reject: which deal a call belongs to when more than one is plausible, and whether to create a new deal when none matches. Both leave the CRM untouched until the rep picks.

> **Design note:** the follow-up draft is written to both the Slack recap *and* the rep's own Gmail Drafts, even though the approval itself is binary. A plain Reject in Slack means "don't send this," not "this call has no follow-up" — the draft is still sitting in Gmail if the rep wants to rewrite and send it themselves. This costs one extra write per call and avoids the rep starting from a blank page every time they'd rather tweak than approve as-is.

The legacy Approval piece and the Chat UI trigger are both excluded from this build by design (§15) — the Slack piece's native approval and request-action actions cover every decision point above.

## 12. Edge cases

| Case | Behavior |
|---|---|
| Transcript email contains only a summary or a link | Not treated as the call. The agent waits for the Drive copy. |
| Neither source ever has the full transcript | The rep is told plainly that call couldn't be processed — never logged from a teaser. |
| Same call arrives by both email and Drive | One CRM update, one draft. The second arrival is recognized by fingerprint and suppressed. |
| Transcript matches no deal | Flagged in Slack with a best guess and a create-new-deal option. Nothing written until confirmed. |
| Transcript is garbled, empty, or unreadable | The rep is told the call couldn't be processed, so they can follow up manually. Never silent. |
| Internal call, no external attendees | Logged internally as skipped. CRM untouched, no follow-up, no per-call Slack noise. |
| Approval or disambiguation left unanswered | One reminder, then it sits pending. Silence is never read as a yes. |
| Multiple deals plausible on one account | Candidates posted as buttons; the agent does not pick for the rep. |

## 13. Memory & state

`_ProcessedCalls` is what makes the agent stateful across runs rather than repeating itself every sweep. Each row records a call's fingerprint, which source it was first seen from, when it was processed, what the outcome was (logged, skipped-internal, flagged-no-match, flagged-unreadable), and — where applicable — the resulting deal and the follow-up's current status. This is the single piece of storage that turns "the same call arriving twice" from a duplicate-follow-up risk into a one-line no-op, and it's what lets a paused approval resume correctly hours or days later instead of re-triggering from scratch.

## 14. Non-functional requirements

- **Latency:** CRM update and Slack recap within minutes of the transcript landing, not the next sweep after that.
- **No gaps between sweeps:** each source tracks its own "last checked" timestamp, so a delayed run doesn't cause a transcript to be skipped entirely.
- **No silent failure:** every transcript the agent sees ends in exactly one of logged, flagged, or explicitly marked unprocessable — never nothing.
- **Idempotency:** re-running a sweep over the same window never produces a second CRM write or a second email for a call already in `_ProcessedCalls`.

## 15. Compliance checklist against the Agent Assignment Guidelines

| # | Guideline | How this agent meets it |
|---|---|---|
| 1 | One-click sign-ins only | Gmail, Drive, Slack, and the CRM connector are all OAuth. No API key is ever surfaced to the rep. |
| 2 | Four or fewer setup questions | Exactly four (§7), and two attempt to answer themselves before asking. |
| 3 | Agent creates what it needs | Deal Tracker sheet — with an example row on every tab — is self-built when no CRM is connected (§8). |
| 4 | No repeated homework | Fully sweep-driven; the rep uploads nothing, ever. The one repeated action is a one-tap Slack reply, which is the pattern's explicit exception. |
| 5 | A real trigger | Scheduled sweep, set up once, never manually restarted (§6). |
| 6 | The agent remembers | `_ProcessedCalls` (§13) carries state across every run. |
| 7 & 10 *(the guidelines state this rule twice — a summary at #7, the full pattern catalog at #10)* | Approval gates where they belong | Only the client-facing follow-up is gated; CRM, notes, and tasks run free (§11). Slack approval chosen because the rep lives in Slack, per the platform's own routing guidance. |
| 8 | AI-built work is verified before upload | Ten scenarios (§16) are required to pass end-to-end, on real data, before this agent is submitted. |
| 9 | Nothing hardcoded | CRM connector, Slack destination, Drive folder, transcript-tool pattern, and the rep's own address are all setup-time variables, not values typed in while testing. |
| — | Two things to avoid | The legacy Approval piece and the Chat UI trigger are both excluded by design (§11). |

## 16. Testing & acceptance criteria

Per Rule 8, this list — run end-to-end on real transcripts, watched personally, under the Publish Gate before it's lifted — is what "done" means here, not a workflow that merely looks complete.

1. A real transcript email with the full transcript in the body → deal updates within minutes, notes logged, tasks created, Slack recap posted with a working Approve/Reject.
2. The same call's Drive copy lands a few minutes later → confirmed no second CRM write, no second recap.
3. A transcript email with only a summary, Drive copy arriving later → confirmed the agent waits for Drive rather than logging from the summary.
4. A call matching no existing deal → Slack flag with a create-new-deal option; confirmed nothing is written before it's confirmed.
5. A call plausibly matching two open deals on one account → disambiguation buttons appear; confirmed the correct deal is only written after a reply.
6. An internal-only call → CRM untouched, no follow-up drafted, no per-call Slack message.
7. A garbled or empty transcript → plain "couldn't process" notice; nothing silently dropped.
8. An approval left untouched past the timeout window → one reminder sent, confirmed no auto-send.
9. A Reject on the approval → confirmed no email sent, and the draft is still sitting in Gmail.
10. A week of real calls run back-to-back → confirmed the sweep cadence holds and nothing is missed between runs.

## 17. Open questions & risks

- **Stage-transition signals** need to be mapped against the rep's actual pipeline stage names during build — this can't be fully generalized in advance, and the safe default is to log the call in full and leave the stage alone whenever the signal is ambiguous.
- **CRM connector catalog:** the platform guidelines confirm HubSpot as an OAuth-capable piece; Question 1's option list should only ever offer CRMs actually available in Gravity's piece catalog, not an assumed list.
- **Implied next steps** carry some false-positive risk since they're inferred rather than stated outright — the recommendation is to extract conservatively and lean on the owner/date fields being explicit rather than trying to catch every soft commitment.
- **Multi-owner calls:** when more than one person from the vendor side is on a call, the recap and approval should go to the deal's CRM owner, not necessarily whoever happened to be on the call.
- **Transcript retention:** notes should always carry a link back to the source (the Drive file or the specific Gmail message) rather than a copy of the transcript itself, so there's one place the raw record lives.

## 18. Future considerations

- **Graduation is deliberately not pursued here.** No two follow-up emails are alike, so there's no fixed template for a routine message to graduate to auto-send — the guidelines' own carve-out for graduation is narrower than this use case, and every follow-up stays one-tap indefinitely.
- Move the Slack approval to Gravity's native in-app approval surface once it ships — the guidelines note this is a drop-in replacement, not a rebuild.
- If reps end up rejecting mainly to make small edits rather than to block the email outright, that's a signal to move to the Editable Draft pattern instead of binary approval.
- Push tasks natively into the connected CRM's own task object, where the CRM supports it, instead of only the internal tracker.
- Let repeated manual corrections to deal-matching (the rep picking the same "actually it's this deal" answer for a given contact more than once) quietly become a remembered mapping, so the same ambiguity doesn't resurface call after call.
