import { rejectDraft } from "@/lib/store";
import { api } from "@/lib/api";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { id } = await params;
    return rejectDraft(id);
  });
}
