"use client";

import { useEffect, useRef } from "react";
import { Chart, type ChartConfiguration } from "chart.js/auto";

Chart.defaults.font.family = "Inter, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = "#9aa1ad";
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;

/** Thin Chart.js wrapper: one canvas, rebuilt when the config changes, sized by its container. */
export function ChartJS({ config, height = 160 }: { config: ChartConfiguration; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const chart = new Chart(el, config);
    return () => chart.destroy();
  }, [config]);

  return <div style={{ position: "relative", width: "100%", height }}><canvas ref={ref} /></div>;
}
