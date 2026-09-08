"use client";

import dynamic from "next/dynamic";

// The dashboard depends on the browser clock and localStorage, so it renders client-side only.
const Dashboard = dynamic(() => import("@/components/Dashboard").then((m) => m.Dashboard), { ssr: false });

export default function Page() {
  return <Dashboard />;
}
