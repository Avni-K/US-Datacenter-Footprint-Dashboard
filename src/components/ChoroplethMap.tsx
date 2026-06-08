import { useState, useEffect, useMemo, useRef, type MouseEvent } from 'react';
import * as d3 from 'd3';
import { feature as topoFeature } from 'topojson-client';
import type { DatacenterCountRow, DatacenterLocation, StateRow, MetricKey } from '../types';
import { FIPS_TO_STATE, STATE_NAMES } from '../constants';
import { formatFull } from '../utils/format';
import { StateFlag } from './StateFlag';

const MAP_W = 960;
const MAP_H = 580;

const COMBINED_LABEL = 'Combined Environmental Footprint';

const COMPOSITE_LEGEND = [
  { label: 'Energy', color: 'rgb(196, 57, 44)' },
  { label: 'Water', color: 'rgb(8, 145, 178)' },
  { label: 'Carbon', color: 'rgb(124, 58, 237)' },
];

const STATE_SCORE_COLORS = ['#fff2bf', '#fed976', '#fdae42', '#f97316', '#dc2626', '#7f001d'];
const DC_2021_COLOR = '#f59e0b';
const DC_2025_COLOR = '#14b8a6';
const STAR_PATH = d3.symbol().type(d3.symbolStar).size(72)() ?? '';

interface Props {
  data: StateRow[];
  dataByState: Map<string, StateRow>;
  weights: Record<MetricKey, number>;
  focusCount: number;
  selectedState: string | null;
  selectedStates: string[];
  activeState: string | null;
  onSelectState: (state: string | null) => void;
  onTogglePortfolioState: (state: string) => void;
  datacenterLocations: (DatacenterLocation & { overlayYear: '2021' | '2025' })[];
  datacenterCountsByState: Map<string, DatacenterCountRow>;
  drilldownState: string | null;
  onSetSelectedStates: (states: string[]) => void;
  onDrilldownState: (state: string | null) => void;
}

