import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <main className="page">
        <div className="notfound">
          <h1>404 — Page not found</h1>
          <p>The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
          <Link href="/activity">
            <button className="darkbtn">← Back to Activity Feed</button>
          </Link>
          <Link href="/pipeline" style={{ marginLeft: 12 }}>
            <button className="ghostbtn">View Deals</button>
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
