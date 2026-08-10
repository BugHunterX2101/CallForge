"use client";

import { useSyncExternalStore } from "react";
import type { Call, Deal, Draft, Integration, Snapshot, Stage, Task, WorkspaceConfig } from "./types";

// ---- Snapshot store -------------------------------------------------------

let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();
let started = false;
let eventSource: EventSource | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const fn of listeners) fn();
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getSnapshot(): Snapshot | null {
  return snapshot;
}

export async function refresh(): Promise<void> {
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) return;
    const next = (await res.json()) as Snapshot;
    if (!snapshot || next.version !== snapshot.version || next.version === snapshot.version) {
      snapshot = next;
      emit();
    }
  } catch {
    /* keep last known snapshot during transient failures */
  }
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => void refresh(), 4000);
}

export function startLive(): void {
  if (started) return;
  started = true;
  void refresh();
  if (typeof EventSource !== "undefined") {
    try {
      eventSource = new EventSource("/api/events");
      eventSource.onmessage = () => void refresh();
      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        startPolling();
      };
    } catch {
      startPolling();
    }
  } else {
    startPolling();
  }
}

export function useLive(): Snapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ---- Toasts ---------------------------------------------------------------

export type Toast = { id: number; message: string; kind: "success" | "error" | "info" };
let toastId = 0;
const toastListeners = new Set<() => void>();
let toasts: Toast[] = [];

export function pushToast(message: string, kind: Toast["kind"] = "success"): void {
  toastId += 1;
  toasts = [...toasts, { id: toastId, message, kind }];
  if (toasts.length > 4) toasts = toasts.slice(-4);
  for (const fn of toastListeners) fn();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toastId);
    for (const fn of toastListeners) fn();
  }, 3800);
}

export function subscribeToasts(cb: () => void): () => void {
  toastListeners.add(cb);
  return () => {
    toastListeners.delete(cb);
  };
}

export function getToasts(): Toast[] {
  return toasts;
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribeToasts, getToasts, getToasts);
}

// ---- Mutations ------------------------------------------------------------

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `Request to ${path} failed`);
  void refresh();
  return data as T;
}

export const api = {
  async runSweep(): Promise<{ duplicate: boolean; call?: { id: string }; error?: string }> {
    const res = await fetch("/api/demo/sweep", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Sweep failed");
    void refresh();
    return data;
  },

  async approveDraft(id: string): Promise<Draft> {
    return call<Draft>(`/api/drafts/${id}/approve`, { method: "POST" });
  },

  async rejectDraft(id: string): Promise<Draft> {
    return call<Draft>(`/api/drafts/${id}/reject`, { method: "POST" });
  },

  async saveDraft(id: string, patch: { body?: string; subject?: string; to?: string }): Promise<Draft> {
    return call<Draft>(`/api/drafts/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },

  async moveDeal(id: string, stage: Stage): Promise<Deal> {
    return call<Deal>(`/api/deals/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) });
  },

  async updateDeal(id: string, patch: { name?: string; account?: string; value?: number; due?: string; primaryContact?: string }): Promise<Deal> {
    return call<Deal>(`/api/deals/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },

  async createDeal(input: { account: string; name: string; value: number; stage: Stage; primaryContact?: string; due?: string }): Promise<Deal> {
    return call<Deal>(`/api/deals`, { method: "POST", body: JSON.stringify(input) });
  },

  async createTask(input: { title: string; source?: string; due: string; owner: Task["owner"] }): Promise<Task> {
    return call<Task>(`/api/tasks`, { method: "POST", body: JSON.stringify(input) });
  },

  async toggleTask(id: string, completed: boolean): Promise<Task> {
    // Optimistic flip for a snappy checkbox, then reconcile from the server.
    if (snapshot) {
      snapshot = {
        ...snapshot,
        tasks: snapshot.tasks.map((t) => (t.id === id ? { ...t, completed } : t)),
      };
      emit();
    }
    try {
      return await call<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ completed }) });
    } catch (e) {
      // Revert on failure.
      if (snapshot) {
        snapshot = {
          ...snapshot,
          tasks: snapshot.tasks.map((t) => (t.id === id ? { ...t, completed: !completed } : t)),
        };
        emit();
      }
      throw e;
    }
  },

  async updateTask(id: string, patch: { title?: string; due?: string; owner?: Task["owner"]; completed?: boolean }): Promise<Task> {
    return call<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },

  async deleteTask(id: string): Promise<{ ok: boolean }> {
    return call<{ ok: boolean }>(`/api/tasks/${id}`, { method: "DELETE" });
  },

  async toggleIntegration(provider: string): Promise<Integration[]> {
    return call<Integration[]>(`/api/integrations/${provider}`, { method: "POST" });
  },

  async updateConfig(patch: Partial<WorkspaceConfig>): Promise<WorkspaceConfig> {
    return call<WorkspaceConfig>(`/api/config`, { method: "PATCH", body: JSON.stringify(patch) });
  },

  async resolveCall(id: string, info: string): Promise<Call> {
    return call<Call>(`/api/calls/${id}`, { method: "PATCH", body: JSON.stringify({ info }) });
  },
};
