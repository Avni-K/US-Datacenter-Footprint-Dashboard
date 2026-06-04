import { useState, useEffect, useMemo, useRef } from 'react';
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

type MapLens = 'footprint' | 'growth' | 'density' | 'water' | 'carbon' | 'risk';

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
  lens: MapLens;
  timelineYear: number;
  whatIfNewCenters: number;
  whatIfEfficiency: number;
  drilldownState: string | null;
  lassoMode: boolean;
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
  lens,
  timelineYear,
  whatIfNewCenters,
  whatIfEfficiency,
  drilldownState,
  lassoMode,
  onSetSelectedStates,
  onDrilldownState,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [topo, setTopo] = useState<any>(null);
  const [hovered, setHovered] = useState<StateRow | null>(null);
  const [hoveredCenter, setHoveredCenter] = useState<(DatacenterLocation & { overlayYear: '2021' | '2025' }) | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [showLabels, setShowLabels] = useState(false);

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

    const centerCountFor = (state: string) => {
      const counts = datacenterCountsByState.get(state);
      if (counts) {
        const ratio = Math.max(0, Math.min(1, (timelineYear - 2021) / 4));
        return counts.datacenter_count_2021 +
          (counts.datacenter_count_2025 - counts.datacenter_count_2021) * ratio +
          (selectedStates.includes(state) ? whatIfNewCenters : 0);
      }
      const actualCount = datacenterLocations.filter(loc => loc.state === state).length;
      return actualCount + (selectedStates.includes(state) ? whatIfNewCenters : 0);
    };

    const growthMax = d3.max(data, row => Math.max(0, centerCountFor(row.State))) ?? 1;
    const densityMax = d3.max(data, row => centerCountFor(row.State) / Math.max(1, row.Scaled_power_consumption_MWh / 1_000_000)) ?? 1;
    const waterMax = d3.max(data, row => row.Water_intensity_m3_per_MWh) ?? 1;
    const carbonMax = d3.max(data, row => row.Carbon_intensity_tonsCO2e_per_MWh) ?? 1;

    const footprintScoreFor = (row: StateRow) =>
      d3.sum(keys, key => {
        const efficiencyFactor = selectedStates.includes(row.State) ? (1 - whatIfEfficiency / 100) : 1;
        return ((row[key] * efficiencyFactor) / (maxByKey.get(key) || 1)) * normalizedWeightFor(key);
      });

    const scoreFor = (row: StateRow) => {
      const footprintScore = footprintScoreFor(row);
      const growthScore = centerCountFor(row.State) / (growthMax || 1);
      const densityScore = (centerCountFor(row.State) / Math.max(1, row.Scaled_power_consumption_MWh / 1_000_000)) / (densityMax || 1);
      const waterScore = row.Water_intensity_m3_per_MWh / (waterMax || 1);
      const carbonScore = row.Carbon_intensity_tonsCO2e_per_MWh / (carbonMax || 1);

      if (lens === 'growth') return growthScore;
      if (lens === 'density') return densityScore;
      if (lens === 'water') return waterScore;
      if (lens === 'carbon') return carbonScore;
      if (lens === 'risk') return (footprintScore * 0.45) + (growthScore * 0.25) + (waterScore * 0.15) + (carbonScore * 0.15);
      return footprintScore;
    };

    const maxScore = d3.max(data, scoreFor) ?? 1;
    const colorScale = d3
      .scaleSequential(d3.interpolateYlOrRd)
      .domain([0, maxScore || 1])
      .clamp(true);
    const focusedStates = new Set(
      [...data]
        .sort((a, b) => scoreFor(b) - scoreFor(a))
        .slice(0, focusCount)
        .map(row => row.State),
    );

    const legendLabel =
      lens === 'growth' ? 'Data center growth pressure' :
      lens === 'density' ? 'Facilities per energy demand' :
      lens === 'water' ? 'Water intensity exposure' :
      lens === 'carbon' ? 'Carbon intensity exposure' :
      lens === 'risk' ? 'Combined operational risk' :
      COMBINED_LABEL;

    return {
      fillFor: (row: StateRow) => colorScale(scoreFor(row)),
      scoreFor,
      focusedStates,
      maxScore,
      centerCountFor,
      legendLabel,
    };
  }, [
    data,
    datacenterCountsByState,
    datacenterLocations,
    focusCount,
    lens,
    selectedStates,
    timelineYear,
    weights,
    whatIfEfficiency,
    whatIfNewCenters,
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

  const brushRect = dragStart && dragCurrent
    ? {
        x: Math.min(dragStart.x, dragCurrent.x),
        y: Math.min(dragStart.y, dragCurrent.y),
        width: Math.abs(dragCurrent.x - dragStart.x),
        height: Math.abs(dragCurrent.y - dragStart.y),
      }
    : null;

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
        if (dragStart) {
          setDragCurrent({
            x: nextCursor.x * (MAP_W / rect.width),
            y: nextCursor.y * (MAP_H / rect.height),
          });
        }
      }}
      onMouseUp={() => {
        if (lassoMode && brushRect && brushRect.width > 10 && brushRect.height > 10) {
          const statesInBrush = featureMeta
            .filter(({ centroid }) =>
              centroid[0] >= brushRect.x &&
              centroid[0] <= brushRect.x + brushRect.width &&
              centroid[1] >= brushRect.y &&
              centroid[1] <= brushRect.y + brushRect.height,
            )
            .map(item => item.state)
            .filter(Boolean) as string[];
          if (statesInBrush.length > 0) {
            onSetSelectedStates(Array.from(new Set([...selectedStates, ...statesInBrush])));
            onSelectState(statesInBrush[statesInBrush.length - 1]);
          }
        }
        setDragStart(null);
        setDragCurrent(null);
      }}
    >
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        onMouseDown={event => {
          if (!lassoMode) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const sx = MAP_W / rect.width;
          const sy = MAP_H / rect.height;
          const point = {
            x: (event.clientX - rect.left) * sx,
            y: (event.clientY - rect.top) * sy,
          };
          setDragStart(point);
          setDragCurrent(point);
        }}
      >
        <defs>
          <linearGradient id="state-score-gradient" x1="0" x2="1" y1="0" y2="0">
            {[0, 0.25, 0.5, 0.75, 1].map(t => (
              <stop
                key={t}
                offset={`${t * 100}%`}
                stopColor={d3.interpolateYlOrRd(t)}
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
                stroke="#fff"
                strokeWidth={isSelected || isPortfolio ? 2.5 : 0.5}
                className={`state-path${row ? ' has-data' : ''}${isSelected ? ' selected' : ''}${isPortfolio ? ' portfolio' : ''}${isDrilldown ? ' drilldown' : ''}${row && !isFocused && !isPortfolio && !isDrilldown ? ' muted' : ''}`}
                onMouseEnter={() => setHovered(row ?? null)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (!row) return;
                  if (lassoMode) return;
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

          {showLabels && (
          <g className="state-labels-layer">
            {featureMeta.map(({ state, row, centroid }) => {
              if (!row || !state || !centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return null;
              const score = composite.scoreFor(row);
              const isFocused = composite.focusedStates.has(state);
              return (
                <g key={`label-${state}`} transform={`translate(${centroid[0]},${centroid[1]})`} className="state-label-group">
                  <rect
                    x={-18} y={-18}
                    width={36} height={28}
                    rx={4}
                    fill={composite.fillFor(row)}
                    fillOpacity={0.88}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                  <text
                    textAnchor="middle"
                    fontSize={isFocused ? 10 : 8}
                    fontWeight={isFocused ? 700 : 500}
                    fill="#fff"
                    y={-4}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {state}
                  </text>
                  <text
                    textAnchor="middle"
                    fontSize={isFocused ? 9 : 7.5}
                    fontWeight={400}
                    fill="#fff"
                    y={8}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {(score * 100).toFixed(0)}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {centerDots.length > 0 && (
          <g>
            {centerDots.map(({ loc, x, y }) => (
              <circle
                key={`${loc.overlayYear}-${loc.osm_id}-${x}-${y}`}
                cx={x}
                cy={y}
                r={loc.overlayYear === '2025' ? 3.4 : 2.8}
                fill={loc.overlayYear === '2025' ? '#0f766e' : '#2563eb'}
                fillOpacity={0.72}
                stroke="#fff"
                strokeWidth={0.7}
                className="center-dot"
                onMouseEnter={() => setHoveredCenter(loc)}
                onMouseLeave={() => setHoveredCenter(null)}
              />
            ))}
          </g>
        )}

        <g transform={`translate(30,${MAP_H - 78})`}>
          <rect x={-8} y={-24} width={312} height={78} fill="rgba(255,255,255,0.9)" rx={5} />
          <text x={0} y={-4} fontSize={10} fill="#555" textAnchor="start">
            {composite.legendLabel}
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
        </g>
        {brushRect && (
          <rect
            className="lasso-rect"
            x={brushRect.x}
            y={brushRect.y}
            width={brushRect.width}
            height={brushRect.height}
          />
        )}
      </svg>

      <button
        type="button"
        className={`map-label-toggle${showLabels ? ' active' : ''}`}
        onClick={() => setShowLabels(v => !v)}
      >
        {showLabels ? '🏷 Labels On' : '🏷 Labels'}
      </button>

      {lassoMode && <div className="lasso-hint">Drag across the map to add states to the portfolio</div>}

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
