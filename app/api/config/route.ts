import { updateConfig } from "@/lib/store";
import { api, jsonBody } from "@/lib/api";
import type { WorkspaceConfig } from "@/lib/types";

export async function PATCH(request: Request) {
  return api(async () => {
    const body = await jsonBody<Partial<WorkspaceConfig>>(request);
    const allowed: (keyof WorkspaceConfig)[] = ["crm", "transcriptTool", "recapDestination", "transcriptFolder"];
    const patch: Partial<WorkspaceConfig> = {};
    for (const key of allowed) {
      const value = body[key];
      if (typeof value === "string" && value.trim()) patch[key] = value.trim();
    }
    if (Object.keys(patch).length === 0) throw new Error("No valid fields to update");
    return updateConfig(patch);
  });
}
