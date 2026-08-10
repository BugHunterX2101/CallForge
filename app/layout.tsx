import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Gravity", description: "Sales call intelligence" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
