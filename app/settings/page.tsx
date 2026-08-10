"use client";

import { AppShell } from "@/components/app-shell";
import { api, pushToast, useLive } from "@/lib/live";

const CONFIG_ROWS: { key: "crm" | "transcriptTool" | "recapDestination" | "transcriptFolder"; title: string; options: string[] }[] = [
  { key: "crm", title: "CRM system", options: ["HubSpot", "Google Sheets fallback"] },
  { key: "transcriptTool", title: "Transcript tool", options: ["Zoom", "Gong", "Fathom", "Fireflies"] },
  { key: "recapDestination", title: "Recap destination", options: ["Slack channel", "Slack direct message"] },
  { key: "transcriptFolder", title: "Transcript folder", options: ["Gravity Transcripts", "My Drive / Inbox", "Shared drive"] },
];

function iconFor(provider: string): string {
  if (provider === "Slack") return "forum";
  if (provider === "HubSpot") return "hub";
  if (provider === "Zoom") return "videocam";
  if (provider === "Gmail") return "mail";
  if (provider === "Google Drive") return "folder";
  if (provider === "Google Sheets") return "table_chart";
  return "calendar_month";
}

export default function Settings() {
  const live = useLive();

  if (!live) {
    return (
      <AppShell>
        <main className="page">
          <div className="skeleton heading" style={{ height: 40, width: 380 }} />
          <div className="skeleton card" style={{ height: 300 }} />
        </main>
      </AppShell>
    );
  }

  const setConfig = async (key: (typeof CONFIG_ROWS)[number]["key"], value: string) => {
    try {
      await api.updateConfig({ [key]: value });
      pushToast("Workspace setup updated.");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not update config", "error");
    }
  };

  const toggle = async (provider: string) => {
    try {
      await api.toggleIntegration(provider);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not update integration", "error");
    }
  };

  return (
    <AppShell>
      <main className="page">
        <div className="settings">
          <h1 className="heading">Settings & integrations</h1>
          <p className="desc">Connect your real workspace. Demo records are never mixed with connected data.</p>

          <article className="card">
            <h2>Workspace setup</h2>
            {CONFIG_ROWS.map((row) => (
              <div className="settingrow" key={row.key}>
                <div>
                  <b>{row.title}</b>
                  <p>{live.config[row.key]}</p>
                </div>
                <select className="input select-sm" value={live.config[row.key]} onChange={(e) => void setConfig(row.key, e.target.value)} aria-label={row.title}>
                  {row.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </article>

          <article className="card" style={{ marginTop: 28 }}>
            <h2>Connected services</h2>
            {live.integrations.map((x) => (
              <div className="settingrow" key={x.provider}>
                <div className="source-icon">
                  <span className="material-symbols-outlined">{iconFor(x.provider)}</span>
                </div>
                <div>
                  <b>{x.provider}</b>
                  <p>{x.connected ? "Connected in demo workspace" : "Not connected"}</p>
                </div>
                <button className={x.connected ? "ghostbtn" : "darkbtn"} onClick={() => void toggle(x.provider)}>
                  {x.connected ? "Disconnect" : "Connect"}
                </button>
              </div>
            ))}
          </article>
        </div>
      </main>
    </AppShell>
  );
}
