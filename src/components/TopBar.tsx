"use client";
import Link from "next/link";
import { Logo } from "./Logo";

export function TopBar({ active, right }: { active: "plan" | "overview"; right?: React.ReactNode }) {
  const tab = (href: string, id: "plan" | "overview", label: string) => (
    <Link
      href={href}
      className={`px-2 py-0.5 rounded ${active === id ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}
      aria-current={active === id ? "page" : undefined}
    >
      {label}
    </Link>
  );
  return (
    <header className="flex items-center justify-between h-8 shrink-0">
      <div className="flex items-center gap-3">
        <Logo className="h-[18px] w-auto" />
        <span className="text-muted text-[11px] border-l border-line pl-3">Marketing dashboard</span>
        <nav className="flex gap-0.5 text-[11px] ml-2">
          {tab("/", "plan", "Performance vs plan")}
          {tab("/overview", "overview", "Overview")}
        </nav>
      </div>
      <div className="flex items-center gap-2 text-[11px]">{right}</div>
    </header>
  );
}
