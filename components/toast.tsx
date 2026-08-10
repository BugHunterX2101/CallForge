"use client";

import { useToasts } from "@/lib/live";

const ICONS: Record<string, string> = { success: "✓", error: "✕", info: "ⓘ" };

export function Toasts() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role="status">
          <span className="toast-icon">{ICONS[t.kind]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
