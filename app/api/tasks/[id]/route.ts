import { updateTask, deleteTask } from "@/lib/store";
import { api, jsonBody } from "@/lib/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { id } = await params;
    const body = await jsonBody<{ title?: string; due?: string; owner?: "Rep" | "Client"; completed?: boolean }>(request);
    return updateTask(id, body);
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const { id } = await params;
    deleteTask(id);
    return { ok: true };
  });
}
