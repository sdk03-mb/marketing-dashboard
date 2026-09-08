"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { daily } from "@/lib/data";
import { money } from "@/lib/format";

const W = 560;
const H = 120;
const PAD = { l: 34, r: 30, t: 8, b: 16 };

export function TrendChart() {
  const [hover, setHover] = useState<number | null>(null);
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const maxS = Math.max(...daily.map((d) => d.spend)) * 1.05;
  const maxF = Math.max(...daily.map((d) => d.ftd)) * 1.05;
  const x = (i: number) => PAD.l + (i / (daily.length - 1)) * iw;
  const yS = (v: number) => PAD.t + ih - (v / maxS) * ih;
  const yF = (v: number) => PAD.t + ih - (v / maxF) * ih;
  const bw = iw / daily.length - 2;
  const ftdPath = daily.map((d, i) => `${i ? "L" : "M"}${x(i)},${yF(d.ftd)}`).join(" ");
  const h = hover ?? daily.length - 1;
  const pt = daily[h];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        onMouseLeave={() => setHover(null)}
      >
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih - ih * t} y2={PAD.t + ih - ih * t} stroke="var(--line)" strokeWidth={0.5} />
            <text x={PAD.l - 4} y={PAD.t + ih - ih * t + 3} fontSize={8} fill="var(--muted)" textAnchor="end">
              {Math.round((maxS * t) / 1000)}K
            </text>
            <text x={W - PAD.r + 4} y={PAD.t + ih - ih * t + 3} fontSize={8} fill="var(--teal)">
              {Math.round(maxF * t)}
            </text>
          </g>
        ))}
        {daily.map((d, i) => (
          <motion.rect
            key={d.day}
            x={x(i) - bw / 2}
            width={bw}
            initial={{ y: PAD.t + ih, height: 0 }}
            animate={{ y: yS(d.spend), height: ih - (yS(d.spend) - PAD.t) }}
            transition={{ duration: 0.5, delay: i * 0.012, ease: "easeOut" }}
            fill={i === h ? "var(--blue)" : "color-mix(in srgb, var(--blue) 45%, transparent)"}
            rx={1}
            onMouseEnter={() => setHover(i)}
          />
        ))}
        <motion.path
          d={ftdPath}
          fill="none"
          stroke="var(--teal)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
        />
        <circle cx={x(h)} cy={yF(pt.ftd)} r={2.5} fill="var(--teal)" />
        {[0, 9, 19, 29].map((i) => (
          <text key={i} x={x(i)} y={H - 4} fontSize={8} fill="var(--muted)" textAnchor="middle">
            {["9 Aug", "18 Aug", "28 Aug", "7 Sep"][[0, 9, 19, 29].indexOf(i)]}
          </text>
        ))}
      </svg>
      <div className="absolute top-0 right-8 flex gap-3 text-[10px] text-muted">
        <span><i className="inline-block w-2 h-2 rounded-[2px] bg-blue mr-1 align-middle" />Spend {money(pt.spend)}</span>
        <span><i className="inline-block w-2 h-[2px] bg-teal mr-1 align-middle" />FTDs {pt.ftd}</span>
        <span>{pt.day + 8 <= 31 ? `${pt.day + 8} Aug` : `${pt.day - 23} Sep`}</span>
      </div>
    </div>
  );
}
