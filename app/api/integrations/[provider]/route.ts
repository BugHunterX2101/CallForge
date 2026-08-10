import { toggleIntegration } from "@/lib/store";
import { api } from "@/lib/api";
import type { Integration } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  return api(async () => {
    const { provider } = await params;
    return toggleIntegration(provider as Integration["provider"]);
  });
}
