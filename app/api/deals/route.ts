import { createDeal } from "@/lib/store";
import { api, jsonBody } from "@/lib/api";
import type { Stage } from "@/lib/types";

export async function POST(request: Request) {
  return api(async () => {
    const body = await jsonBody<{ account?: string; name?: string; value?: number; stage?: Stage; primaryContact?: string; due?: string }>(request);
    return createDeal({
      account: body.account ?? "",
      name: body.name ?? "",
      value: body.value ?? 0,
      stage: body.stage ?? "Discovery",
      primaryContact: body.primaryContact,
      due: body.due,
    });
  });
}
