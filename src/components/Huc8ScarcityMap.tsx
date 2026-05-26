import { useState, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { useHuc8Data } from '../hooks/useHuc8Data';
import type { Huc8Feature } from '../hooks/useHuc8Data';
import type { Huc8MetricKey, Huc8MetricOption, Huc8Row } from '../types';
import { formatFull, formatCompact } from '../utils/format';

const MAP_W = 960;
const MAP_H = 580;

const HUC8_METRICS: Huc8MetricOption[] = [
  { key: 'WSF_PCA_m3eq',    label: 'Scarcity Footprint', unit: 'm³-eq' },
  { key: 'WF_PCA_m3',       label: 'Water Footprint',    unit: 'm³'    },
  { key: 'CF_PCA_tonsCO2e', label: 'Carbon Footprint',   unit: 'tCO₂e' },
];

const COLOR_INTERP: Record<Huc8MetricKey, (t: number) => string> = {
  WSF_PCA_m3eq:    d3.interpolatePurples,
  WF_PCA_m3:       d3.interpolateBlues,
  CF_PCA_tonsCO2e: d3.interpolateOrRd,
};

function getHuc8Code(props: Record<string, unknown>): string {
  const raw = String(props.huc8 ?? props.HUC8 ?? props.Huc8 ?? props.HUC_8 ?? '');
  return raw.padStart(8, '0');
}

/**
 * Remove clip-frame subpaths that D3 spherical path generators prepend to every
 * feature path. geoAlbersUsa adds 3 rectangles (main US, Alaska inset, Hawaii
 * inset) before the actual polygon subpath. We keep only subpaths whose bounding
 * box area is below MAX_SUBPATH_AREA — the real HUC8 polygons are tiny compared
 * to the full-canvas rectangles.
 */
const MAX_SUBPATH_AREA = 5_000; // px²

function subpathBboxArea(pts: [number, number][]): number {
  if (pts.length === 0) return 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return (maxX - minX) * (maxY - minY);
}

function cleanPath(d: string | null): string | null {
  if (!d) return null;
  // Split on 'M' (move-to), keeping the delimiter by re-prepending it.
  const rawParts = d.split(/(?=M)/);
  const kept: string[] = [];
  for (const part of rawParts) {
    if (!part) continue;
    // Extract all coordinate pairs from this subpath.
    const coordRe = /([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?),([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    const pts: [number, number][] = [];
    let m: RegExpExecArray | null;
    while ((m = coordRe.exec(part)) !== null) {
      pts.push([parseFloat(m[1]), parseFloat(m[2])]);
    }
    if (subpathBboxArea(pts) < MAX_SUBPATH_AREA) {
      kept.push(part);
    }
  }
  return kept.length > 0 ? kept.join('') : null;
}

/** p-th percentile of a SORTED numeric array (0–1). */
function pctile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx];
}

export function Huc8ScarcityMap() {
  const { rows, features, geoMissing, loading, dataByHuc8 } = useHuc8Data();
  const [metric, setMetric] = useState<Huc8MetricOption>(HUC8_METRICS[0]);
  const [hovered, setHovered] = useState<Huc8Row | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Build projection using geoAlbersUsa.
   *
   * geoAlbersUsa produces correct ~1055 scale for CONUS. However, it prepends
   * clip-frame rectangles to EVERY feature path (main US viewport + Alaska inset +
   * Hawaii inset), which with fill-rule:nonzero floods each polygon's fill across
   * the entire SVG. We strip those via cleanPath() before rendering.
   *
   * We fit only matched CONUS features (HUC2 01–18) to avoid antimeridian-crossing
   * Pacific/territory HUC2-21/22 features collapsing fitSize to near-zero scale.
   */
  const { pathGen, matchedFeatures } = useMemo(() => {
    if (!features || features.length === 0) {
      return { pathGen: null, matchedFeatures: [] as Huc8Feature[] };
    }

    const matched = features.filter(f => dataByHuc8.has(getHuc8Code(f.properties)));

    console.log(
      `[HUC8] csv=${rows.length} geo=${features.length} matched=${matched.length}`,
    );

    const fitCollection = {
      type: 'FeatureCollection' as const,
      features: matched.length > 0 ? matched : features,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj = d3.geoAlbersUsa().fitSize([MAP_W, MAP_H], fitCollection as any);
    const gen = d3.geoPath(proj);

    console.log(`[HUC8] scale=${(proj as d3.GeoProjection).scale?.()?.toFixed(1)}`);

    return { pathGen: gen, matchedFeatures: matched };
  }, [features, dataByHuc8, rows.length]);

  /**
   * Percentile-clipped color scale.
   *
   * Raw max values can be 100–200× larger than p98 (one or two extreme basins),
   * which compresses all colors to near-white when domain=[0, max].
   * Clamping at p98 ensures visible color variation across the map.
   */
  const { colorScale, domain } = useMemo(() => {
    const sorted = rows
      .map(r => r[metric.key])
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const lo = pctile(sorted, 0.02);
    const hi = pctile(sorted, 0.98);
    const dom: [number, number] = [lo, hi > lo ? hi : lo + 1];
    return {
      colorScale: d3
        .scaleSequential(COLOR_INTERP[metric.key])
        .domain(dom)
        .clamp(true),
      domain: dom,
    };
  }, [rows, metric]);

  const top10 = useMemo(
    () =>
      [...rows]
        .filter(r => Number.isFinite(r[metric.key]))
        .sort((a, b) => b[metric.key] - a[metric.key])
        .slice(0, 10),
    [rows, metric],
  );

  const gradId = `huc8-grad-${metric.key}`;

  if (loading) {
    return (
      <div className="huc8-section">
        <div className="map-loading">Loading HUC8 data…</div>
      </div>
    );
  }

  return (
    <div className="huc8-section">
      <div className="siting-header">
        <h2>HUC8 Water Scarcity Hotspot Map</h2>
        <p>
          Watershed-level environmental footprints for {rows.length.toLocaleString()} HUC8
          subbasins — color scale clipped at 98th percentile for visibility.
        </p>
      </div>

      <div className="metric-selector">
        {HUC8_METRICS.map(m => (
          <button
            key={m.key}
            className={`metric-btn${m.key === metric.key ? ' active' : ''}`}
            onClick={() => setMetric(m)}
            type="button"
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="huc8-main">
        <div className="map-panel">
          <div className="panel-title">
            {metric.label} by HUC8 Subbasin ({metric.unit})
          </div>

          {geoMissing ? (
            <GeoMissingMessage />
          ) : (
            <div
              ref={containerRef}
              className="map-container"
              onMouseMove={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
            >
              <svg
                viewBox={`0 0 ${MAP_W} ${MAP_H}`}
                width={MAP_W}
                height={MAP_H}
                style={{ display: 'block', width: '100%', height: 'auto' }}
              >
                <defs>
                  <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
                    {[0, 0.25, 0.5, 0.75, 1].map(t => (
                      <stop
                        key={t}
                        offset={`${t * 100}%`}
                        stopColor={colorScale(domain[0] + t * (domain[1] - domain[0]))}
                      />
                    ))}
                  </linearGradient>
                </defs>

                {/* Map background */}
                <rect width={MAP_W} height={MAP_H} fill="#e8edf4" />

                <g>
                  {pathGen &&
                    matchedFeatures.map((f, i) => {
                      const huc8code = getHuc8Code(f.properties);
                      const row = dataByHuc8.get(huc8code);
                      const value = row?.[metric.key];
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const d = cleanPath(pathGen(f as any));
                      if (!d) return null;
                      return (
                        <path
                          key={huc8code || i}
                          d={d}
                          fill={
                            value != null && Number.isFinite(value)
                              ? colorScale(value)
                              : '#c8d3e0'
                          }
                          stroke="#ffffff"
                          strokeWidth={0.25}
                          fillOpacity={0.95}
                          onMouseEnter={() => setHovered(row ?? null)}
                          onMouseLeave={() => setHovered(null)}
                        />
                      );
                    })}
                </g>

                {/* Color legend */}
                <g transform={`translate(30,${MAP_H - 34})`}>
                  <rect
                    x={-4} y={-18} width={230} height={44}
                    fill="rgba(255,255,255,0.82)" rx={4}
                  />
                  <text x={0} y={-4} fontSize={10} fill="#555" textAnchor="start">
                    {metric.label} ({metric.unit}) — p2 to p98
                  </text>
                  <rect width={200} height={10} fill={`url(#${gradId})`} rx={2} />
                  <text x={0} y={22} fontSize={10} fill="#555" textAnchor="start">
                    {formatCompact(domain[0])}
                  </text>
                  <text x={200} y={22} fontSize={10} fill="#555" textAnchor="end">
                    {formatCompact(domain[1])}
                  </text>
                </g>
              </svg>

              {hovered && (
                <div
                  className="map-tooltip huc8-tooltip"
                  style={{
                    left:
                      cursor.x > (containerRef.current?.clientWidth ?? 900) - 220
                        ? cursor.x - 210
                        : cursor.x + 14,
                    top: Math.max(cursor.y - 130, 4),
                  }}
                >
                  <div className="tt-state">HUC8: {hovered.HUC8}</div>
                  <div className="tt-row">
                    <span className="tt-label">Region</span>
                    <span className="tt-val">{hovered.Region}</span>
                  </div>
                  <div className="tt-row">
                    <span className="tt-label">Water Footprint</span>
                    <span className="tt-val">{formatFull(hovered.WF_PCA_m3)} m³</span>
                  </div>
                  <div className="tt-row">
                    <span className="tt-label">Carbon Footprint</span>
                    <span className="tt-val">{formatFull(hovered.CF_PCA_tonsCO2e)} tCO₂e</span>
                  </div>
                  <div className="tt-row">
                    <span className="tt-label">Scarcity Footprint</span>
                    <span className="tt-val">{formatFull(hovered.WSF_PCA_m3eq)} m³-eq</span>
                  </div>
                  <div className="tt-row">
                    <span className="tt-label">CF Factor</span>
                    <span className="tt-val">{hovered.Characterization_Factor.toFixed(4)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="table-panel huc8-table-panel">
          <div className="panel-title">Top 10 Hotspots — {metric.label}</div>
          <table className="ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>HUC8</th>
                <th>Region</th>
                <th className="rank-val">{metric.unit}</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((r, i) => (
                <tr key={r.HUC8}>
                  <td className="rank-num">{i + 1}</td>
                  <td className="siting-huc8">{r.HUC8}</td>
                  <td className="huc8-region">{r.Region}</td>
                  <td className="rank-val">{formatFull(r[metric.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GeoMissingMessage() {
  return (
    <div className="huc8-geo-missing">
      <div className="huc8-geo-missing-title">Boundary File Required</div>
      <div className="huc8-geo-missing-body">
        <p>
          Real HUC8 polygon geometries must be downloaded from the USGS National Map before the
          choropleth can render. Run this script once (requires internet access and Python 3):
        </p>
        <code className="huc8-geo-cmd">python3 scripts/download_huc8_boundaries.py</code>
        <p>
          This fetches the USGS Watershed Boundary Dataset (WBD) and saves it to{' '}
          <strong>public/data/huc8_boundaries.geojson</strong>. The top-10 table on the right is
          always available from the CSV data.
        </p>
      </div>
    </div>
  );
}
