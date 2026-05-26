import { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { feature as topoFeature } from 'topojson-client';
import type { StateRow, MetricKey } from '../types';
import { FIPS_TO_STATE } from '../constants';
import { formatFull, formatCompact } from '../utils/format';

const MAP_W = 960;
const MAP_H = 580;

interface Props {
  data: StateRow[];
  metricKey: MetricKey;
  metricLabel: string;
  metricUnit: string;
  dataByState: Map<string, StateRow>;
}

export function ChoroplethMap({
  data,
  metricKey,
  metricLabel,
  metricUnit,
  dataByState,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [topo, setTopo] = useState<any>(null);
  const [hovered, setHovered] = useState<StateRow | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch('/data/states-10m.json')
      .then(r => r.json())
      .then(setTopo);
  }, []);

  const { statesFeatures, pathGen } = useMemo(() => {
    if (!topo) return { statesFeatures: null, pathGen: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geo = topoFeature(topo, topo.objects.states) as unknown as { features: any[] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj = d3.geoAlbersUsa().fitSize([MAP_W, MAP_H], geo as any);
    return { statesFeatures: geo.features, pathGen: d3.geoPath(proj) };
  }, [topo]);

  const { colorScale, domain } = useMemo(() => {
    const vals = data.map(d => d[metricKey]).filter(isFinite);
    const max = d3.max(vals) ?? 1;
    const dom: [number, number] = [0, max];
    return {
      colorScale: d3.scaleSequential(d3.interpolateOrRd).domain(dom),
      domain: dom,
    };
  }, [data, metricKey]);

  const gradId = `lg-${metricKey}`;

  if (!statesFeatures || !pathGen) {
    return <div className="map-loading">Loading map…</div>;
  }

  const containerW = containerRef.current?.clientWidth ?? 900;

  return (
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
            {[0, 0.25, 0.5, 0.75, 1].map(t => (
              <stop
                key={t}
                offset={`${t * 100}%`}
                stopColor={colorScale(domain[0] + t * (domain[1] - domain[0]))}
              />
            ))}
          </linearGradient>
        </defs>

        <g>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {statesFeatures.map((f: any) => {
            const fips = String(f.id ?? '').padStart(2, '0');
            const abbr = FIPS_TO_STATE[fips];
            const row = abbr ? dataByState.get(abbr) : undefined;
            const value = row ? row[metricKey] : undefined;
            return (
              <path
                key={String(f.id)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                d={pathGen(f as any) ?? ''}
                fill={value != null ? colorScale(value) : '#dde3ed'}
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
            {metricLabel} ({metricUnit})
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
            left: cursor.x > containerW - 210 ? cursor.x - 186 : cursor.x + 14,
            top: Math.max(cursor.y - 94, 4),
          }}
        >
          <div className="tt-state">{hovered.State}</div>
          <div className="tt-row">
            <span className="tt-label">Energy</span>
            <span className="tt-val">{formatFull(hovered.Scaled_power_consumption_MWh)} MWh</span>
          </div>
          <div className="tt-row">
            <span className="tt-label">Water</span>
            <span className="tt-val">{formatFull(hovered.Water_footprint_m3)} m³</span>
          </div>
          <div className="tt-row">
            <span className="tt-label">Carbon</span>
            <span className="tt-val">{formatFull(hovered.Carbon_footprint_tonsCO2e)} tCO₂e</span>
          </div>
        </div>
      )}
    </div>
  );
}
