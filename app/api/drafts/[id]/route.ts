import { updateDraft } from "@/lib/store";
import { api, jsonBody } from "@/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { id } = await params;
    const body = await jsonBody<{ body?: string; subject?: string; to?: string }>(request);
    return updateDraft(id, body);
  });
}
