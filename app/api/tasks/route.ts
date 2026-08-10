import { createTask } from "@/lib/store";
import { api, jsonBody } from "@/lib/api";
import type { Task } from "@/lib/types";

export async function POST(request: Request) {
  return api(async () => {
    const body = await jsonBody<{ title?: string; source?: string; due?: string; owner?: Task["owner"] }>(request);
    return createTask({
      title: body.title ?? "",
      source: body.source ?? "Manual task",
      due: body.due ?? "Due Today",
      owner: body.owner === "Client" ? "Client" : "Rep",
    });
  });
}
