"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { POP } from "./motion";

export type Option = { value: string; label: string; hint?: string };
type Props = { value: string | null; options: Option[]; placeholder?: string; onChange: (v: string) => void; ariaLabel?: string; width?: number };

/** Custom select: button + animated listbox. Shows the current value; placeholder when nothing matches. */
export function Select({ value, options, placeholder = "Select", onChange, ariaLabel, width = 200 }: Props) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="pick spick" onClick={(e) => e.stopPropagation()} style={{ width }}>
      <motion.button type="button" className={"btn sbtn" + (cur ? "" : " ph")} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((o) => !o)} whileTap={{ scale: 0.98 }}>
        <span className="ctext">{cur ? cur.label : placeholder}</span>
        <motion.span className="chev" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}><ChevronDown size={14} aria-hidden="true" /></motion.span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div className="pop spop" role="listbox" {...POP} style={{ width }}>
            {options.map((o) => (
              <motion.button type="button" role="option" key={o.value} aria-selected={o.value === value}
                className={"copt" + (o.value === value ? " on" : "")}
                onClick={() => { onChange(o.value); setOpen(false); }} whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}>
                <span className="ctext">{o.label}{o.hint && <span className="shint">{o.hint}</span>}</span>
                {o.value === value && <Check size={14} aria-hidden="true" />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
