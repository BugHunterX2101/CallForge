# Gravity

Gravity is a Next.js sales-call dashboard and ingestion-worker foundation. The supplied design references are implemented at `/activity`, `/pipeline`, `/calls/call_acme`, `/tasks`, and `/settings`.

## Run locally

1. Copy `.env.example` to `.env` and set values appropriate to your environment.
2. Run `npm.cmd install`.
3. Run `npm.cmd run dev`, then open `http://localhost:3000`.

The default interface is a visibly labelled Demo Workspace. It uses no customer data. Real execution requires OAuth applications for Google, Slack, and HubSpot plus Postgres, a queue, and OpenAI credentials.

## Production boundaries

- The Prisma schema is the system of record and scopes all data by workspace.
- `worker/src/pipeline.ts` contains deterministic transcript guardrails and validated OpenAI extraction.
- OAuth token encryption, Gmail/Drive/Slack/HubSpot transport adapters, queue infrastructure, and signed Slack request verification must be configured with production secrets before deployment; never place those values in source control.
