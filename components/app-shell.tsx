"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { pushToast, startLive, useLive } from "@/lib/live";
import { timeAgo } from "@/lib/format";
import { Toasts } from "./toast";

const nav = [
  ["/pipeline", "Deals"],
  ["/contacts", "Contacts"],
  ["/activity", "Call Notes"],
  ["/tasks", "Tasks"],
];

function isActive(label: string, path: string): boolean {
  if (label === "Call Notes") return path === "/activity" || path.startsWith("/calls/");
  if (label === "Deals") return path === "/pipeline";
  if (label === "Contacts") return path === "/contacts";
  if (label === "Tasks") return path === "/tasks";
  return false;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const live = useLive();
  const [openPanel, setOpenPanel] = useState<"notifications" | "help" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    startLive();
  }, []);

  // Close popovers and the mobile menu on navigation.
  useEffect(() => {
    setOpenPanel(null);
    setMenuOpen(false);
  }, [path]);

  const events = live?.events ?? [];

  return (
    <div className="app">
      <nav className="nav">
        <Link href="/activity" className="brand">
          <span className="logo">G</span>Gravity <span className="demo">DEMO WORKSPACE</span>
        </Link>
        <div className="links">
          {nav.map(([href, label]) => (
            <Link key={label} href={href} className={isActive(label, path) ? "active" : ""}>
              {label}
            </Link>
          ))}
        </div>
        <button className="hamburger" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
          <span className="material-symbols-outlined">{menuOpen ? "close" : "menu"}</span>
        </button>
        <div className="actions">
          <Link href="/pipeline?create=1" className="darkbtn">
            Create Deal
          </Link>
          <div className="panel-anchor">
            <button
              className={`iconbtn ${openPanel === "notifications" ? "pressed" : ""}`}
              aria-label="Notifications"
              onClick={() => setOpenPanel(openPanel === "notifications" ? null : "notifications")}
            >
              <span className="material-symbols-outlined">notifications</span>
              {events.length > 0 && <span className="badge" />}
            </button>
            {openPanel === "notifications" && (
              <>
                <div className="popover" role="menu">
                  <div className="popover-head">Recent activity</div>
                  <div className="popover-list">
                    {events.length === 0 && <div className="popover-empty">No activity yet.</div>}
                    {events.slice(0, 8).map((e) => (
                      <div className="popover-row" key={e.id}>
                        <span className={`chip ${e.kind}`}>● {e.kind === "draft" ? "Draft" : e.kind === "input" ? "Input" : "Logged"}</span>
                        <div>
                          <div className="popover-title">{e.title}</div>
                          <div className="sub">{timeAgo(e.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="popover-backdrop" onClick={() => setOpenPanel(null)} />
              </>
            )}
          </div>
          <div className="panel-anchor">
            <button
              className={`iconbtn ${openPanel === "help" ? "pressed" : ""}`}
              aria-label="Help"
              onClick={() => setOpenPanel(openPanel === "help" ? null : "help")}
            >
              <span className="material-symbols-outlined">help</span>
            </button>
            {openPanel === "help" && (
              <>
                <div className="popover help-pop" role="menu">
                  <div className="popover-head">Tips</div>
                  <ul className="help-list">
                    <li>Drag deals between pipeline stages.</li>
                    <li>Run a simulated incoming call from the Activity feed.</li>
                    <li>Every change syncs to open tabs in real time.</li>
                  </ul>
                  <button
                    className="textbtn"
                    onClick={() => {
                      pushToast("All good — ask me anything about the workspace.", "info");
                      setOpenPanel(null);
                    }}
                  >
                    Still confused?
                  </button>
                </div>
                <div className="popover-backdrop" onClick={() => setOpenPanel(null)} />
              </>
            )}
          </div>
          <div className="avatar" title="Demo Rep">
            DR
          </div>
        </div>
      </nav>
      {menuOpen && (
        <div className="mobile-menu">
          {nav.map(([href, label]) => (
            <Link key={label} href={href} className={isActive(label, path) ? "active" : ""} onClick={() => setMenuOpen(false)}>
              {label}
            </Link>
          ))}
          <Link href="/pipeline?create=1" className="darkbtn" onClick={() => setMenuOpen(false)}>
            Create Deal
          </Link>
        </div>
      )}
      {children}
      <Toasts />
    </div>
  );
}
