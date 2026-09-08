"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, TreeChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([BarChart, LineChart, TreeChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export type Option = EChartsCoreOption;

/** Thin Apache ECharts wrapper: renders an option, resizes with its container. */
export function EChart({ option, height = 160, className }: { option: Option; height?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: "canvas" });
    inst.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => { ro.disconnect(); chart.dispose(); inst.current = null; };
  }, []);

  useEffect(() => { inst.current?.setOption(option, { notMerge: true, lazyUpdate: true }); }, [option]);

  return <div ref={ref} className={className} style={{ width: "100%", height }} />;
}
