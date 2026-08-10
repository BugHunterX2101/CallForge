import { NextResponse } from "next/server";

/** Wrap a route handler body: 200 with JSON on success, 4xx with { error } on failure. */
export async function api<T>(fn: () => Promise<T> | T): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function jsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}
