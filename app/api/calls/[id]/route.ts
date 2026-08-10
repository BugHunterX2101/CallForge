import { resolveCall, getCall } from "@/lib/store";
import { api, jsonBody } from "@/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { id } = await params;
    const call = getCall(id);
    if (!call) throw new Error("Call not found");
    const body = await jsonBody<{ info?: string }>(request);
    return resolveCall(id, body.info ?? "");
  });
}
