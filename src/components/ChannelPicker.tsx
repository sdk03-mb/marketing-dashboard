"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LayoutGrid, MousePointerClick } from "lucide-react";
import { siFacebook, siInstagram, siSnapchat, siTiktok, siYoutube } from "simple-icons";
import { ALLCH, CHANNEL_NAMES } from "@/lib/plan";
import { POP } from "./motion";

type Mark = { title: string; path: string; hex: string; badge?: string };
const si = (i: { title: string; path: string; hex: string }, badge?: string): Mark => ({ title: i.title, path: i.path, hex: i.hex, badge });

// simple-icons no longer ships LinkedIn; hand-drawn "in" mark in LinkedIn blue.
const LINKEDIN: Mark = {
  title: "LinkedIn", hex: "0A66C2",
  path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
};

/** Brand marks per avenue, in brand colours. */
const MARKS: Record<string, Mark[]> = {
  [ALLCH]: [],
  "PPC / Google Search": [], // click icon + coloured Google G, drawn in Marks
  "Instagram + Facebook": [si(siInstagram), si(siFacebook)],
  TikTok: [si(siTiktok)],
  YouTube: [si(siYoutube)],
  "LinkedIn + Snapchat": [LINKEDIN, si(siSnapchat, "FFFC00")],
  Programmatic: [],
};

function BrandIcon({ m }: { m: Mark }) {
  // Snapchat yellow is unreadable on white: black glyph on a yellow badge instead.
  const fill = m.badge ? "#000" : "#" + m.hex;
  return (
    <svg className={"pmark" + (m.badge ? " badge" : "")} viewBox="0 0 24 24" width="16" height="16" role="img" aria-label={m.title}
      style={m.badge ? { background: "#" + m.badge } : undefined}>
      <path d={m.path} fill={fill} />
    </svg>
  );
}

function ProgrammaticIcon() {
  return (
    <svg className="pmark" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="6" cy="6" r="3" fill="#467BFF" /><circle cx="18" cy="6" r="3" fill="#75D9D9" />
      <circle cx="6" cy="18" r="3" fill="#75D9D9" /><circle cx="18" cy="18" r="3" fill="#467BFF" />
      <path d="M8 8l8 8M16 8l-8 8" stroke="#9aa1ad" strokeWidth="1.5" />
    </svg>
  );
}

/** Google "G" in the four brand colours. */
function GoogleG() {
  return (
    <svg className="pmark" viewBox="0 0 48 48" width="16" height="16" role="img" aria-label="Google">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function Marks({ chan }: { chan: string }) {
  return (
    <span className="pmarks">
      {chan === ALLCH && <LayoutGrid className="pmark all" size={16} strokeWidth={1.8} aria-hidden="true" />}
      {chan === "Programmatic" && <ProgrammaticIcon />}
      {chan === "PPC / Google Search" && <><MousePointerClick className="pmark click" size={16} strokeWidth={1.9} aria-hidden="true" /><GoogleG /></>}
      {(MARKS[chan] ?? []).map((m) => <BrandIcon key={m.title} m={m} />)}
    </span>
  );
}

const label = (c: string) => c.replace(" (combined)", "");

export function ChannelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const options = [ALLCH, ...CHANNEL_NAMES];

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="pick cpick" onClick={(e) => e.stopPropagation()}>
      <motion.button type="button" className="btn cbtn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} whileTap={{ scale: 0.98 }}>
        <span className="ctext">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={value} className="cswap" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}>
              {label(value)}
            </motion.span>
          </AnimatePresence>
        </span>
        <Marks chan={value} />
        <motion.span className="chev" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}><ChevronDown size={14} aria-hidden="true" /></motion.span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div className="pop cpop" role="listbox" {...POP}>
            {options.map((c) => (
              <motion.button
                type="button" role="option" key={c} aria-selected={c === value}
                className={"copt" + (c === value ? " on" : "")}
                onClick={() => { onChange(c); setOpen(false); }}
                whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}
              >
                <span className="ctext">{label(c)}</span>
                <Marks chan={c} />
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
