"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

type Props = { title: string; meta?: string; defaultOpen?: boolean; children: ReactNode };

/** Collapsible section with animated height; closed by default. */
export function Accordion({ title, meta, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={"acc" + (open ? " open" : "")}>
      <button type="button" className="acch" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <h4>{title}</h4>
        {meta && <span className="accm">{meta}</span>}
        <motion.span className="accc" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
          <ChevronDown size={16} aria-hidden="true" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body" className="accb"
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }, opacity: { duration: 0.15 } }}
            style={{ overflow: "hidden" }}
          >
            <div className="acci">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
