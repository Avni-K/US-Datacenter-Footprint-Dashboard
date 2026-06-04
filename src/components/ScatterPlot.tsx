import { useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { DatacenterCountRow } from '../types';
import { STATE_NAMES } from '../constants';

const W = 560;
const H = 380;
const MARGIN = { top: 24, right: 24, bottom: 52, left: 56 };

interface Props {
  rows: DatacenterCountRow[];
  onSelectState?: (state: string) => void;
  selectedStates?: string[];
}

export function ScatterPlot({ rows, onSelectState, selectedStates = [] }: Props) {
  const [hovered, setHovered] = useState<DatacenterCountRow | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0, w: 560 });

  const { xScale, yScale, rScale, colorScale, plotRows } = useMemo(() => {
    const plotRows = rows.filter(r => r.datacenter_count_2021 > 0 || r.datacenter_count_2025 > 0);
    const maxX = d3.max(plotRows, r => r.datacenter_count_2021) ?? 1;
    const maxY = d3.max(plotRows, r => r.datacenter_count_2025) ?? 1;
    const maxArea = d3.max(plotRows, r => r.total_facility_area_sqft_2025 ?? 0) ?? 1;
    const maxGrowthPct = d3.max(plotRows, r => r.datacenter_growth_pct_2021_2025 ?? 0) ?? 1;

    const xScale = d3.scaleLinear()
      .domain([0, maxX * 1.08])
      .range([MARGIN.left, W - MARGIN.right]);

    const yScale = d3.scaleLinear()
      .domain([0, maxY * 1.08])
      .range([H - MARGIN.bottom, MARGIN.top]);

    const rScale = d3.scaleSqrt()
      .domain([0, maxArea])
      .range([5, 24]);

    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([maxGrowthPct, 0])
      .clamp(true);

    return { xScale, yScale, rScale, colorScale, plotRows };
  }, [rows]);

  // Diagonal reference line (y = x → same count in 2021 and 2025)
  const diag = useMemo(() => {
    const x1 = xScale(0), y1 = yScale(0);
    const x2 = xScale(d3.min([
      xScale.domain()[1],
      yScale.domain()[1],
    ]) ?? 0);
    const y2 = yScale(d3.min([
      xScale.domain()[1],
      yScale.domain()[1],
    ]) ?? 0);
    return { x1, y1, x2, y2 };
  }, [xScale, yScale]);

  const xTicks = xScale.ticks(6);
  const yTicks = yScale.ticks(6);

  return (
    <div className="scatter-panel">
      <div className="scatter-header">
        <div className="panel-title">2021 vs 2025 Facility Counts by State</div>
        <div className="scatter-legend">
          <div className="scatter-legend-item">
            <span style={{ background: d3.interpolateRdYlGn(0) }} />
            High growth %
          </div>
          <div className="scatter-legend-item">
            <span style={{ background: d3.interpolateRdYlGn(0.5) }} />
            Moderate
          </div>
          <div className="scatter-legend-item">
            <span style={{ background: d3.interpolateRdYlGn(1) }} />
            Low growth
          </div>
          <div className="scatter-legend-item size-legend">
            ○ = facility area
          </div>
        </div>
      </div>
      <div
        className="scatter-wrap"
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width });
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="scatter-svg">
          {/* Grid lines */}
          {xTicks.map(t => (
            <line
              key={`xg-${t}`}
              x1={xScale(t)} x2={xScale(t)}
              y1={MARGIN.top} y2={H - MARGIN.bottom}
              stroke="#e2e8f0" strokeWidth={1}
            />
          ))}
          {yTicks.map(t => (
            <line
              key={`yg-${t}`}
              x1={MARGIN.left} x2={W - MARGIN.right}
              y1={yScale(t)} y2={yScale(t)}
              stroke="#e2e8f0" strokeWidth={1}
            />
          ))}

          {/* Diagonal reference line (no growth) */}
          <line
            x1={diag.x1} y1={diag.y1} x2={diag.x2} y2={diag.y2}
            stroke="#94a3b8" strokeWidth={1} strokeDasharray="4,3"
          />
          <text x={diag.x2 + 4} y={diag.y2 - 4} fontSize={9} fill="#94a3b8">no growth</text>

          {/* Axes */}
          <line x1={MARGIN.left} x2={W - MARGIN.right} y1={H - MARGIN.bottom} y2={H - MARGIN.bottom} stroke="#cbd5e1" />
          <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={H - MARGIN.bottom} stroke="#cbd5e1" />

          {xTicks.map(t => (
            <g key={`xt-${t}`}>
              <line x1={xScale(t)} x2={xScale(t)} y1={H - MARGIN.bottom} y2={H - MARGIN.bottom + 4} stroke="#94a3b8" />
              <text x={xScale(t)} y={H - MARGIN.bottom + 16} textAnchor="middle" fontSize={10} fill="#64748b">{t}</text>
            </g>
          ))}
          {yTicks.map(t => (
            <g key={`yt-${t}`}>
              <line x1={MARGIN.left - 4} x2={MARGIN.left} y1={yScale(t)} y2={yScale(t)} stroke="#94a3b8" />
              <text x={MARGIN.left - 8} y={yScale(t) + 4} textAnchor="end" fontSize={10} fill="#64748b">{t}</text>
            </g>
          ))}

          {/* Axis labels */}
          <text x={(MARGIN.left + W - MARGIN.right) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#475569" fontWeight={500}>
            2021 facility count
          </text>
          <text
            transform={`rotate(-90) translate(${-(MARGIN.top + H - MARGIN.bottom) / 2}, 13)`}
            textAnchor="middle" fontSize={11} fill="#475569" fontWeight={500}
          >
            2025 facility count
          </text>

          {/* Bubbles */}
          {plotRows.map(r => {
            const cx = xScale(r.datacenter_count_2021);
            const cy = yScale(r.datacenter_count_2025);
            const radius = rScale(r.total_facility_area_sqft_2025 ?? 0);
            const color = colorScale(r.datacenter_growth_pct_2021_2025 ?? 0);
            const isSelected = selectedStates.includes(r.State);
            const isHovered = hovered?.State === r.State;

            return (
              <g key={r.State}>
                <circle
                  cx={cx} cy={cy} r={radius}
                  fill={color}
                  fillOpacity={isSelected || isHovered ? 1 : 0.7}
                  stroke={isSelected ? '#0f172a' : isHovered ? '#334155' : '#fff'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className="scatter-bubble"
                  onMouseEnter={() => setHovered(r)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelectState?.(r.State)}
                  style={{ cursor: 'pointer', transition: 'r 0.2s, fill-opacity 0.2s' }}
                />
                {(isSelected || isHovered || radius > 14) && (
                  <text
                    x={cx} y={cy + 3}
                    textAnchor="middle" fontSize={9}
                    fontWeight={700} fill="#0f172a"
                    style={{ pointerEvents: 'none' }}
                  >
                    {r.State}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div
            className="scatter-tooltip"
            style={{
              left: cursor.x > cursor.w * 0.6 ? cursor.x - 188 : cursor.x + 14,
              top: Math.max(cursor.y - 80, 4),
            }}
          >
            <div className="tt-state">{STATE_NAMES[hovered.State] ?? hovered.State}</div>
            <div className="tt-row">
              <span className="tt-label">2021 count</span>
              <span className="tt-val">{hovered.datacenter_count_2021}</span>
            </div>
            <div className="tt-row">
              <span className="tt-label">2025 count</span>
              <span className="tt-val">{hovered.datacenter_count_2025}</span>
            </div>
            <div className="tt-row">
              <span className="tt-label">Growth</span>
              <span className="tt-val">+{hovered.datacenter_growth_2021_2025} ({hovered.datacenter_growth_pct_2021_2025 != null ? hovered.datacenter_growth_pct_2021_2025.toFixed(0) + '%' : 'n/a'})</span>
            </div>
            {hovered.total_facility_area_sqft_2025 && (
              <div className="tt-row">
                <span className="tt-label">Area 2025</span>
                <span className="tt-val">{(hovered.total_facility_area_sqft_2025 / 1e6).toFixed(1)}M sqft</span>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="race-footnote" style={{ marginTop: 8 }}>
        2021: OSM snapshot spatially joined to state boundaries. 2025: IM3 Atlas.
        Bubble size = 2025 facility area. Color = growth rate (red = high, green = low).
      </p>
    </div>
  );
}
