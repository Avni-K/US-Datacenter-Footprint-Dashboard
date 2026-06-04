import { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { feature as topoFeature } from 'topojson-client';
import type { DatacenterCountRow, GrowthMetricKey } from '../types';
import { FIPS_TO_STATE, STATE_NAMES } from '../constants';
import { formatCompact } from '../utils/format';

const MAP_W = 960;
const MAP_H = 580;

const GROWTH_METRICS: { key: GrowthMetricKey; label: string; unit: string }[] = [
  { key: 'datacenter_count_2021',           label: '2021 Count (OSM)',   unit: 'DCs' },
  { key: 'datacenter_count_2025',           label: '2025 Count (IM3)',   unit: 'DCs' },
  { key: 'datacenter_growth_2021_2025',     label: 'Net Growth',         unit: 'DCs' },
  { key: 'datacenter_growth_pct_2021_2025', label: 'Growth %',           unit: '%'   },
];

interface Props {
  dataByState: Map<string, DatacenterCountRow>;
  rows: DatacenterCountRow[];
}

export function DatacenterGrowthMap({ dataByState, rows }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [topo, setTopo] = useState<any>(null);
  const [hovered, setHovered] = useState<DatacenterCountRow | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [metric, setMetric] = useState<GrowthMetricKey>('datacenter_count_2025');

  useEffect(() => {
    fetch('/data/states-10m.json').then(r => r.json()).then(setTopo);
  }, []);

  const { statesFeatures, pathGen } = useMemo(() => {
    if (!topo) return { statesFeatures: null, pathGen: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geo = topoFeature(topo, topo.objects.states) as unknown as { features: any[] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj = d3.geoAlbersUsa().fitSize([MAP_W, MAP_H], geo as any);
    return { statesFeatures: geo.features, pathGen: d3.geoPath(proj) };
  }, [topo]);

  const { colorScale, domain, isDiverging } = useMemo(() => {
    const isPct = metric === 'datacenter_growth_pct_2021_2025';
    const isGrowth = metric === 'datacenter_growth_2021_2025';
    const vals = rows
      .map(r => r[metric])
      .filter((v): v is number => v != null && isFinite(v));
    const minV = d3.min(vals) ?? 0;
    const maxV = d3.max(vals) ?? 1;
    const diverging = (isGrowth || isPct) && minV < 0;

    if (diverging) {
      const ext = Math.max(Math.abs(minV), Math.abs(maxV));
      return {
        colorScale: d3.scaleDiverging(d3.interpolateRdBu).domain([-ext, 0, ext]),
        domain: [-ext, ext] as [number, number],
        isDiverging: true,
      };
    }

    const palette = metric === 'datacenter_count_2021'
      ? d3.interpolateBlues
      : metric === 'datacenter_count_2025'
        ? d3.interpolateCool
        : d3.interpolateGreens;

    return {
      colorScale: d3.scaleSequential(palette).domain([0, maxV]),
      domain: [0, maxV] as [number, number],
      isDiverging: false,
    };
  }, [rows, metric]);

  const gradId = `gm-${metric}`;
  const metricMeta = GROWTH_METRICS.find(m => m.key === metric)!;

  if (!statesFeatures || !pathGen) {
    return <div className="map-loading">Loading map…</div>;
  }

  const containerW = containerRef.current?.clientWidth ?? 900;

  return (
    <div>
      {/* Metric selector */}
      <div className="metric-selector" style={{ marginBottom: 16 }}>
        {GROWTH_METRICS.map(m => (
          <button
            key={m.key}
            type="button"
            className={`metric-btn${m.key === metric ? ' active' : ''}`}
            onClick={() => setMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        className="map-container"
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
          <defs>
            <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
              {[0, 0.25, 0.5, 0.75, 1].map(t => {
                const v = isDiverging
                  ? domain[0] + t * (domain[1] - domain[0])
                  : domain[0] + t * (domain[1] - domain[0]);
                return (
                  <stop key={t} offset={`${t * 100}%`}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    stopColor={(colorScale as any)(v)} />
                );
              })}
            </linearGradient>
          </defs>

          <g>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {statesFeatures.map((f: any) => {
              const fips = String(f.id ?? '').padStart(2, '0');
              const abbr = FIPS_TO_STATE[fips];
              const row = abbr ? dataByState.get(abbr) : undefined;
              const value = row ? row[metric] : undefined;
              const fill = value != null && isFinite(value as number)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? (colorScale as any)(value)
                : '#dde3ed';
              return (
                <path
                  key={String(f.id)}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  d={pathGen(f as any) ?? ''}
                  fill={fill}
                  stroke="#fff"
                  strokeWidth={0.5}
                  className={`state-path${row ? ' has-data' : ''}`}
                  onMouseEnter={() => setHovered(row ?? null)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
          </g>

          {/* Legend */}
          <g transform={`translate(30,${MAP_H - 32})`}>
            <text x={0} y={-6} fontSize={10} fill="#888" textAnchor="start">
              {metricMeta.label} ({metricMeta.unit})
            </text>
            <rect width={200} height={10} fill={`url(#${gradId})`} rx={2} />
            <text x={0} y={22} fontSize={10} fill="#888" textAnchor="start">
              {formatCompact(domain[0])}
            </text>
            <text x={200} y={22} fontSize={10} fill="#888" textAnchor="end">
              {formatCompact(domain[1])}
            </text>
          </g>
        </svg>

        {hovered && (
          <div
            className="map-tooltip"
            style={{
              left: cursor.x > containerW - 220 ? cursor.x - 200 : cursor.x + 14,
              top: Math.max(cursor.y - 110, 4),
            }}
          >
            <div className="tt-state">{STATE_NAMES[hovered.State] ?? hovered.State}</div>
            <div className="tt-row">
              <span className="tt-label">2021 (OSM)</span>
              <span className="tt-val">{hovered.datacenter_count_2021}</span>
            </div>
            <div className="tt-row">
              <span className="tt-label">2025 (IM3)</span>
              <span className="tt-val">{hovered.datacenter_count_2025}</span>
            </div>
            <div className="tt-row">
              <span className="tt-label">Growth</span>
              <span className="tt-val" style={{ color: '#059669' }}>
                +{hovered.datacenter_growth_2021_2025}
              </span>
            </div>
            {hovered.datacenter_growth_pct_2021_2025 != null && (
              <div className="tt-row">
                <span className="tt-label">Growth %</span>
                <span className="tt-val">+{hovered.datacenter_growth_pct_2021_2025.toFixed(1)}%</span>
              </div>
            )}
            {hovered.total_facility_area_sqft_2025 != null && (
              <div className="tt-row">
                <span className="tt-label">Area 2025</span>
                <span className="tt-val">
                  {hovered.total_facility_area_sqft_2025.toLocaleString()} sqft
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
