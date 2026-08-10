"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useLive } from "@/lib/live";
import { contacts as seedContacts } from "@/lib/demo-data";

export default function Contacts() {
  const live = useLive();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return seedContacts
      .map((c) => ({ ...c, deal: live?.deals.find((d) => d.id === c.dealId) }))
      .filter((c) => !q || `${c.name} ${c.account} ${c.role} ${c.email}`.toLowerCase().includes(q));
  }, [live, query]);

  return (
    <AppShell>
      <main className="page">
        <div className="topline">
          <div>
            <h1 className="heading">Contacts</h1>
            <p className="desc">People Gravity has logged from your calls.</p>
          </div>
          <div className="search">
            <span className="material-symbols-outlined">search</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts..." />
          </div>
        </div>

        {rows.length === 0 && <p className="empty">No contacts match your search.</p>}

        <div className="contact-grid">
          {rows.map((c) => (
            <article className="card contact" key={c.id}>
              <div className="contact-avatar">{c.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</div>
              <div>
                <h3>{c.name}</h3>
                <div className="sub">{c.role}</div>
              </div>
              <div className="contact-meta">
                <span>
                  <label>Account</label>
                  {c.account}
                </span>
                <span className="contact-email">
                  <label>Email</label>
                  <a href={`mailto:${c.email}`}>{c.email}</a>
                </span>
                <span>
                  <label>Deal stage</label>
                  {c.deal ? <span className={`chip ${c.deal.stage === "Closed Won" ? "live" : "draft"}`}>{c.deal.stage}</span> : "—"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
