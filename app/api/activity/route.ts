import { NextResponse } from "next/server";
import { snapshot } from "@/lib/store";

export async function GET() {
  const s = snapshot();
  return NextResponse.json({ calls: s.calls, drafts: s.drafts, integrations: s.integrations, tasks: s.tasks, events: s.events, stats: s.stats, mode: s.mode });
}
