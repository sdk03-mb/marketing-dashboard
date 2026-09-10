"use client";

import { useMemo } from "react";
import { geoBounds, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import world50 from "world-atlas/countries-50m.json";
import { atlasName } from "./WorldMap";
import { ISO } from "@/lib/plan";

// Finer 50m outlines for the satellite overlay; the world map keeps the light 110m set.
type F = Feature<Geometry, { name: string }>;
let cached: F[] | null = null;
function countryFeature(name: string): F | undefined {
  if (!cached) {
    const topo = world50 as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    cached = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features;
  }
  const atlas = atlasName(name);
  return atlas ? cached.find((f) => f.properties.name === atlas) : undefined;
}

/** Mapbox public token. Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local (see .env.example); without it the caller falls back to the vector map. */
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
export const hasSatellite = () => MAPBOX_TOKEN.length > 0;

// Political base. With a custom Studio style (NEXT_PUBLIC_MAPBOX_STYLE = "user/styleid") that carries a fill layer on the
// Mapbox Countries tileset, the country is coloured by Mapbox itself through setfilter, under the labels.
const STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE || "mapbox/light-v11";
const LAYER = process.env.NEXT_PUBLIC_MAPBOX_LAYER || "country-fill";
const MAPBOX_FILL = !!process.env.NEXT_PUBLIC_MAPBOX_STYLE;
const TILE = 512; // Mapbox world width at zoom 0, in px

/** Zoom that fits a lon/lat box into w x h px with `pad` px of margin on each side (Web Mercator, 512px tiles). */
function fitZoom(b: [[number, number], [number, number]], w: number, h: number, pad: number): { zoom: number; lon: number; lat: number } {
  const m = geoMercator().scale(TILE / (2 * Math.PI)).translate([0, 0]);
  const [x0, y0] = m([b[0][0], b[1][1]])!, [x1, y1] = m([b[1][0], b[0][1]])!;
  const zoom = Math.min(Math.log2((w - pad * 2) / Math.abs(x1 - x0)), Math.log2((h - pad * 2) / Math.abs(y1 - y0)));
  // Centre on the box in projected space, so tall or wide countries sit in the middle rather than at their lon/lat midpoint.
  const [lon, lat] = m.invert!([(x0 + x1) / 2, (y0 + y1) / 2])!;
  return { zoom: Math.max(1, Math.min(12, Math.floor(zoom * 100) / 100)), lon, lat };
}

/** Satellite image of one country from the Mapbox Static Images API, with the country outline drawn on top in the same projection. */
export function SatMap({ country, width = 1280, height = 900, pad = 60 }: { country: string; width?: number; height?: number; pad?: number }) {
  const data = useMemo(() => {
    const f = countryFeature(country); if (!f) return null;
    const { zoom, lon, lat } = fitZoom(geoBounds(f), width, height, pad);
    // Overlay projection: identical to the static image (Web Mercator, centre at the middle, TILE * 2^zoom px around the world).
    const proj = geoMercator().scale((TILE * 2 ** zoom) / (2 * Math.PI)).center([lon, lat]).translate([width / 2, height / 2]);
    const d = geoPath(proj)(f) ?? "";
    // setfilter keeps only this country in the fill layer; the worldview clause picks one boundary version so borders do not double up.
    const iso = (ISO[country] ?? "").toUpperCase();
    const filter = JSON.stringify(["all", ["==", ["get", "iso_3166_1"], iso], ["any", ["==", ["get", "worldview"], "all"], ["in", "US", ["get", "worldview"]]]]);
    const extra = MAPBOX_FILL && iso ? `&setfilter=${encodeURIComponent(filter)}&layer_id=${LAYER}` : "";
    const url = `https://api.mapbox.com/styles/v1/${STYLE}/static/${lon.toFixed(5)},${lat.toFixed(5)},${zoom},0/${width}x${height}@2x?attribution=false&logo=false${extra}&access_token=${MAPBOX_TOKEN}`;
    return { d, url };
  }, [country, width, height, pad]);
  if (!data) return null;
  return (
    <div className="satmap" style={{ aspectRatio: `${width} / ${height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.url} alt={country + " satellite map"} width={width} height={height} />
      {/* Without a custom style the tint is drawn here; with one, Mapbox paints it under the labels. */}
      {!MAPBOX_FILL && (
        <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <path d={data.d} fill="rgba(46,117,182,.22)" stroke="#2e75b6" strokeWidth={3} strokeLinejoin="round" />
        </svg>
      )}
      <span className="satmap-credit">© Mapbox © OpenStreetMap</span>
    </div>
  );
}