export function ChoroplethMap({
  data,
  dataByState,
  weights,
  focusCount,
  selectedState,
  selectedStates,
  activeState,
  onSelectState,
  onTogglePortfolioState,
  datacenterLocations,
  datacenterCountsByState,
  drilldownState,
  onSetSelectedStates,
  onDrilldownState,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [topo, setTopo] = useState<any>(null);
  const [hovered, setHovered] = useState<StateRow | null>(null);
  const [hoveredCenter, setHoveredCenter] = useState<(DatacenterLocation & { overlayYear: '2021' | '2025' }) | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [lassoStart, setLassoStart] = useState<{ x: number; y: number } | null>(null);
  const [lassoCurrent, setLassoCurrent] = useState<{ x: number; y: number } | null>(null);
  const blockNextClickRef = useRef(false);

  useEffect(() => {
    fetch('/data/states-10m.json')
      .then(r => r.json())
      .then(setTopo);
  }, []);

  const { statesFeatures, pathGen, proj } = useMemo(() => {
    if (!topo) return { statesFeatures: null, pathGen: null, proj: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geo = topoFeature(topo, topo.objects.states) as unknown as { features: any[] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj = d3.geoAlbersUsa().fitSize([MAP_W, MAP_H], geo as any);
    return { statesFeatures: geo.features, pathGen: d3.geoPath(proj), proj };
  }, [topo]);

  const featureMeta = useMemo(() => {
    if (!statesFeatures || !pathGen) return [];
    return statesFeatures
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => {
        const fips = String(f.id ?? '').padStart(2, '0');
        const state = FIPS_TO_STATE[fips];
        const row = state ? dataByState.get(state) : undefined;
        const centroid = pathGen.centroid(f);
        return { f, state, row, centroid };
      })
      .filter(item => item.state && item.row);
  }, [dataByState, pathGen, statesFeatures]);

  const composite = useMemo(() => {
    const keys: MetricKey[] = [
      'Scaled_power_consumption_MWh',
      'Water_footprint_m3',
      'Carbon_footprint_tonsCO2e',
    ];
    const maxByKey = new Map<MetricKey, number>(
      keys.map(key => [key, d3.max(data, d => d[key]) ?? 1]),
    );

    const weightTotal = d3.sum(keys, key => weights[key]);

    const normalizedWeightFor = (key: MetricKey) =>
      weightTotal > 0 ? weights[key] / weightTotal : 1 / keys.length;

    // Normalize each metric against its national maximum before blending, so energy,
    // water, and carbon can share one readable footprint color scale.
    const scoreFor = (row: StateRow) =>
      d3.sum(keys, key => {
        return (row[key] / (maxByKey.get(key) || 1)) * normalizedWeightFor(key);
      });

    const maxScore = d3.max(data, scoreFor) ?? 1;
    const colorScale = d3
      .scaleSequential(d3.interpolateRgbBasis(STATE_SCORE_COLORS))
      .domain([0, maxScore || 1])
      .clamp(true);
    const focusedStates = new Set(
      [...data]
        .sort((a, b) => scoreFor(b) - scoreFor(a))
        .slice(0, focusCount)
        .map(row => row.State),
    );

    return {
      fillFor: (row: StateRow) => colorScale(scoreFor(row)),
      scoreFor,
      focusedStates,
      maxScore,
    };
  }, [
    data,
    focusCount,
    weights,
  ]);

  const centerDots = useMemo(() => {
    if (!proj) return [];
    return datacenterLocations
      .map(loc => {
        const pt = proj([loc.lon, loc.lat]);
        return pt ? { loc, x: pt[0], y: pt[1] } : null;
      })
      .filter(Boolean) as { loc: DatacenterLocation & { overlayYear: '2021' | '2025' }; x: number; y: number }[];
  }, [datacenterLocations, proj]);

  const stateCallouts = useMemo(() => {
    return featureMeta
      .map(({ state, row, centroid }) => {
        if (!state || !row || !centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return null;
        const counts = datacenterCountsByState.get(state);
        if (!counts) return null;
        const visible =
          selectedStates.includes(state) ||
          state === selectedState ||
          state === drilldownState;
        return visible ? { state, row, centroid, counts } : null;
      })
      .filter(Boolean) as {
        state: string;
        row: StateRow;
        centroid: [number, number];
        counts: DatacenterCountRow;
      }[];
  }, [datacenterCountsByState, drilldownState, featureMeta, selectedState, selectedStates]);

  const lassoRect = lassoStart && lassoCurrent
    ? {
        x: Math.min(lassoStart.x, lassoCurrent.x),
        y: Math.min(lassoStart.y, lassoCurrent.y),
        width: Math.abs(lassoCurrent.x - lassoStart.x),
        height: Math.abs(lassoCurrent.y - lassoStart.y),
      }
    : null;

  const svgPoint = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (MAP_W / rect.width),
      y: (event.clientY - rect.top) * (MAP_H / rect.height),
    };
  };

  if (!statesFeatures || !pathGen) {
    return <div className="map-loading">Loading map…</div>;
  }

  return (
    <div
      ref={containerRef}
      className="map-container"
      onMouseMove={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const nextCursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setCursor(nextCursor);
      }}
    >
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        onMouseDown={event => {
          if (event.button !== 0) return;
          const point = svgPoint(event);
          setLassoStart(point);
          setLassoCurrent(point);
        }}
        onMouseMove={event => {
          if (!lassoStart) return;
          setLassoCurrent(svgPoint(event));
        }}
        onMouseUp={() => {
          if (!lassoRect) return;
          if (lassoRect.width > 14 && lassoRect.height > 14) {
            blockNextClickRef.current = true;
            window.setTimeout(() => {
              blockNextClickRef.current = false;
            }, 0);
            // Lasso selection uses projected state centroids to keep the interaction fast
            // while still matching the states users visually brushed on the map.
            const statesInBrush = featureMeta
              .filter(({ state, row, centroid }) =>
                state &&
                row &&
                centroid &&
                centroid[0] >= lassoRect.x &&
                centroid[0] <= lassoRect.x + lassoRect.width &&
                centroid[1] >= lassoRect.y &&
                centroid[1] <= lassoRect.y + lassoRect.height,
              )
              .map(item => item.state)
              .filter(Boolean) as string[];

            if (statesInBrush.length > 0) {
              const nextStates = Array.from(new Set([...selectedStates, ...statesInBrush]));
              onSetSelectedStates(nextStates);
              onSelectState(statesInBrush[statesInBrush.length - 1]);
            }
          }
          setLassoStart(null);
          setLassoCurrent(null);
        }}
        onMouseLeave={() => {
          setLassoStart(null);
          setLassoCurrent(null);
        }}
      >
        <defs>
          <linearGradient id="state-score-gradient" x1="0" x2="1" y1="0" y2="0">
            {[0, 0.25, 0.5, 0.75, 1].map(t => (
              <stop
                key={t}
                offset={`${t * 100}%`}
                stopColor={d3.interpolateRgbBasis(STATE_SCORE_COLORS)(t)}
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
            const isSelected = row?.State === activeState;
            const isPortfolio = row ? selectedStates.includes(row.State) : false;
            const isFocused = row ? composite.focusedStates.has(row.State) : false;
            const isDrilldown = row ? drilldownState === row.State : false;
            return (
              <path
                key={String(f.id)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                d={pathGen(f as any) ?? ''}
                data-state={row?.State}
                fill={row ? composite.fillFor(row) : '#dde3ed'}
                stroke={isSelected || isPortfolio ? undefined : '#cbd5e1'}
                strokeWidth={isSelected || isPortfolio ? 2.5 : 0.85}
                className={`state-path${row ? ' has-data' : ''}${isSelected ? ' selected' : ''}${isPortfolio ? ' portfolio' : ''}${isDrilldown ? ' drilldown' : ''}${row && !isFocused && !isPortfolio && !isDrilldown ? ' muted' : ''}`}
                onMouseEnter={() => setHovered(row ?? null)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (!row) return;
                  if (blockNextClickRef.current) return;
                  const isRemovingPinnedState = selectedStates.includes(row.State) && row.State === selectedState;
                  onTogglePortfolioState(row.State);
                  onSelectState(isRemovingPinnedState ? null : row.State);
                }}
                onDoubleClick={() => {
                  if (!row) return;
                  onDrilldownState(drilldownState === row.State ? null : row.State);
                  onSelectState(row.State);
                }}
              />
            );
          })}
        </g>

        {stateCallouts.length > 0 && (
          <g className="state-labels-layer">
            {stateCallouts.map(({ state, row, centroid, counts }) => {
              const score = composite.scoreFor(row);
              const growth = counts.datacenter_count_2025 - counts.datacenter_count_2021;
              const selected = selectedStates.includes(state) || state === activeState;
              return (
                <g key={`label-${state}`} transform={`translate(${centroid[0]},${centroid[1]})`} className={`state-label-group dc-callout${selected ? ' selected' : ''}`}>
                  <rect
                    x={-32} y={-30}
                    width={64} height={50}
                    rx={5}
                    fill="rgba(15,23,42,0.88)"
                    stroke={selected ? '#facc15' : '#fff'}
                    strokeWidth={selected ? 1.8 : 0.8}
                  />
                  <text
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={800}
                    fill="#fff"
                    y={-16}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {state} {score > 0 ? `${(score * 100).toFixed(0)}` : ''}
                  </text>
                  <path d={STAR_PATH} transform="translate(-20,0) scale(0.72)" fill={DC_2021_COLOR} stroke="#fff7ed" strokeWidth={1.2} />
                  <text
                    textAnchor="start"
                    fontSize={10}
                    fontWeight={800}
                    fill="#fff"
                    x={-10}
                    y={4}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {counts.datacenter_count_2021}
                  </text>
                  <rect x={8} y={-7} width={11} height={11} rx={1.5} fill={DC_2025_COLOR} stroke="#ecfeff" strokeWidth={1} />
                  <text
                    textAnchor="start"
                    fontSize={10}
                    fontWeight={800}
                    fill="#fff"
                    x={24}
                    y={4}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {counts.datacenter_count_2025}
                  </text>
                  <text
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight={700}
                    fill={growth >= 0 ? '#bbf7d0' : '#fecaca'}
                    y={16}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {growth >= 0 ? '+' : ''}{growth} DCs
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {centerDots.length > 0 && (
          <g className="dc-marker-layer">
            {centerDots.map(({ loc, x, y }) => {
              const key = `${loc.overlayYear}-${loc.osm_id}-${x}-${y}`;
              const commonHandlers = {
                onMouseEnter: () => setHoveredCenter(loc),
                onMouseLeave: () => setHoveredCenter(null),
              };

              return loc.overlayYear === '2021' ? (
                <g key={key} className="dc-marker dc-marker-2021" {...commonHandlers}>
                  <circle cx={x} cy={y} r={6.4} className="dc-marker-halo" />
                  <path
                    d={STAR_PATH}
                    transform={`translate(${x},${y}) scale(0.68)`}
                    fill={DC_2021_COLOR}
                    stroke="#111827"
                    strokeWidth={0.75}
                    className="center-dot center-dot-2021"
                  />
                </g>
              ) : (
                <g key={key} className="dc-marker dc-marker-2025" {...commonHandlers}>
                  <circle cx={x} cy={y} r={6.2} className="dc-marker-halo" />
                  <rect
                    x={x - 4}
                    y={y - 4}
                    width={8}
                    height={8}
                    rx={1.5}
                    fill={DC_2025_COLOR}
                    stroke="#111827"
                    strokeWidth={0.75}
                    className="center-dot center-dot-2025"
                  />
                </g>
              );
            })}
          </g>
        )}

        {lassoRect && lassoRect.width > 4 && lassoRect.height > 4 && (
          <rect
            className="lasso-rect"
            x={lassoRect.x}
            y={lassoRect.y}
            width={lassoRect.width}
            height={lassoRect.height}
          />
        )}

        <g transform={`translate(30,${MAP_H - 86})`}>
          <rect x={-8} y={-24} width={330} height={88} fill="rgba(255,255,255,0.92)" rx={5} />
          <text x={0} y={-4} fontSize={10} fill="#555" textAnchor="start">
            State color: {COMBINED_LABEL}
          </text>
          <rect x={0} y={8} width={190} height={10} rx={2} fill="url(#state-score-gradient)" />
          <text x={0} y={32} fontSize={10} fill="#555">Low</text>
          <text x={190} y={32} fontSize={10} fill="#555" textAnchor="end">
            {(composite.maxScore * 100).toFixed(0)}
          </text>
          {COMPOSITE_LEGEND.map((item, i) => (
            <g key={item.label} transform={`translate(${i * 86},47)`}>
              <circle r={5} cx={5} cy={0} fill={item.color} />
              <text x={16} y={4} fontSize={10} fill="#555">{item.label}</text>
            </g>
          ))}
          <g transform="translate(0,65)">
            <path d={STAR_PATH} transform="translate(5,0) scale(0.6)" fill={DC_2021_COLOR} stroke="#111827" strokeWidth={0.75} />
            <text x={16} y={4} fontSize={10} fill="#555">2021 DCs</text>
            <rect x={82} y={-5} width={10} height={10} rx={1.5} fill={DC_2025_COLOR} stroke="#111827" strokeWidth={0.75} />
            <text x={99} y={4} fontSize={10} fill="#555">2025 DCs</text>
          </g>
        </g>
      </svg>

      {drilldownState && (
        <div className="drilldown-banner">
          <span>Drilldown: {STATE_NAMES[drilldownState] ?? drilldownState}</span>
          <button type="button" onClick={() => onDrilldownState(null)}>Reset view</button>
        </div>
      )}

      {hovered && (
        <div
          className="map-tooltip"
          style={{
            left: cursor.x > 690 ? cursor.x - 186 : cursor.x + 14,
            top: Math.max(cursor.y - 94, 4),
          }}
        >
          <div className="tt-state tt-state-with-flag">
            <StateFlag state={hovered.State} />
            <span>{STATE_NAMES[hovered.State] ?? hovered.State}</span>
          </div>
          <div className="tt-row">
            <span className="tt-label">Combined</span>
            <span className="tt-val">{(composite.scoreFor(hovered) * 100).toFixed(1)} score</span>
          </div>
          {(() => {
            const counts = datacenterCountsByState.get(hovered.State);
            return counts ? (
              <>
                <div className="tt-row">
                  <span className="tt-label">Centers 2021</span>
                  <span className="tt-val">{counts.datacenter_count_2021}</span>
                </div>
                <div className="tt-row">
                  <span className="tt-label">Centers 2025</span>
                  <span className="tt-val">
                    {counts.datacenter_count_2025}
                    {counts.datacenter_growth_2021_2025 !== 0 && (
                      <span className={`tt-growth ${counts.datacenter_growth_2021_2025 > 0 ? 'positive' : 'negative'}`}>
                        {counts.datacenter_growth_2021_2025 > 0 ? ' +' : ' '}{counts.datacenter_growth_2021_2025}
                      </span>
                    )}
                  </span>
                </div>
              </>
            ) : null;
          })()}
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

      {hoveredCenter && (
        <div
          className="map-tooltip"
          style={{
            left: cursor.x > 690 ? cursor.x - 200 : cursor.x + 14,
            top: Math.max(cursor.y - 86, 4),
          }}
        >
          <div className="tt-state">{hoveredCenter.name || '(unnamed)'}</div>
          <div className="tt-row">
            <span className="tt-label">Dataset</span>
            <span className="tt-val">{hoveredCenter.overlayYear}</span>
          </div>
          <div className="tt-row">
            <span className="tt-label">State</span>
            <span className="tt-val">{hoveredCenter.state || 'n/a'}</span>
          </div>
          <div className="tt-row">
            <span className="tt-label">Layer</span>
            <span className="tt-val">{hoveredCenter.source_layer}</span>
          </div>
        </div>
      )}
    </div>
  );
}
