import { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { feature as topoFeature } from 'topojson-client';
import type { DatacenterLocation } from '../types';

const MAP_W = 960;
const MAP_H = 580;

interface Props {
  locations: DatacenterLocation[];
}

const LAYER_COLORS: Record<string, string> = {
  // OSM 2021 layers
  polygons: '#2563eb',
  points:   '#f59e0b',
  lines:    '#10b981',
  // IM3 2025 layers
  building: '#2563eb',
  point:    '#f59e0b',
  campus:   '#7c3aed',
};

export function DatacenterMap({ locations }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [topo, setTopo] = useState<any>(null);
  const [hovered, setHovered] = useState<DatacenterLocation | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetch('/data/states-10m.json')
      .then(r => r.json())
      .then(setTopo);
  }, []);

  const { statesFeatures, proj } = useMemo(() => {
    if (!topo) return { statesFeatures: null, proj: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geo = topoFeature(topo, topo.objects.states) as unknown as { features: any[] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = d3.geoAlbersUsa().fitSize([MAP_W, MAP_H], geo as any);
    return { statesFeatures: geo.features, proj: p };
  }, [topo]);

  const pathGen = useMemo(() => proj ? d3.geoPath(proj) : null, [proj]);

  const dots = useMemo(() => {
    if (!proj) return [];
    return locations
      .map(loc => {
        const pt = proj([loc.lon, loc.lat]);
        return pt ? { loc, x: pt[0], y: pt[1] } : null;
      })
      .filter(Boolean) as { loc: DatacenterLocation; x: number; y: number }[];
  }, [locations, proj]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const loc of locations) {
      c[loc.source_layer] = (c[loc.source_layer] ?? 0) + 1;
    }
    return c;
  }, [locations]);

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
        {/* State outlines */}
        <g>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {statesFeatures.map((f: any) => (
            <path
              key={String(f.id)}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              d={pathGen(f as any) ?? ''}
              fill="#e8edf4"
              stroke="#fff"
              strokeWidth={0.8}
            />
          ))}
        </g>

        {/* Data center dots */}
        <g>
          {dots.map(({ loc, x, y }) => (
            <circle
              key={loc.osm_id}
              cx={x}
              cy={y}
              r={5}
              fill={LAYER_COLORS[loc.source_layer] ?? '#6366f1'}
              fillOpacity={0.75}
              stroke="#fff"
              strokeWidth={0.8}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(loc)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </g>

        {/* Legend */}
        <g transform={`translate(30,${MAP_H - 72})`}>
          <text fontSize={10} fill="#888" fontWeight={600}>OSM source layer</text>
          {Object.entries(LAYER_COLORS).map(([layer, color], i) => (
            <g key={layer} transform={`translate(0,${14 + i * 16})`}>
              <circle r={5} cx={5} cy={0} fill={color} fillOpacity={0.75} />
              <text x={14} y={4} fontSize={10} fill="#555">
                {layer} ({counts[layer] ?? 0})
              </text>
            </g>
          ))}
        </g>
      </svg>

      {hovered && (
        <div
          className="map-tooltip"
          style={{
            left: cursor.x > containerW - 220 ? cursor.x - 200 : cursor.x + 14,
            top: Math.max(cursor.y - 80, 4),
          }}
        >
          <div className="tt-state">{hovered.name || '(unnamed)'}</div>
          {hovered.operator && (
            <div className="tt-row">
              <span className="tt-label">Operator</span>
              <span className="tt-val">{hovered.operator}</span>
            </div>
          )}
          {hovered.city && (
            <div className="tt-row">
              <span className="tt-label">City / County</span>
              <span className="tt-val">{hovered.city}</span>
            </div>
          )}
          {hovered.state && (
            <div className="tt-row">
              <span className="tt-label">State</span>
              <span className="tt-val">{hovered.state}</span>
            </div>
          )}
          <div className="tt-row">
            <span className="tt-label">Layer</span>
            <span className="tt-val">{hovered.source_layer}</span>
          </div>
          <div className="tt-row">
            <span className="tt-label">Coords</span>
            <span className="tt-val">{hovered.lat.toFixed(4)}, {hovered.lon.toFixed(4)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
