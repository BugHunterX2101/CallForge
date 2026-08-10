import { moveDeal, updateDeal, getDeal } from "@/lib/store";
import { api, jsonBody } from "@/lib/api";
import { STAGES, type Stage } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { id } = await params;
    const deal = getDeal(id);
    if (!deal) throw new Error("Deal not found");
    const body = await jsonBody<{ stage?: Stage; name?: string; account?: string; value?: number; due?: string; primaryContact?: string }>(request);
    if (body.stage !== undefined) {
      if (!STAGES.includes(body.stage)) throw new Error(`Invalid stage: ${body.stage}`);
      return moveDeal(id, body.stage);
    }
    return updateDeal(id, body);
  });
}
