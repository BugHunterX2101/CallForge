"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Modal } from "@/components/modal";
import { api, pushToast, useLive } from "@/lib/live";
import type { Task } from "@/lib/types";

export default function Tasks() {
  const live = useLive();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", due: "Due Today", owner: "Rep" as Task["owner"] });
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    if (!live) return [];
    const q = query.trim().toLowerCase();
    return live.tasks.filter((t) => !q || t.title.toLowerCase().includes(q));
  }, [live, query]);

  if (!live) {
    return (
      <AppShell>
        <main className="page">
          <div className="skeleton heading" style={{ height: 40, width: 320 }} />
          <div className="skeleton card" style={{ height: 400 }} />
        </main>
      </AppShell>
    );
  }

  const groups = [
    ["● TODAY", filtered.filter((x) => !x.completed && x.due === "Due Today"), "#a16207"],
    ["● UPCOMING", filtered.filter((x) => !x.completed && x.due !== "Due Today"), undefined],
    ["● COMPLETED", filtered.filter((x) => x.completed), "#059669"],
  ] as const;

  const toggle = async (task: Task) => {
    try {
      await api.toggleTask(task.id, !task.completed);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not update task", "error");
    }
  };

  const remove = async (task: Task) => {
    try {
      await api.deleteTask(task.id);
      pushToast("Task removed.");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not remove task", "error");
    }
  };

  const add = async () => {
    setAdding(true);
    try {
      const task = await api.createTask({ title: form.title, due: form.due, owner: form.owner });
      pushToast(`Task created — ${task.title}.`);
      setAddOpen(false);
      setForm({ title: "", due: "Due Today", owner: "Rep" });
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not create task", "error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <AppShell>
      <main className="page">
        <div className="task-wrap">
          <div className="topline task-head">
            <div>
              <h1>Good Morning</h1>
              <p className="desc">Here are your action items extracted from recent calls.</p>
            </div>
            <div className="search">
              <span className="material-symbols-outlined">search</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks..." />
            </div>
            <button className="darkbtn" onClick={() => setAddOpen(true)}>
              ＋ Add Task
            </button>
          </div>

          {filtered.length === 0 && <p className="empty">No tasks match. Add one above.</p>}

          {groups.map(([heading, items, color], group) => (
            <section className="group" key={heading}>
              <h3 style={{ color }}>{heading}</h3>
              {items.length === 0 && <p className="empty small">Nothing here.</p>}
              {items.map((task) => (
                <article className={`task ${task.completed ? "done" : ""}`} key={task.id}>
                  <input className="check" type="checkbox" checked={task.completed} onChange={() => void toggle(task)} aria-label={`Mark ${task.title} ${task.completed ? "incomplete" : "complete"}`} />
                  <div className="task-main">
                    <h2>{task.title}</h2>
                    <div className="sub">
                      ⌕ From: {task.source}　 •　{" "}
                      <span style={{ color: task.due === "Due Today" && !task.completed ? "#d97706" : undefined }}>{task.due}</span>
                    </div>
                  </div>
                  <span className="chip" style={{ background: task.owner === "Client" ? "#dbeafe" : "#f0f1f3", color: "#4b5563" }}>
                    {task.owner}
                  </span>
                  <button className="iconbtn delete" onClick={() => void remove(task)} aria-label={`Delete ${task.title}`}>
                    ✕
                  </button>
                </article>
              ))}
            </section>
          ))}
        </div>
      </main>

      {addOpen && (
        <Modal title="Add task" onClose={() => setAddOpen(false)}>
          <div className="formgrid">
            <label className="full">
              What needs to happen?
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Send revised quote to TechFlow" autoFocus />
            </label>
            <label>
              Due
              <select className="input" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })}>
                <option value="Due Today">Due Today</option>
                <option value="Due Tomorrow">Due Tomorrow</option>
                <option value="Due This Week">Due This Week</option>
                <option value="Due Next Week">Due Next Week</option>
              </select>
            </label>
            <label>
              Owner
              <select className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value as Task["owner"] })}>
                <option value="Rep">Rep</option>
                <option value="Client">Client</option>
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <button className="ghostbtn" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button className="darkbtn" onClick={add} disabled={adding || !form.title.trim()}>
              {adding ? "Adding…" : "Add task"}
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
