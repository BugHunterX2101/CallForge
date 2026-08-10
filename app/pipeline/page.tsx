"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Modal } from "@/components/modal";
import { api, pushToast, useLive } from "@/lib/live";
import { STAGES, type Stage } from "@/lib/types";

const fmt = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);

export default function Pipeline() {
  const live = useLive();
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<Stage>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);

  const [form, setForm] = useState({ account: "", name: "", value: "", stage: "Discovery" as Stage, primaryContact: "", due: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (window.location.search.includes("create=1")) {
      setCreateOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const deals = useMemo(() => {
    if (!live) return [];
    const q = query.trim().toLowerCase();
    return live.deals.filter((d) => {
      if (q && !`${d.account} ${d.name} ${d.primaryContact}`.toLowerCase().includes(q)) return false;
      if (selected.size > 0 && !selected.has(d.stage)) return false;
      return true;
    });
  }, [live, query, selected]);

  if (!live) {
    return (
      <AppShell>
        <main className="page">
          <div className="skeleton heading" style={{ height: 40, width: 300 }} />
          <div className="skeleton card" style={{ height: 640 }} />
        </main>
      </AppShell>
    );
  }

  const move = async (id: string, stage: Stage) => {
    try {
      await api.moveDeal(id, stage);
      pushToast(`Deal moved to ${stage}.`);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not move deal", "error");
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const deal = await api.createDeal({
        account: form.account,
        name: form.name,
        value: Number(form.value) || 0,
        stage: form.stage,
        primaryContact: form.primaryContact,
        due: form.due,
      });
      pushToast(`${deal.account} — ${deal.name} added to ${deal.stage}.`);
      setCreateOpen(false);
      setForm({ account: "", name: "", value: "", stage: "Discovery", primaryContact: "", due: "" });
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not create deal", "error");
    } finally {
      setCreating(false);
    }
  };

  const toggleFilter = (stage: Stage) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  return (
    <AppShell>
      <main className="page">
        <div className="topline">
          <div>
            <h1 className="heading">Pipeline</h1>
            <p className="desc">Manage active deals and stage progression. Drag cards between columns.</p>
          </div>
          <div className="pipeline-actions">
            <div className="search">
              <span className="material-symbols-outlined">search</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deals, accounts..." />
              <button className={`filterbtn ${showFilters ? "on" : ""}`} onClick={() => setShowFilters((v) => !v)} aria-label="Toggle filters">
                <span className="material-symbols-outlined">filter_list</span>
                <b>FILTER</b>
              </button>
            </div>
            <button className="darkbtn" onClick={() => setCreateOpen(true)}>
              ＋ New Deal
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="filterrow">
            {STAGES.map((s) => (
              <button key={s} className={`pill ${selected.has(s) ? "on" : ""}`} onClick={() => toggleFilter(s)}>
                {s}
              </button>
            ))}
            {selected.size > 0 && (
              <button className="pill clear" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            )}
          </div>
        )}

        <div className="kanban">
          {STAGES.map((stage, i) => {
            const items = deals.filter((d) => d.stage === stage);
            const sum = items.reduce((n, d) => n + d.value, 0);
            return (
              <section
                className={`column ${overStage === stage ? "over" : ""}`}
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(stage);
                }}
                onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = dragId ?? e.dataTransfer.getData("text/plain");
                  setDragId(null);
                  setOverStage(null);
                  if (id && live.deals.some((d) => d.id === id)) void move(id, stage);
                }}
              >
                <div className="columnhead">
                  <span className={`dot ${i === 0 ? "amber" : i === 3 ? "mint" : ""}`} />
                  {stage}
                  <span className="chip">{items.length}</span>
                  <span className="spacer" />
                  <span className="sum">{fmt(sum)}</span>
                </div>
                {items.map((d) => (
                  <article
                    className={`deal ${dragId === d.id ? "dragging" : ""}`}
                    key={d.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(d.id);
                      e.dataTransfer.setData("text/plain", d.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                  >
                    <div className="account">▣　{d.account}</div>
                    <h3>{d.name}</h3>
                    <div className="dealfooter">
                      <span>{d.value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
                      <span className="chip live">◉ {d.due}</span>
                    </div>
                  </article>
                ))}
                {items.length === 0 && <div className="column-empty">Drop a deal here</div>}
              </section>
            );
          })}
        </div>
      </main>

      {createOpen && (
        <Modal title="Create deal" onClose={() => setCreateOpen(false)}>
          <div className="formgrid">
            <label>
              Account
              <input className="input" value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} placeholder="e.g. Initech" autoFocus />
            </label>
            <label>
              Deal name
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Q1 Expansion" />
            </label>
            <label>
              Value ($)
              <input className="input" type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="45000" />
            </label>
            <label>
              Stage
              <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Primary contact
              <input className="input" value={form.primaryContact} onChange={(e) => setForm({ ...form, primaryContact: e.target.value })} placeholder="e.g. Nina Patel" />
            </label>
            <label>
              Next action due
              <input className="input" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} placeholder="e.g. Today, 4 PM" />
            </label>
          </div>
          <div className="modal-actions">
            <button className="ghostbtn" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className="darkbtn" onClick={create} disabled={creating || !form.account.trim() || !form.name.trim()}>
              {creating ? "Creating…" : "Create deal"}
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
