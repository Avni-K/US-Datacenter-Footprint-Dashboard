import { useDeferredValue, useState, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { useHuc8Data } from '../hooks/useHuc8Data';
import type { Huc8Feature } from '../hooks/useHuc8Data';
import type { Huc8MetricKey, Huc8Row } from '../types';
import { formatFull } from '../utils/format';

const MAP_W = 960;
const MAP_H = 580;

const HUC8_COMPOSITE_METRICS: { key: Huc8MetricKey; label: string; color: string }[] = [
  { key: 'WSF_PCA_m3eq',    label: 'Scarcity', color: 'rgb(124, 58, 237)' },
  { key: 'WF_PCA_m3',       label: 'Water',    color: 'rgb(8, 145, 178)' },
  { key: 'CF_PCA_tonsCO2e', label: 'Carbon',   color: 'rgb(196, 57, 44)' },
];

const DEFAULT_HUC8_WEIGHTS: Record<Huc8MetricKey, number> = {
  WSF_PCA_m3eq: 34,
  WF_PCA_m3: 33,
  CF_PCA_tonsCO2e: 33,
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
  const [weights, setWeights] = useState<Record<Huc8MetricKey, number>>(DEFAULT_HUC8_WEIGHTS);
  const [focusCount, setFocusCount] = useState(100);
  const [selectedHuc8, setSelectedHuc8] = useState<string | null>(null);
  const [hoveredHuc8, setHoveredHuc8] = useState<string | null>(null);
  const [hovered, setHovered] = useState<Huc8Row | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const deferredWeights = useDeferredValue(weights);
  const deferredFocusCount = useDeferredValue(focusCount);

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

  const renderedFeatures = useMemo(() => {
    if (!pathGen) {
      return [] as { huc8code: string; row: Huc8Row | undefined; d: string }[];
    }

    return matchedFeatures.flatMap((f, i) => {
      const huc8code = getHuc8Code(f.properties);
      const row = dataByHuc8.get(huc8code);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = cleanPath(pathGen(f as any));
      return d ? [{ huc8code: huc8code || String(i), row, d }] : [];
    });
  }, [dataByHuc8, matchedFeatures, pathGen]);

  const composite = useMemo(() => {
    const domains = new Map<Huc8MetricKey, [number, number]>();
    for (const { key } of HUC8_COMPOSITE_METRICS) {
      const sorted = rows
        .map(r => r[key])
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      const lo = pctile(sorted, 0.02);
      const hi = pctile(sorted, 0.98);
      domains.set(key, [lo, hi > lo ? hi : lo + 1]);
    }

    const normalizedFor = (row: Huc8Row, key: Huc8MetricKey) => {
      const [lo, hi] = domains.get(key) ?? [0, 1];
      return Math.max(0, Math.min(1, (row[key] - lo) / (hi - lo)));
    };

    const weightTotal = d3.sum(HUC8_COMPOSITE_METRICS, ({ key }) => deferredWeights[key]);
    const normalizedWeightFor = (key: Huc8MetricKey) =>
      weightTotal > 0 ? deferredWeights[key] / weightTotal : 1 / HUC8_COMPOSITE_METRICS.length;

    const scoreFor = (row: Huc8Row) =>
      d3.sum(
        HUC8_COMPOSITE_METRICS,
        ({ key }) => normalizedFor(row, key) * normalizedWeightFor(key),
      );

    const maxScore = d3.max(rows, scoreFor) ?? 1;
    const colorScale = d3
      .scaleSequential(d3.interpolateYlGnBu)
      .domain([0, maxScore || 1])
      .clamp(true);
    const focusedHuc8s = new Set(
      [...rows]
        .sort((a, b) => scoreFor(b) - scoreFor(a))
        .slice(0, deferredFocusCount)
        .map(row => row.HUC8),
    );

    return { fillFor: (row: Huc8Row) => colorScale(scoreFor(row)), focusedHuc8s, scoreFor };
  }, [deferredFocusCount, deferredWeights, rows]);

  const top10 = useMemo(
    () =>
      [...rows]
        .sort((a, b) => composite.scoreFor(b) - composite.scoreFor(a))
        .slice(0, 10),
    [rows, composite],
  );

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
          Watershed-level scarcity, water, and carbon footprints for{' '}
          {rows.length.toLocaleString()} HUC8 subbasins in one combined layer.
        </p>
      </div>

      <div className="weight-panel">
        <div className="weight-panel-header">
          <div className="panel-title">HUC8 Map Weights</div>
          <button
            className="weight-reset"
            type="button"
            onClick={() => {
              setWeights(DEFAULT_HUC8_WEIGHTS);
              setFocusCount(100);
              setSelectedHuc8(null);
              setHoveredHuc8(null);
            }}
          >
            Reset
          </button>
        </div>
        <div className="weight-grid">
          {HUC8_COMPOSITE_METRICS.map(metric => {
            const total = d3.sum(HUC8_COMPOSITE_METRICS, item => weights[item.key]);
            const normalized = total > 0 ? (weights[metric.key] / total) * 100 : 0;
            return (
              <label key={metric.key} className="weight-control">
                <span className="weight-label">
                  <span className="weight-dot" style={{ background: metric.color }} />
                  {metric.label}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[metric.key]}
                  onChange={event =>
                    setWeights(current => ({
                      ...current,
                      [metric.key]: Number(event.target.value),
                    }))
                  }
                  style={{ accentColor: metric.color }}
                />
                <span className="weight-value">{normalized.toFixed(0)}%</span>
              </label>
            );
          })}
        </div>
        <label className="focus-control">
          <span className="weight-label">Focus Top Basins</span>
          <input
            type="range"
            min={25}
            max={400}
            value={focusCount}
            onChange={event => setFocusCount(Number(event.target.value))}
          />
          <span className="weight-value">{focusCount}</span>
        </label>
      </div>

      <div className="huc8-main">
        <div className="map-panel">
          <div className="panel-title">
            Combined HUC8 Environmental Footprint
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
                {/* Map background */}
                <rect width={MAP_W} height={MAP_H} fill="#e8edf4" />

                <g>
                  {renderedFeatures.map(({ huc8code, row, d }) => {
                      const activeHuc8 = selectedHuc8 ?? hoveredHuc8;
                      const isSelected = huc8code === activeHuc8;
                      const isFocused = row ? composite.focusedHuc8s.has(row.HUC8) : false;
                      return (
                        <path
                          key={huc8code}
                          d={d}
                          fill={row ? composite.fillFor(row) : '#c8d3e0'}
                          stroke="#ffffff"
                          strokeWidth={isSelected ? 1.6 : 0.25}
                          fillOpacity={0.95}
                          className={`${isSelected ? 'selected' : ''}${row && !isFocused ? ' muted' : ''}`}
                          onMouseEnter={() => {
                            setHovered(row ?? null);
                            setHoveredHuc8(row?.HUC8 ?? null);
                          }}
                          onMouseLeave={() => {
                            setHovered(null);
                            setHoveredHuc8(null);
                          }}
                          onClick={() => {
                            if (!row) return;
                            setSelectedHuc8(row.HUC8 === selectedHuc8 ? null : row.HUC8);
                          }}
                        />
                      );
                    })}
                </g>

                <g transform={`translate(30,${MAP_H - 34})`}>
                  <rect
                    x={-4} y={-18} width={250} height={44}
                    fill="rgba(255,255,255,0.82)" rx={4}
                  />
                  <text x={0} y={-4} fontSize={10} fill="#555" textAnchor="start">
                    Combined layer, each metric clipped p2 to p98
                  </text>
                  {HUC8_COMPOSITE_METRICS.map((item, i) => (
                    <g key={item.key} transform={`translate(${i * 78},17)`}>
                      <circle r={5} cx={5} cy={0} fill={item.color} />
                      <text x={16} y={4} fontSize={10} fill="#555">{item.label}</text>
                    </g>
                  ))}
                </g>
              </svg>

              {hovered && (
                <div
                  className="map-tooltip huc8-tooltip"
                  style={{
                    left: cursor.x > 690 ? cursor.x - 210 : cursor.x + 14,
                    top: Math.max(cursor.y - 130, 4),
                  }}
                >
                  <div className="tt-state">HUC8: {hovered.HUC8}</div>
                  <div className="tt-row">
                    <span className="tt-label">Combined</span>
                    <span className="tt-val">
                      {(composite.scoreFor(hovered) * 100).toFixed(1)} score
                    </span>
                  </div>
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
          <div className="panel-title">Top 10 Hotspots — Combined Footprint</div>
          <table className="ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>HUC8</th>
                <th>Region</th>
                <th className="rank-val">Score</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((r, i) => (
                <tr
                  key={r.HUC8}
                  className={r.HUC8 === (selectedHuc8 ?? hoveredHuc8) ? 'linked-row selected' : 'linked-row'}
                  onMouseEnter={() => {
                    setHovered(r);
                    setHoveredHuc8(r.HUC8);
                  }}
                  onMouseLeave={() => {
                    setHovered(null);
                    setHoveredHuc8(null);
                  }}
                  onClick={() => setSelectedHuc8(r.HUC8 === selectedHuc8 ? null : r.HUC8)}
                >
                  <td className="rank-num">{i + 1}</td>
                  <td className="siting-huc8">{r.HUC8}</td>
                  <td className="huc8-region">{r.Region}</td>
                  <td className="rank-val">{(composite.scoreFor(r) * 100).toFixed(1)}</td>
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
